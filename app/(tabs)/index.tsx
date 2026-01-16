import { db } from "@/services/firebaseConfig";
import { useAuth } from "@clerk/clerk-expo";
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  HStack,
  Heading,
  Input,
  InputField,
  Pressable,
  ScrollView,
  Text,
  VStack,
  useToast,
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, RefreshControl } from "react-native";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

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
  genderPref: string;
  hostId: string;
  archived: boolean;
  archivedAt: Timestamp | null;
  startTime: Timestamp | null;
  isActive: boolean;
};

type User = {
  id: string;
  avatar?: string;
  gender?: string;
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
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

// === Date/Time parsing utilities ===
const parseRideDateTime = (dateStr: string, timeStr: string): Date | null => {
  try {
    // Parse date like "January 16" - assuming current year
    const currentYear = new Date().getFullYear();
    const dateTimeStr = `${dateStr}, ${currentYear} ${timeStr}`;

    // Try parsing with different formats
    const parsedDate = new Date(dateTimeStr);

    // If parsing fails, try alternative formats
    if (isNaN(parsedDate.getTime())) {
      // Try with different time format
      const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeParts) {
        let [_, hours, minutes, period] = timeParts;
        let hourNum = parseInt(hours);
        if (period.toUpperCase() === "PM" && hourNum < 12) hourNum += 12;
        if (period.toUpperCase() === "AM" && hourNum === 12) hourNum = 0;

        const dateParts = dateStr.match(/(\w+)\s+(\d+)/);
        if (dateParts) {
          const [__, monthName, day] = dateParts;
          const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];
          const monthIndex = monthNames.findIndex(
            (m) => m.toLowerCase() === monthName.toLowerCase(),
          );

          if (monthIndex !== -1) {
            return new Date(
              currentYear,
              monthIndex,
              parseInt(day),
              hourNum,
              parseInt(minutes),
            );
          }
        }
      }
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.error("Error parsing date/time:", error);
    return null;
  }
};

