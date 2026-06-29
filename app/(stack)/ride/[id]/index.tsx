import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { TYPE } from "@/constants/Typography";
import { SPACE } from "@/constants/Spacing";
import { NotificationOptInModal } from "@/components/NotificationOptInModal";
import { useNotificationOptInPrompt } from "@/hooks/useNotificationOptInPrompt";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Ionicons } from "@expo/vector-icons";
import {
  Box,
  Button,
  HStack,
  Heading,
  Pressable,
  ScrollView,
  Spinner,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Timestamp,
  arrayUnion,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavHeader } from "@/components/ui/NavHeader";

type Ride = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  notes?: string;
  createdAt: Timestamp;
  memberIds: string[];
  genderPref?: string;
  hostId: string | null;
  archived: boolean;
};

const parseRideDateTime = (dateStr: string, timeStr: string): Date | null => {
  try {
    const currentYear = new Date().getFullYear();
    const parsed = new Date(`${dateStr}, ${currentYear} ${timeStr}`);
    if (!isNaN(parsed.getTime())) return parsed;
    const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (timeParts) {
      let hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2]);
      if (timeParts[3].toUpperCase() === "PM" && hours < 12) hours += 12;
      if (timeParts[3].toUpperCase() === "AM" && hours === 12) hours = 0;
      const dateParts = dateStr.match(/(\w+)\s+(\d+)/);
      if (dateParts) {
        const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
        const monthIdx = months.indexOf(dateParts[1].toLowerCase());
        if (monthIdx !== -1) return new Date(currentYear, monthIdx, parseInt(dateParts[2]), hours, minutes);
      }
    }
    return null;
  } catch { return null; }
};

type Member = {
  id: string;
  name: string;
};

