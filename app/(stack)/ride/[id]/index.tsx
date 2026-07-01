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
  Avatar,
  AvatarImage,
  Box,
  ScrollView,
  Text,
} from "@gluestack-ui/themed";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable } from "react-native";
import { initialsAvatarUrl } from "@/utils/avatar";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Timestamp,
  arrayUnion,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { toast } from "@/components/ui/Dialog";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavHeader } from "@/components/ui/NavHeader";
import { LoadingState } from "@/components/ui/LoadingState";

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
  avatar: string;
};

// Small icon-backed stat tile used in the details hero row.
function StatTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: darkTheme.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: darkTheme.border,
        padding: SPACE.md,
        gap: 6,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          backgroundColor: ACCENT + "1A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={17} color={ACCENT} />
      </View>
      <Text
        style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.bold }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label }}>{label}</Text>
    </View>
  );
}

function CTAButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.85 : 1,
        backgroundColor: ACCENT,
        borderRadius: 14,
        paddingVertical: SPACE.md + 2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: SPACE.sm,
      })}
    >
      <Text style={{ color: darkTheme.bg, fontWeight: TYPE.weight.bold, fontSize: TYPE.size.body }}>
        {label}
      </Text>
      <Ionicons name={icon} size={18} color={darkTheme.bg} />
    </Pressable>
  );
}

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
            fetched.push({
              id: uid,
              name: fullName,
              avatar: data.avatar || initialsAvatarUrl(data.first_name, data.last_name),
            });
          } else {
            fetched.push({ id: uid, name: "Unknown User", avatar: initialsAvatarUrl() });
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
      toast("This ride has been archived.", { type: "error" });
      return;
    }

    const rdt = parseRideDateTime(ride.date, ride.time);
    if (rdt && new Date() >= rdt) {
      toast("This ride has already started and cannot be joined.", { type: "error" });
      return;
    }

    const rideGenderPref = ride.genderPref ?? "N";
    const requiresSpecificGender = rideGenderPref !== "N";

    if (requiresSpecificGender) {
      if (!userGender) {
        toast("Update your gender in your profile to join gender-restricted rides.", {
          type: "info",
        });
        return;
      }

      if (rideGenderPref !== userGender) {
        const restrictedLabel =
          rideGenderPref === "M"
            ? "men"
            : rideGenderPref === "F"
            ? "women"
            : "non-binary riders";

        toast(`This ride is reserved for ${restrictedLabel}.`, { type: "info" });
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
      toast("Could not join this ride. Please try again.", { type: "error" });
    }
  };

  if (loading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg={darkTheme.bg}>
        <LoadingState label="Loading ride…" />
      </Box>
    );
  }

  if (!ride) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" px="$4" bg={darkTheme.bg}>
        <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.body, textAlign: "center", marginBottom: SPACE.lg }}>
          This ride couldn&apos;t be found. It may have been deleted.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{ backgroundColor: ACCENT, borderRadius: 12, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md }}
        >
          <Text color={darkTheme.bg} style={{ fontWeight: TYPE.weight.semibold }}>Go Back</Text>
        </Pressable>
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
      <NavHeader title="Ride Details" />

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        {/* ── Route hero ── */}
        <LinearGradient
          colors={["#2a2318", darkTheme.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            marginHorizontal: SPACE.lg,
            marginTop: SPACE.lg,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: darkTheme.border,
            padding: SPACE.xl,
          }}
        >
          {/* Origin */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
            <View style={{ width: 22, alignItems: "center" }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: darkTheme.textSecondary }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: darkTheme.textFaint, fontSize: TYPE.size.micro, fontWeight: TYPE.weight.bold, letterSpacing: 1 }}>FROM</Text>
              <Text style={{ color: darkTheme.textBright, fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.semibold }} numberOfLines={1}>
                {ride.from}
              </Text>
            </View>
          </View>

          {/* Connector */}
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: 22, alignItems: "center" }}>
              <View style={{ width: 2, height: 24, backgroundColor: darkTheme.borderStrong, marginVertical: 4 }} />
            </View>
          </View>

          {/* Destination */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
            <View style={{ width: 22, alignItems: "center" }}>
              <Ionicons name="location" size={20} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: darkTheme.textFaint, fontSize: TYPE.size.micro, fontWeight: TYPE.weight.bold, letterSpacing: 1 }}>TO</Text>
              <Text
                style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold, lineHeight: TYPE.size.heading * TYPE.leading.tight }}
                numberOfLines={2}
              >
                {ride.to}
              </Text>
            </View>
          </View>

          {/* Date + time chips */}
          <View style={{ flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: darkTheme.bg + "80", borderRadius: 10, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm }}>
              <Ionicons name="calendar-outline" size={14} color={ACCENT} />
              <Text style={{ color: darkTheme.textBright, fontSize: TYPE.size.label, fontWeight: TYPE.weight.medium }}>{ride.date}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: darkTheme.bg + "80", borderRadius: 10, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm }}>
              <Ionicons name="time-outline" size={14} color={ACCENT} />
              <Text style={{ color: darkTheme.textBright, fontSize: TYPE.size.label, fontWeight: TYPE.weight.medium }}>{ride.time}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Stat tiles ── */}
        <View style={{ flexDirection: "row", gap: SPACE.md, paddingHorizontal: SPACE.lg, marginTop: SPACE.md }}>
          <StatTile icon="people-outline" label={ride.seats === 1 ? "Seat left" : "Seats left"} value={String(ride.seats)} />
          {genderPrefLabel ? (
            <StatTile icon="male-female-outline" label="Riders" value={genderPrefLabel} />
          ) : (
            <StatTile icon="time-outline" label="Posted" value={getRelativeTime(ride.createdAt)} />
          )}
        </View>

        {/* ── Notes ── */}
        {ride.notes ? (
          <View style={{ marginHorizontal: SPACE.lg, marginTop: SPACE.md, backgroundColor: darkTheme.surface, borderRadius: 16, borderWidth: 1, borderColor: darkTheme.border, padding: SPACE.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.sm }}>
              <Ionicons name="document-text-outline" size={16} color={darkTheme.textSecondary} />
              <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, fontWeight: TYPE.weight.medium, textTransform: "uppercase", letterSpacing: 0.5 }}>Notes</Text>
            </View>
            <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.body, lineHeight: TYPE.size.body * TYPE.leading.relaxed }}>{ride.notes}</Text>
          </View>
        ) : null}

        {/* ── Members ── */}
        {members.length > 0 && (
          <View style={{ paddingHorizontal: SPACE.lg, marginTop: SPACE.lg }}>
            <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, fontWeight: TYPE.weight.medium, marginBottom: SPACE.sm, marginLeft: SPACE.xs, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Group · {members.length} {members.length === 1 ? "member" : "members"}
            </Text>
            <View style={{ backgroundColor: darkTheme.surface, borderRadius: 16, borderWidth: 1, borderColor: darkTheme.border, overflow: "hidden" }}>
              {members.map((member, i) => (
                <View
                  key={member.id}
                  style={{
                    paddingHorizontal: SPACE.lg,
                    paddingVertical: SPACE.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: darkTheme.raised,
                  }}
                >
                  <Avatar size="sm" bgColor={darkTheme.surfaceAlt}>
                    <AvatarImage source={{ uri: member.avatar }} alt="member" />
                  </Avatar>
                  <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.body, fontWeight: TYPE.weight.medium, flex: 1 }} numberOfLines={1}>
                    {member.name}
                  </Text>
                  {member.id === ride.hostId && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ACCENT + "22", paddingHorizontal: SPACE.sm, paddingVertical: 3, borderRadius: 99 }}>
                      <Ionicons name="star" size={11} color={ACCENT} />
                      <Text style={{ color: ACCENT, fontSize: TYPE.size.micro, fontWeight: TYPE.weight.bold, letterSpacing: 0.5 }}>HOST</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Posted footer (shown here when the gender tile took the posted slot) */}
        {genderPrefLabel && (
          <Text style={{ color: darkTheme.textGhost, fontSize: TYPE.size.label, textAlign: "center", marginTop: SPACE.lg }}>
            Posted {getRelativeTime(ride.createdAt)}
          </Text>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: insets.bottom + SPACE.md, paddingTop: SPACE.md, backgroundColor: darkTheme.bg }}>
        {alreadyJoined ? (
          <CTAButton
            icon="chatbubble-ellipses"
            label="Open Chat"
            onPress={() => router.push({ pathname: "/(stack)/ride/[id]/chat", params: { id: ride.id } })}
          />
        ) : !canJoin ? (
          <View style={{ backgroundColor: darkTheme.raised, borderRadius: 14, paddingVertical: SPACE.md + 2, alignItems: "center" }}>
            <Text style={{ color: darkTheme.textGhost, fontWeight: TYPE.weight.bold, fontSize: TYPE.size.body }}>
              {ride.archived ? "Archived" : "Ride Started"}
            </Text>
          </View>
        ) : (
          <CTAButton icon="arrow-forward" label="Join Ride" onPress={handleJoinRide} />
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