// === Archive checking utilities ===
const shouldHideRideBasedOnDateTime = (ride: Ride): boolean => {
  try {
    // Always hide archived rides
    if (ride.archived) {
      return true;
    }

    // Parse ride date/time
    const rideDateTime = parseRideDateTime(ride.date, ride.time);
    if (!rideDateTime) {
      console.warn(`Could not parse date/time for ride ${ride.id}`);
      return false;
    }

    const now = new Date();

    // Hide if ride date/time is more than 5 days in the past
    const daysSinceRide = Math.floor(
      (now.getTime() - rideDateTime.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceRide > 5) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error checking ride date/time:", error);
    return false;
  }
};

// REMOVED COMPLETELY: shouldArchiveRideBasedOnDateTime function
// We will NOT check if rides should be archived anymore

const archiveRide = async (rideId: string): Promise<void> => {
  try {
    const rideDocRef = doc(db, "rides", rideId);
    await updateDoc(rideDocRef, {
      archived: true,
      archivedAt: serverTimestamp(),
      isActive: false,
    });

    console.log(`✅ Successfully archived ride ${rideId}`);
  } catch (error) {
    console.error(`❌ Error archiving ride ${rideId}:`, error);
  }
};

// === Check if ride has started ===
const hasRideStarted = (ride: Ride): boolean => {
  try {
    // Parse ride date/time
    const rideDateTime = parseRideDateTime(ride.date, ride.time);
    if (!rideDateTime) {
      console.warn(`Could not parse date/time for ride ${ride.id}`);
      return false;
    }

    const now = new Date();
    return now.getTime() >= rideDateTime.getTime();
  } catch (error) {
    console.error("Error checking if ride has started:", error);
    return false;
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const toast = useToast();
  const { userId } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [rides, setRides] = useState<Ride[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [userGender, setUserGender] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showRestrictedRides, setShowRestrictedRides] = useState(false);

  const ridesUnsubscribeRef = useRef<(() => void) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchUserGender = async () => {
    if (!userId) return;
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserGender(data.gender || null);
      }
    } catch (err) {
      console.error("Error fetching user gender:", err);
    }
  };

  const fetchBlockedUsers = async () => {
    if (!userId) return;
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setBlockedUsers(data.blockedUsers || []);
      }
    } catch (err) {
      console.error("Error fetching blocked users:", err);
    }
  };

  const fetchUsersForRides = async (rideData: Ride[]) => {
    const usersData: Record<string, User> = {};

    const allUserIds = new Set<string>();
    rideData.forEach((ride) => {
      ride.memberIds.forEach((uid) => allUserIds.add(uid));
    });
    const newUsersData: Record<string, User> = {};
    const uidsToFetch: string[] = [];

    allUserIds.forEach((uid) => {
      if (!users[uid]) {
        uidsToFetch.push(uid);
      }
    });

    for (const uid of uidsToFetch) {
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          usersData[uid] = {
            id: uid,
            avatar: data.avatar || data.profileImage || DEFAULT_AVATAR,
            gender: data.gender || undefined,
          };
        } else {
          usersData[uid] = {
            id: uid,
            avatar: DEFAULT_AVATAR,
            gender: undefined,
          };
        }
      } catch (err) {
        console.error(`Error fetching user ${uid}:`, err);
        usersData[uid] = {
          id: uid,
          avatar: DEFAULT_AVATAR,
          gender: undefined,
        };
      }
    }

    setUsers((prev) => ({ ...prev, ...usersData }));
  };

  const filterRidesWithBlockedUsers = (rideData: Ride[]) => {
    return rideData.filter((ride) => {
      // Check if any member in the ride is in the blocked users list
      const hasBlockedUser = ride.memberIds.some((memberId) =>
        blockedUsers.includes(memberId),
      );
      return !hasBlockedUser;
    });
  };

  // REMOVED COMPLETELY: checkAndArchiveOldRides function
  // We will NOT automatically archive rides anymore

  const setupRealTimeListener = () => {
    if (ridesUnsubscribeRef.current) {
      ridesUnsubscribeRef.current();
    }

    // SIMPLIFIED QUERY: Only order by createdAt to avoid index error
    const rideQuery = query(
      collection(db, "rides"),
      orderBy("createdAt", sortOrder === "newest" ? "desc" : "asc"),
    );

    const unsubscribe = onSnapshot(
      rideQuery,
      async (snapshot) => {
        try {
          const rideData: Ride[] = snapshot.docs.map((doc) => {
            const data = doc.data();

            const processedRide = {
              id: doc.id,
              from: data.from ?? "Unknown",
              to: data.to ?? "Unknown",
              date: data.date ?? "Unknown",
              time: data.time ?? "Unknown",
              seats: data.seats ?? 1,
              notes: data.notes ?? "",
              createdAt: data.createdAt ?? Timestamp.now(),
              memberIds: data.memberIds ?? [],
              genderPref: data.genderPref ?? "N",
              hostId: data.hostId ?? "",
              archived: data.archived ?? false,
              archivedAt: data.archivedAt ?? null,
              startTime: data.startTime ?? null,
              isActive: data.isActive ?? true,
            };

            return processedRide;
          });

          // REMOVED: checkAndArchiveOldRides call
          // We will NOT automatically archive rides

          // Filter out rides with blocked users
          const filteredRideData = filterRidesWithBlockedUsers(rideData);

          setRides(filteredRideData);
          await fetchUsersForRides(filteredRideData);
        } catch (err) {
          console.error("Error processing real-time update:", err);
          fetchRidesManually();
        }
      },
      (error) => {
        console.error("Real-time listener error:", error);
        fetchRidesManually();
      },
    );

    ridesUnsubscribeRef.current = unsubscribe;
  };

  const fetchRidesManually = async () => {
    try {
      // SIMPLIFIED QUERY: Only order by createdAt to avoid index error
      const rideQuery = query(
        collection(db, "rides"),
        orderBy("createdAt", sortOrder === "newest" ? "desc" : "asc"),
      );
      const rideSnapshot = await getDocs(rideQuery);

      const rideData: Ride[] = rideSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          from: data.from ?? "Unknown",
          to: data.to ?? "Unknown",
          date: data.date ?? "Unknown",
          time: data.time ?? "Unknown",
          seats: data.seats ?? 1,
          notes: data.notes ?? "",
          createdAt: data.createdAt ?? Timestamp.now(),
          memberIds: data.memberIds ?? [],
          genderPref: data.genderPref ?? "N",
          hostId: data.hostId ?? "",
          archived: data.archived ?? false,
          archivedAt: data.archivedAt ?? null,
          startTime: data.startTime ?? null,
          isActive: data.isActive ?? true,
        };
      });

      // REMOVED: checkAndArchiveOldRides call
      // We will NOT automatically archive rides

      // Filter out rides with blocked users
      const filteredRideData = filterRidesWithBlockedUsers(rideData);

      setRides(filteredRideData);
      await fetchUsersForRides(filteredRideData);
    } catch (err) {
      console.error("Error fetching rides manually:", err);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await fetchUserGender();
      await fetchBlockedUsers();
      setupRealTimeListener();
    };

    initializeData();

    return () => {
      if (ridesUnsubscribeRef.current) {
        ridesUnsubscribeRef.current();
      }
    };
  }, [sortOrder]);

  // Re-filter rides when blocked users list changes
  useEffect(() => {
    if (blockedUsers.length > 0) {
      setupRealTimeListener();
    }
  }, [blockedUsers]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        setupRealTimeListener();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => subscription?.remove();
  }, [sortOrder]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUserGender();
    await fetchBlockedUsers();
    await fetchRidesManually();
    setRefreshing(false);
  };

  const [toastMessage, setToastMessage] = useState<{
    type: string;
    title: string;
    description: string;
  } | null>(null);

  // Simple toast alternative
  const showToast = (
    type: "success" | "error" | "warning",
    title: string,
    description: string,
  ) => {
    console.log(`${type.toUpperCase()}: ${title} - ${description}`);

    // Try the original toast, but fallback if it fails
    try {
      setToastMessage({ type, title, description });
      setTimeout(() => setToastMessage(null), 3000);
    } catch (error) {
      console.error("Toast error:", error);
    }
  };

  const showGenderRestrictionToast = (
    reason: "missing" | "restricted",
    label?: string,
  ) => {
    const isMissing = reason === "missing";
    toast.show({
      placement: "top",
      duration: 3000,
      render: () => (
        <Box
          bg={isMissing ? "$yellow600" : "$red600"}
          px="$4"
          py="$3"
          borderRadius="$md"
        >
          <Text color="white" fontWeight="$bold">
            {isMissing ? "Set Your Gender" : "Restricted Ride"}
          </Text>
          <Text color="white">
            {isMissing
              ? "Update your gender in Profile to join restricted rides."
              : `This ride is reserved for ${label}.`}
          </Text>
        </Box>
      ),
    });
  };

  const handleJoinRide = async (rideId: string) => {
    if (!userId) return;

    try {
      const rideRef = doc(db, "rides", rideId);
      const rideSnap = await getDoc(rideRef);

      if (!rideSnap.exists()) {
        throw new Error("Ride doesn't exist");
      }

      const rideData = rideSnap.data();

      // Check if ride is archived
      if (rideData.archived) {
        toast.show({
          placement: "top",
          duration: 3000,
          render: () => (
            <Box bg="$red600" px="$4" py="$3" borderRadius="$md">
              <Text color="white" fontWeight="$bold">
                Ride Archived
              </Text>
              <Text color="white">
                This ride has been archived and cannot be joined.
              </Text>
            </Box>
          ),
        });
        return;
      }

      // Check if ride has already started
      const rideDateTime = parseRideDateTime(rideData.date, rideData.time);
      const now = new Date();

      if (rideDateTime && now.getTime() >= rideDateTime.getTime()) {
        toast.show({
          placement: "top",
          duration: 3000,
          render: () => (
            <Box bg="$red600" px="$4" py="$3" borderRadius="$md">
              <Text color="white" fontWeight="$bold">
                Ride Has Started
              </Text>
              <Text color="white">
                This ride has already started and cannot be joined.
              </Text>
            </Box>
          ),
        });
        return;
      }

      const currentSeats = rideData.seats ?? 0;
      const rideGenderPref = rideData.genderPref ?? "N";
      const requiresSpecificGender = rideGenderPref !== "N";
      const restrictedLabel =
        rideGenderPref === "M"
          ? "men"
          : rideGenderPref === "F"
            ? "women"
            : "non-binary riders";

      if (currentSeats <= 0) {
        toast.show({
          placement: "top",
          duration: 3000,
          render: () => (
            <Box bg="$red600" px="$4" py="$3" borderRadius="$md">
              <Text color="white" fontWeight="$bold">
                Ride Full
              </Text>
              <Text color="white">No seats available for this ride.</Text>
            </Box>
          ),
        });
        return;
      }

      if (rideData.memberIds?.includes(userId)) {
        toast.show({
          placement: "top",
          duration: 3000,
          render: () => (
            <Box bg="$yellow600" px="$4" py="$3" borderRadius="$md">
              <Text color="white" fontWeight="$bold">
                Already Joined
              </Text>
              <Text color="white">You're already part of this ride.</Text>
            </Box>
          ),
        });
        return;
      }

      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        toast.show({
          placement: "top",
          duration: 3000,
          render: () => (
            <Box bg="$yellow600" px="$4" py="$3" borderRadius="$md">
              <Text color="white" fontWeight="$bold">
                Finish Profile
              </Text>
              <Text color="white">
                Complete your profile before joining rides.
              </Text>
            </Box>
          ),
        });
        return;
      }

      const riderGender = userSnap.data()?.gender ?? null;

      if (requiresSpecificGender) {
        if (!riderGender) {
          showGenderRestrictionToast("missing");
          return;
        }

        if (rideGenderPref !== riderGender) {
          showGenderRestrictionToast("restricted", restrictedLabel);
          return;
        }
      }

      if (currentSeats <= 0) {
        throw new Error("No seats available");
      }

      const batch = writeBatch(db);
      batch.update(rideRef, {
        memberIds: arrayUnion(userId),
        seats: increment(-1),
      });
      batch.update(userRef, {
        ridesJoined: increment(1),
      });

      await batch.commit();

      toast.show({
        placement: "top",
        duration: 3000,
        render: () => (
          <Box bg="$green600" px="$4" py="$3" borderRadius="$md">
            <Text color="white" fontWeight="$bold">
              Joined Ride
            </Text>
            <Text color="white">You've successfully joined the ride.</Text>
          </Box>
        ),
      });

      setTimeout(() => {
        router.push({
          pathname: "/(stack)/ride/[id]/chat",
          params: { id: rideId },
        });
      }, 500);
    } catch (err) {
      console.error("Error joining ride:", err);
      toast.show({
        placement: "top",
        duration: 3000,
        render: () => (
          <Box bg="$red600" px="$4" py="$3" borderRadius="$md">
            <Text color="white" fontWeight="$bold">
              Join Failed
            </Text>
            <Text color="white">
              {String(err) || "Could not join this ride. Try again."}
            </Text>
          </Box>
        ),
      });
    }
  };

  const handleEditPress = (rideId: string) => {
    setOpenDropdown(null);
    router.push({
      pathname: "/(stack)/ride/[id]/edit",
      params: { id: rideId },
    });
  };

  const filteredRides = rides.filter((ride) => {
    // Hide archived rides
    if (ride.archived) {
      return false;
    }

    // Hide rides that are more than 5 days old (based on ride date/time)
    if (shouldHideRideBasedOnDateTime(ride)) {
      return false;
    }

    const qs = searchQuery.toLowerCase();
    const matchesSearch =
      ride.from.toLowerCase().includes(qs) ||
      ride.to.toLowerCase().includes(qs);

    if (!matchesSearch) {
      return false;
    }

    const requiresGender = ride.genderPref !== "N";
    const missingGender = requiresGender && !userGender;
    const mismatchedGender =
      requiresGender && !!userGender && ride.genderPref !== userGender;
    const isRestricted = missingGender || mismatchedGender;

    if (!showRestrictedRides && isRestricted) {
      return false;
    }

    return true;
  });

  const toggleSortOrder = () =>
    setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"));

  return (
    <ScrollView
      px="$4"
      pt="$2"
      bg="#121212"
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#a0a0a0"
        />
      }
    >
      <Heading size="xl" color="white" mb="$6" mt="$16">
        Upcoming Ride Groups
      </Heading>

      <HStack alignItems="center" space="md" mb="$6">
        <Input flex={1} size="md" borderColor="#333" backgroundColor="#1e1e1e">
          <InputField
            placeholder="Search by location or destination..."
            placeholderTextColor="#666"
            color="white"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </Input>
        <Pressable
          onPress={toggleSortOrder}
          p="$2"
          bg="#1e1e1e"
          borderRadius="$md"
          borderWidth={1}
          borderColor="#333"
        >
          <Text color="#3a7bd5" fontSize="$2xl" fontWeight="$bold">
            ⇅
          </Text>
        </Pressable>
      </HStack>

      <HStack
        alignItems="center"
        justifyContent="space-between"
        mb="$4"
        px="$2"
      >
        <Text color="#a0a0a0" fontSize="$sm">
          Gender-restricted rides
        </Text>
        <Pressable
          onPress={() => setShowRestrictedRides((prev) => !prev)}
          px="$3"
          py="$2"
          borderRadius="$md"
          borderWidth={1}
          borderColor="#333"
          backgroundColor={showRestrictedRides ? "#1e3a5f" : "#1e1e1e"}
        >
          <Text color="#3a7bd5" fontWeight="$semibold">
            {showRestrictedRides ? "Hide" : "Show"}
          </Text>
        </Pressable>
      </HStack>

      <VStack space="lg" pb="$16">
        {filteredRides.map((ride) => {
          // Debug logging to catch any problematic data
          if (typeof ride !== "object" || ride === null) {
            console.error("Invalid ride data:", ride);
            return null;
          }

          const requiresGender = ride.genderPref !== "N";
          const missingGender = requiresGender && !userGender;
          const mismatchedGender =
            requiresGender && !!userGender && ride.genderPref !== userGender;
          const isLocked = missingGender || mismatchedGender;
          const restrictedLabel =
            ride.genderPref === "M"
              ? "men"
              : ride.genderPref === "F"
                ? "women"
                : "non-binary riders";

          // Check if ride has started
          const rideStarted = hasRideStarted(ride);
          const canJoin = !rideStarted && !ride.archived;

          return (
            <Box
              key={ride.id}
              p="$4"
              mb="$4"
              bg={isLocked || !canJoin ? "#2a2a2a" : "#1e1e1e"}
              borderWidth={1}
              borderColor={isLocked || !canJoin ? "#444" : "#333"}
              borderRadius="$lg"
              position="relative"
              opacity={isLocked || !canJoin ? 0.7 : 1}
            >
              {(isLocked || !canJoin) && (
                <Box
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom={0}
                  bg="rgba(0,0,0,0.5)"
                  justifyContent="center"
                  alignItems="center"
                  zIndex={1}
                  borderRadius="$lg"
                >
                  <Text
                    color="white"
                    fontWeight="$bold"
                    textAlign="center"
                    px="$4"
                  >
                    {isLocked
                      ? missingGender
                        ? "Set your gender in Profile to join gender-restricted rides."
                        : `This ride is for ${restrictedLabel} only.`
                      : rideStarted
                        ? "This ride has already started."
                        : "This ride cannot be joined."}
                  </Text>
                </Box>
              )}

              <HStack
                justifyContent="space-between"
                alignItems="center"
                mb="$2"
              >
                <Text fontWeight="$bold" fontSize="$md" color="white">
                  {ride.from} → {ride.to}
                </Text>
                {ride.hostId === userId && (
                  <Box position="relative">
                    <Pressable
                      onPress={() =>
                        setOpenDropdown(
                          openDropdown === ride.id ? null : ride.id,
                        )
                      }
                      p="$2"
                    >
                      <Text color="#a0a0a0" fontSize="$lg">
                        ⋮
                      </Text>
                    </Pressable>

                    {openDropdown === ride.id && (
                      <Box
                        position="absolute"
                        top="$8"
                        right="$0"
                        bg="#2a2a2a"
                        borderWidth={1}
                        borderColor="#333"
                        borderRadius="$md"
                        p="$2"
                        minWidth="$24"
                        zIndex={10}
                      >
                        <Pressable
                          onPress={() => handleEditPress(ride.id)}
                          p="$2"
                          borderRadius="$sm"
                          $pressed={{ bg: "#3a3a3a" }}
                        >
                          <Text color="white" fontSize="$sm">
                            Edit Post
                          </Text>
                        </Pressable>
                      </Box>
                    )}
                  </Box>
                )}
              </HStack>

              <Text color="#a0a0a0">
                {String(ride.date)} | {String(ride.time)}
              </Text>
              <Text color="#a0a0a0">
                {String(ride.seats)} seat{ride.seats > 1 ? "s" : ""} available
              </Text>
              <Text color="#a0a0a0" fontSize="$sm" mb="$2">
                Gender preference:{" "}
                {ride.genderPref === "M"
                  ? "Male"
                  : ride.genderPref === "F"
                    ? "Female"
                    : ride.genderPref === "NB"
                      ? "Non-binary"
                      : "No preference"}
              </Text>

              {ride.memberIds.length > 0 && (
                <HStack space="sm" mt="$2" alignItems="center" mb="$2">
                  <Text color="#a0a0a0" mr="$2" fontSize="$sm">
                    Members:
                  </Text>
                  <HStack space="sm">
                    {ride.memberIds.slice(0, 5).map((uid) => {
                      const u = users[uid] || { avatar: DEFAULT_AVATAR };
                      return (
                        <Avatar key={uid} size="sm" bgColor="#1e1e1e">
                          <AvatarImage
                            source={{ uri: u.avatar }}
                            alt="User avatar"
                          />
                        </Avatar>
                      );
                    })}
                    {ride.memberIds.length > 5 && (
                      <Box
                        bg="#3a7bd5"
                        borderRadius="$full"
                        w="$6"
                        h="$6"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text color="white" fontSize="$xs">
                          +{ride.memberIds.length - 5}
                        </Text>
                      </Box>
                    )}
                  </HStack>
                </HStack>
              )}

              {ride.notes && (
                <Text color="#a0a0a0" mb="$2">
                  {String(ride.notes)}
                </Text>
              )}

              <Text fontSize="$xs" color="#666" mb="$4">
                Posted {getRelativeTime(ride.createdAt)}
                {rideStarted && " • Ride has started"}
              </Text>

              <HStack space="md" justifyContent="flex-end">
                {/* View Details on the left */}
                <Button
                  size="sm"
                  backgroundColor={isLocked || !canJoin ? "#444" : "#3a7bd5"}
                  onPress={() =>
                    router.push({
                      pathname: "/(stack)/ride/[id]",
                      params: { id: ride.id },
                    })
                  }
                >
                  <Text color={isLocked || !canJoin ? "#888" : "white"}>
                    View Details
                  </Text>
                </Button>

                {/* Join Group (or View Chat) on the right */}
                {isLocked ? (
                  <Button
                    size="sm"
                    backgroundColor="#444"
                    onPress={() =>
                      missingGender
                        ? showGenderRestrictionToast("missing")
                        : showGenderRestrictionToast(
                            "restricted",
                            restrictedLabel,
                          )
                    }
                  >
                    <Text color="#888">
                      {missingGender ? "Set Gender" : "Restricted"}
                    </Text>
                  </Button>
                ) : ride.memberIds.includes(userId!) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="#3a7bd5"
                    backgroundColor="transparent"
                    onPress={() =>
                      router.push({
                        pathname: "/(stack)/ride/[id]/chat",
                        params: { id: ride.id },
                      })
                    }
                  >
                    <Text color="#3a7bd5">View Chat</Text>
                  </Button>
                ) : !canJoin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="#444"
                    backgroundColor="transparent"
                    isDisabled={true}
                  >
                    <Text color="#666">
                      {rideStarted ? "Started" : "Cannot Join"}
                    </Text>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="#3a7bd5"
                    backgroundColor="transparent"
                    onPress={() => handleJoinRide(ride.id)}
                    isDisabled={ride.seats <= 0}
                  >
                    <Text color={ride.seats <= 0 ? "#888" : "#3a7bd5"}>
                      {ride.seats <= 0 ? "Full" : "Join Group"}
                    </Text>
                  </Button>
                )}
              </HStack>

              {openDropdown === ride.id && (
                <Pressable
                  position="absolute"
                  top="$0"
                  left="$0"
                  right="$0"
                  bottom="$0"
                  onPress={() => setOpenDropdown(null)}
                  zIndex={5}
                />
              )}
            </Box>
          );
        })}

        {filteredRides.length === 0 && (
          <Text color="#a0a0a0" textAlign="center" mt="$6">
            No upcoming ride groups found.
          </Text>
        )}
      </VStack>
    </ScrollView>
  );
}
