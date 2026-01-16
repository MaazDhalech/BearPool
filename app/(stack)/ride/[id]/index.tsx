import { NotificationOptInModal } from "@/components/NotificationOptInModal";
import { useNotificationOptInPrompt } from "@/hooks/useNotificationOptInPrompt";
import { db } from "@/services/firebaseConfig";
import { useAuth } from "@clerk/clerk-expo";
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
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const { userId } = useAuth();
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

  const handleEnableNotifications = async () => {
    try {
      if (notifDenied) {
        await openSettings();
        return;
      }

      const status = await requestPermission();
      setNotifDenied(status === "denied");
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
      await updateDoc(rideRef, {
        memberIds: arrayUnion(userId),
      });

      const goToChat = () => {
        router.push({
          pathname: "/(stack)/ride/[id]/chat",
          params: { id: ride.id },
        });
      };

      const res = await shouldPrompt();
      if (res.shouldShow) {
        setNotifDenied(res.permissionStatus === "denied");
        pendingNavRef.current = goToChat;
        setShowNotifPrompt(true);
      } else {
        goToChat();
      }
    } catch (err) {
      console.error("Error joining ride:", err);
    }
  };

  if (loading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg="#121212">
        <Spinner size="large" />
        <Text mt="$4" color="#a0a0a0">
          Loading ride details...
        </Text>
      </Box>
    );
  }

  if (!ride) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" px="$4" bg="#121212">
        <Text fontSize="$lg" color="$red500">
          Ride not found.
        </Text>
        <Button mt="$4" onPress={() => router.back()} bg="#3a7bd5">
          <Text color="white">Go Back</Text>
        </Button>
      </Box>
    );
  }

  const alreadyJoined = userId ? ride.memberIds.includes(userId) : false;
  const genderPrefLabel =
    ride.genderPref === "M"
      ? "Men only"
      : ride.genderPref === "F"
      ? "Women only"
      : ride.genderPref === "NB"
      ? "Non-binary only"
      : "No preference";

  return (
    <Box flex={1} bg="#121212" pt={insets.top}>
      {/* Header with Back Button */}
      <HStack
        alignItems="center"
        px="$4"
        py="$3"
        borderBottomWidth="$1"
        borderBottomColor="#333"
      >
        <Pressable
          onPress={() => router.back()}
          p="$2"
          borderRadius="$full"
          mr="$3"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <Heading size="lg" color="white" flex={1}>
          Ride Details
        </Heading>
      </HStack>

      <ScrollView 
        px="$4" 
        pt="$4" 
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <Box
          p="$4"
          borderRadius="$lg"
          borderWidth="$1"
          borderColor="#333"
          backgroundColor="#1e1e1e"
          mb="$4"
        >
          <VStack space="sm">
            <Heading size="lg" color="white">
              {ride.from} → {ride.to}
            </Heading>

            <Text color="#a0a0a0">
              {ride.date}, {ride.time}
            </Text>
            <Text color="#a0a0a0">
              {ride.seats} seat{ride.seats > 1 ? "s" : ""} available
            </Text>
            <Text color="#a0a0a0">
              Gender preference: {genderPrefLabel}
            </Text>

            {ride.notes && (
              <Text color="#a0a0a0" mt="$1">
                Notes: {ride.notes}
              </Text>
            )}

            <Text mt="$1" color="#666" fontSize="$xs">
              Posted {getRelativeTime(ride.createdAt)}
            </Text>

            {/* Group Members */}
            {members.length > 0 && (
              <Box mt="$4">
                <Text color="#aaaaaa" fontSize="$sm" mb="$2">
                  Group Members:
                </Text>
                <VStack space="xs">
                  {members.map((member) => (
                    <Text key={member.id} color="white" fontSize="$sm">
                      • {member.name}
                    </Text>
                  ))}
                </VStack>
              </Box>
            )}

            {/* Action Buttons */}
            <VStack space="sm" mt="$6">
            {alreadyJoined ? (
              <Button
                size="md"
                backgroundColor="#3a7bd5"
                onPress={() =>
                  router.push({
                    pathname: "/(stack)/ride/[id]/chat",
                    params: { id: ride.id },
                  })
                }
              >
                <Text color="white">View Chat</Text>
              </Button>
            ) : (
              <Button size="md" backgroundColor="#3a7bd5" onPress={handleJoinRide}>
                <Text color="white">Join Ride</Text>
              </Button>
            )}
            </VStack>
          </VStack>
        </Box>
      </ScrollView>
      <NotificationOptInModal
        visible={showNotifPrompt}
        isDenied={notifDenied}
        onEnable={handleEnableNotifications}
        onClose={handleDismissNotifications}
      />
    </Box>
  );
}