const getRelativeTime = (timestamp: Timestamp) => {
  if (!timestamp || !(timestamp instanceof Timestamp)) return "unknown";
  const postedDate = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - postedDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

export default function RideDetailsPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { userId } = useFirebaseAuth();
  const insets = useSafeAreaInsets();

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [userGender, setUserGender] = useState<string | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);

  const { shouldPrompt, requestPermission, openSettings, markDismissed } =
    useNotificationOptInPrompt(userId);
  const { registerForPush } = usePushNotifications();

  const handleEnableNotifications = async () => {
    try {
      if (notifDenied) {
        await openSettings();
        return;
      }

      const status = await requestPermission();
      setNotifDenied(status === "denied");
      if (status === "granted") {
        await registerForPush?.();
      }
    } catch (error) {
      console.error("Notification prompt failed", error);
    } finally {
      setShowNotifPrompt(false);
      pendingNavRef.current?.();
      pendingNavRef.current = null;
    }
  };

  const handleDismissNotifications = async () => {
    try {
      await markDismissed();
    } catch (error) {
      console.error("Failed to mark notification prompt dismissed", error);
    } finally {
      setShowNotifPrompt(false);
      pendingNavRef.current?.();
      pendingNavRef.current = null;
    }
  };

  useEffect(() => {
    const fetchRide = async () => {
      if (!id || typeof id !== "string") return;

      try {
        const docRef = doc(db, "rides", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setRide({
            id: docSnap.id,
            from: data.from,
            to: data.to,
            date: data.date,
            time: data.time,
            seats: data.seats,
            notes: data.notes ?? "",
            createdAt: data.createdAt ?? Timestamp.now(),
            memberIds: data.memberIds ?? [],
            genderPref: data.genderPref ?? "N",
            hostId: data.hostId ?? null,
            archived: data.archived ?? false,
          });
        } else {
          console.warn("No such ride!");
        }
      } catch (err) {
        console.error("Error fetching ride:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
  }, [id]);

  useEffect(() => {
    if (!userId) return;

    const fetchUserGender = async () => {
      try {
        const snap = await getDoc(doc(db, "users", userId));
        if (snap.exists()) {
          setUserGender(snap.data().gender ?? null);
        }
      } catch (error) {
        console.error("Error fetching user gender:", error);
      }
    };

    fetchUserGender();
  }, [userId]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!ride) return;

      const fetched: Member[] = [];
      for (const uid of ride.memberIds) {
        try {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const fullName =
              [data.first_name, data.last_name].filter(Boolean).join(" ") ||
              data.username ||
              "Anonymous";
            fetched.push({ id: uid, name: fullName });
          } else {
            fetched.push({ id: uid, name: "Unknown User" });
          }
        } catch (err) {
          console.error("Failed to fetch member", uid, err);
        }
      }

      setMembers(fetched);
    };

    fetchMembers();
  }, [ride]);

  const handleJoinRide = async () => {
    if (!userId || !ride?.id) return;

    if (ride.archived) {
      Alert.alert("Ride Unavailable", "This ride has been archived.");
      return;
    }

    const rdt = parseRideDateTime(ride.date, ride.time);
    if (rdt && new Date() >= rdt) {
      Alert.alert("Ride Started", "This ride has already started and cannot be joined.");
      return;
    }

    const rideGenderPref = ride.genderPref ?? "N";
    const requiresSpecificGender = rideGenderPref !== "N";

    if (requiresSpecificGender) {
      if (!userGender) {
        Alert.alert(
          "Set Your Gender",
          "Update your gender in your profile to join gender-restricted rides."
        );
        return;
      }

      if (rideGenderPref !== userGender) {
        const restrictedLabel =
          rideGenderPref === "M"
            ? "men"
            : rideGenderPref === "F"
            ? "women"
            : "non-binary riders";

        Alert.alert(
          "Restricted Ride",
          `This ride is reserved for ${restrictedLabel}.`
        );
        return;
      }
    }

    try {
      const rideRef = doc(db, "rides", ride.id);
      const updates: Record<string, any> = {
        memberIds: arrayUnion(userId),
      };
      if (!ride.hostId) {
        updates.hostId = userId;
      }
      await updateDoc(rideRef, updates);

      const goToChat = () => {
        router.push({
          pathname: "/(stack)/ride/[id]/chat",
          params: { id: ride.id },
        });
      };

      const res = await shouldPrompt();
      console.log("[notif prompt][join] decision", res);
      if (res.shouldShow) {
        setNotifDenied(res.permissionStatus === "denied");
        pendingNavRef.current = goToChat;
        setShowNotifPrompt(true);
      } else {
        if (res.permissionStatus === "granted") {
          await registerForPush?.();
        }
        goToChat();
      }
    } catch (err) {
      console.error("Error joining ride:", err);
      Alert.alert("Join Failed", "Could not join this ride. Please try again.");
    }
  };

  if (loading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg={darkTheme.bg}>
        <Spinner size="large" color={ACCENT} />
      </Box>
    );
  }

  if (!ride) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" px="$4" bg={darkTheme.bg}>
        <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.body, textAlign: "center", marginBottom: SPACE.lg }}>
          This ride couldn&apos;t be found. It may have been deleted.
        </Text>
        <Button onPress={() => router.back()} bg={ACCENT}>
          <Text color={darkTheme.bg} style={{ fontWeight: TYPE.weight.semibold }}>Go Back</Text>
        </Button>
      </Box>
    );
  }

  const alreadyJoined = userId ? ride.memberIds.includes(userId) : false;
  const rideDateTime = parseRideDateTime(ride.date, ride.time);
  const rideStarted = rideDateTime ? new Date() >= rideDateTime : false;
  const canJoin = !ride.archived && !rideStarted;
  const genderPrefLabel =
    ride.genderPref === "M" ? "Men only"
    : ride.genderPref === "F" ? "Women only"
    : ride.genderPref === "NB" ? "Non-binary only"
    : null;

  return (
    <Box flex={1} bg={darkTheme.bg}>
      <NavHeader
        title={`${ride.from} → ${ride.to}`}
        subtitle={`${ride.date} · ${ride.time}`}
      />

      <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Info card */}
        <View style={{ backgroundColor: darkTheme.surface, borderRadius: 12, borderWidth: 1, borderColor: darkTheme.border, padding: SPACE.lg, marginBottom: SPACE.lg }}>
          {/* Seats + gender */}
          <View style={{ flexDirection: "row", gap: SPACE.md, marginBottom: SPACE.md }}>
            <View style={{ flex: 1, backgroundColor: darkTheme.raised, borderRadius: 8, padding: SPACE.md, alignItems: "center" }}>
              <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, marginBottom: 2 }}>Seats left</Text>
              <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.bold }}>{ride.seats}</Text>
            </View>
            {genderPrefLabel && (
              <View style={{ flex: 1, backgroundColor: darkTheme.raised, borderRadius: 8, padding: SPACE.md, alignItems: "center" }}>
                <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, marginBottom: 2 }}>Riders</Text>
                <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold }}>{genderPrefLabel}</Text>
              </View>
            )}
          </View>

          {/* Notes */}
          {ride.notes ? (
            <View style={{ borderTopWidth: 1, borderTopColor: darkTheme.raised, paddingTop: SPACE.md, marginBottom: SPACE.sm }}>
              <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, marginBottom: SPACE.xs }}>Notes</Text>
              <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.body, lineHeight: TYPE.size.body * TYPE.leading.relaxed }}>{ride.notes}</Text>
            </View>
          ) : null}

          {/* Posted time */}
          <Text style={{ color: darkTheme.textGhost, fontSize: TYPE.size.label, marginTop: ride.notes ? SPACE.sm : 0 }}>
            Posted {getRelativeTime(ride.createdAt)}
          </Text>
        </View>

        {/* Members */}
        {members.length > 0 && (
          <View style={{ marginBottom: SPACE.lg }}>
            <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, fontWeight: TYPE.weight.medium, marginBottom: SPACE.sm, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Group · {members.length} {members.length === 1 ? "member" : "members"}
            </Text>
            <View style={{ backgroundColor: darkTheme.surface, borderRadius: 12, borderWidth: 1, borderColor: darkTheme.border, overflow: "hidden" }}>
              {members.map((member, i) => (
                <View
                  key={member.id}
                  style={{
                    paddingHorizontal: SPACE.lg,
                    paddingVertical: SPACE.md,
                    flexDirection: "row",
                    alignItems: "center",
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: darkTheme.raised,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: member.id === ride.hostId ? ACCENT : darkTheme.borderStrong, marginRight: SPACE.md }} />
                  <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.body, flex: 1 }}>{member.name}</Text>
                  {member.id === ride.hostId && (
                    <Text style={{ color: ACCENT, fontSize: TYPE.size.label, fontWeight: TYPE.weight.medium }}>Host</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: insets.bottom + SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: darkTheme.raised, backgroundColor: darkTheme.bg }}>
        {alreadyJoined ? (
          <Button
            size="lg"
            backgroundColor={ACCENT}
            onPress={() => router.push({ pathname: "/(stack)/ride/[id]/chat", params: { id: ride.id } })}
          >
            <Text color={darkTheme.bg} style={{ fontWeight: TYPE.weight.bold, fontSize: TYPE.size.body }}>Open Chat</Text>
          </Button>
        ) : !canJoin ? (
          <Button size="lg" backgroundColor={darkTheme.raised} disabled>
            <Text color={darkTheme.textGhost} style={{ fontWeight: TYPE.weight.bold, fontSize: TYPE.size.body }}>
              {ride.archived ? "Archived" : "Ride Started"}
            </Text>
          </Button>
        ) : (
          <Button size="lg" backgroundColor={ACCENT} onPress={handleJoinRide}>
            <Text color={darkTheme.bg} style={{ fontWeight: TYPE.weight.bold, fontSize: TYPE.size.body }}>Join Ride</Text>
          </Button>
        )}
      </View>

      <NotificationOptInModal
        visible={showNotifPrompt}
        isDenied={notifDenied}
        onEnable={handleEnableNotifications}
        onClose={handleDismissNotifications}
      />
    </Box>
  );
}
