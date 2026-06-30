import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { TYPE } from "@/constants/Typography";
import { SPACE } from "@/constants/Spacing";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { SpringPressable } from "@/components/SpringPressable";
import { NavHeader } from "@/components/ui/NavHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterPill } from "@/components/ui/FilterPill";
import { LoadingState } from "@/components/ui/LoadingState";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  HStack,
  Heading,
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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Image, RefreshControl, TouchableOpacity, View } from "react-native";

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
  isTest: boolean;
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
    if (ride.archived) return true;

    const rideDateTime = parseRideDateTime(ride.date, ride.time);
    if (!rideDateTime) return false;

    const hoursSinceRide = (new Date().getTime() - rideDateTime.getTime()) / (1000 * 60 * 60);
    return hoursSinceRide >= 24;
  } catch {
    return false;
  }
};

const autoArchiveStartedRides = (rides: Ride[]): void => {
  const now = new Date();
  for (const ride of rides) {
    if (ride.archived || ride.isTest) continue;
    const rideDateTime = parseRideDateTime(ride.date, ride.time);
    if (!rideDateTime) continue;
    const hoursSince = (now.getTime() - rideDateTime.getTime()) / (1000 * 60 * 60);
    if (hoursSince >= 24) {
      archiveRide(ride.id);
    }
  }
};

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
  const { userId } = useFirebaseAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [userGender, setUserGender] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [showRestrictedRides, setShowRestrictedRides] = useState(false);

  const ridesUnsubscribeRef = useRef<(() => void) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const didInitBlockedRef = useRef(false);

  const fetchUserGender = async () => {
    if (!userId) return;
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserGender(data.gender || null);
        setIsAdmin(data.isAdmin === true);
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
              isTest: data.isTest ?? false,
            };

            return processedRide;
          });

          autoArchiveStartedRides(rideData);

          // Filter out rides with blocked users
          const filteredRideData = filterRidesWithBlockedUsers(rideData);

          setRides(filteredRideData);
          setLoading(false);
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
          isTest: data.isTest ?? false,
        };
      });

      autoArchiveStartedRides(rideData);

      // Filter out rides with blocked users
      const filteredRideData = filterRidesWithBlockedUsers(rideData);

      setRides(filteredRideData);
      setLoading(false);
      await fetchUsersForRides(filteredRideData);
    } catch (err) {
      console.error("Error fetching rides manually:", err);
      setLoading(false);
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

  // Re-filter rides whenever the blocked-users list changes - including when it
  // becomes empty (unblocking the last user must un-hide their rides). The
  // initial population is skipped here since initializeData() already sets up
  // the listener with the freshly-fetched list.
  useEffect(() => {
    if (!didInitBlockedRef.current) {
      didInitBlockedRef.current = true;
      return;
    }
    setupRealTimeListener();
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
          <Text color={darkTheme.textPrimary} fontWeight="$bold">
            {isMissing ? "Set Your Gender" : "Restricted Ride"}
          </Text>
          <Text color={darkTheme.textPrimary}>
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
              <Text color={darkTheme.textPrimary} fontWeight="$bold">
                Ride Archived
              </Text>
              <Text color={darkTheme.textPrimary}>
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
              <Text color={darkTheme.textPrimary} fontWeight="$bold">
                Ride Has Started
              </Text>
              <Text color={darkTheme.textPrimary}>
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
              <Text color={darkTheme.textPrimary} fontWeight="$bold">
                Ride Full
              </Text>
              <Text color={darkTheme.textPrimary}>This ride is full.</Text>
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
              <Text color={darkTheme.textPrimary} fontWeight="$bold">
                Already Joined
              </Text>
              <Text color={darkTheme.textPrimary}>You&apos;re already part of this ride.</Text>
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
              <Text color={darkTheme.textPrimary} fontWeight="$bold">
                Finish Profile
              </Text>
              <Text color={darkTheme.textPrimary}>
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
            <Text color={darkTheme.textPrimary} fontWeight="$bold">
              You&apos;re in
            </Text>
            <Text color={darkTheme.textPrimary}>Head to the chat to connect with your group.</Text>
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
            <Text color={darkTheme.textPrimary} fontWeight="$bold">
              Join Failed
            </Text>
            <Text color={darkTheme.textPrimary}>Could not join this ride. Please try again.</Text>
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

  const filteredRides = rides
    .filter((ride) => {
      // Hide archived rides
      if (ride.archived) {
        return false;
      }

      // Hide test rides from non-admins
      if (ride.isTest && !isAdmin) {
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
    })
    .sort((a, b) => {
      const dateA = parseRideDateTime(a.date, a.time);
      const dateB = parseRideDateTime(b.date, b.time);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      const diff = dateA.getTime() - dateB.getTime();
      // "newest" = closest date first (ascending), "oldest" = farthest date first (descending)
      return sortOrder === "newest" ? diff : -diff;
    });

  const toggleSortOrder = () =>
    setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"));

  return (
    <View style={{ flex: 1, backgroundColor: darkTheme.bg }}>
      <LinearGradient
        colors={["rgba(255, 190, 92, 0.28)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }}
        pointerEvents="none"
      />
      <NavHeader title="Home" showBack={false} />
      <ScrollView
        style={{ backgroundColor: "transparent" }}
        contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
            progressBackgroundColor={darkTheme.surface}
          />
        }
      >
        {/* Search + Sort */}
        <HStack alignItems="center" space="sm" mb="$3">
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by location..."
          />
          <FilterPill
            label={sortOrder === "newest" ? "Soonest" : "Latest"}
            icon={sortOrder === "newest" ? "arrow-up" : "arrow-down"}
            onPress={toggleSortOrder}
            accessibilityLabel={`Sort by ${sortOrder === "newest" ? "soonest" : "latest"}, tap to change`}
          />
        </HStack>

        {/* Gender filter toggle */}
        <HStack alignItems="center" justifyContent="space-between" mb="$4" px="$1">
          <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.caption }}>
            Gender-restricted rides
          </Text>
          <FilterPill
            label={showRestrictedRides ? "Hide" : "Show"}
            active={showRestrictedRides}
            onPress={() => setShowRestrictedRides((prev) => !prev)}
            accessibilityLabel={`${showRestrictedRides ? "Hide" : "Show"} gender-restricted rides`}
          />
        </HStack>

        {/* Ride cards */}
        <VStack space="md" pb="$16">
          {loading && <LoadingState label="Loading rides…" />}
          {filteredRides.map((ride) => {
            if (typeof ride !== "object" || ride === null) return null;

            const requiresGender = ride.genderPref !== "N";
            const missingGender = requiresGender && !userGender;
            const mismatchedGender = requiresGender && !!userGender && ride.genderPref !== userGender;
            const isLocked = missingGender || mismatchedGender;
            const restrictedLabel =
              ride.genderPref === "M" ? "men"
              : ride.genderPref === "F" ? "women"
              : "non-binary riders";

            const genderPrefLabel =
              ride.genderPref === "M" ? "Men only"
              : ride.genderPref === "F" ? "Women only"
              : ride.genderPref === "NB" ? "Non-binary only"
              : null;

            const rideStarted = hasRideStarted(ride);
            const canJoin = !rideStarted && !ride.archived;

            const cardOpacity = isLocked || !canJoin ? 0.55 : 1;

            return (
              <TouchableOpacity
                key={ride.id}
                activeOpacity={isLocked || !canJoin ? 0.55 : 0.85}
                onPress={() =>
                  router.push({ pathname: "/(stack)/ride/[id]", params: { id: ride.id } })
                }
                style={{ opacity: cardOpacity }}
              >
                <View
                  style={{
                    backgroundColor: darkTheme.surface,
                    borderWidth: 1,
                    borderColor: isLocked || !canJoin ? darkTheme.borderStrong : darkTheme.border,
                    borderRadius: 12,
                    padding: SPACE.lg,
                  }}
                >
                  {/* Route + host menu */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: SPACE.sm }}>
                    <View style={{ flex: 1, marginRight: SPACE.sm }}>
                      <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold, lineHeight: TYPE.size.heading * TYPE.leading.tight }}>
                        {ride.to}
                      </Text>
                      <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, fontWeight: TYPE.weight.medium, marginTop: 2 }}>
                        from {ride.from}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                      {ride.isTest && (
                        <View style={{ backgroundColor: "#2e2610", paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: 99, borderWidth: 1, borderColor: ACCENT }}>
                          <Text style={{ color: ACCENT, fontSize: TYPE.size.micro, fontWeight: TYPE.weight.bold }}>TEST</Text>
                        </View>
                      )}
                      {ride.hostId === userId && (
                        <View style={{ position: "relative" }}>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setOpenDropdown(openDropdown === ride.id ? null : ride.id);
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ padding: 4 }}
                          >
                            <Ionicons name="ellipsis-vertical" size={18} color={darkTheme.textSecondary} />
                          </TouchableOpacity>
                          {openDropdown === ride.id && (
                            <View
                              style={{
                                position: "absolute",
                                top: 28,
                                right: 0,
                                backgroundColor: darkTheme.raised,
                                borderWidth: 1,
                                borderColor: darkTheme.border,
                                borderRadius: 8,
                                paddingVertical: SPACE.xs,
                                minWidth: 100,
                                zIndex: 10,
                              }}
                            >
                              <TouchableOpacity
                                onPress={(e) => { e.stopPropagation?.(); handleEditPress(ride.id); }}
                                style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm }}
                              >
                                <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.body }}>Edit Post</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Metadata row */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.sm }}>
                    <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.caption }}>
                      {ride.date} · {ride.time}
                    </Text>
                    <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.caption }}>
                      {ride.seats} {ride.seats === 1 ? "seat" : "seats"} left
                    </Text>
                    {genderPrefLabel && (
                      <View style={{ backgroundColor: darkTheme.raised, paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.micro }}>{genderPrefLabel}</Text>
                      </View>
                    )}
                  </View>

                  {/* Notes - 1 line max */}
                  {ride.notes ? (
                    <Text
                      style={{ color: "#808080", fontSize: TYPE.size.caption, marginBottom: SPACE.sm }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {ride.notes}
                    </Text>
                  ) : null}

                  {/* Members + posted time */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACE.xs }}>
                    {ride.memberIds.length > 0 ? (
                      <HStack space="xs" alignItems="center">
                        {ride.memberIds.slice(0, 5).map((uid) => {
                          const u = users[uid] || { avatar: DEFAULT_AVATAR };
                          return (
                            <Avatar key={uid} size="xs" bgColor={darkTheme.surface}>
                              <AvatarImage source={{ uri: u.avatar }} alt="User avatar" />
                            </Avatar>
                          );
                        })}
                        {ride.memberIds.length > 5 && (
                          <View style={{ backgroundColor: darkTheme.raised, borderRadius: 99, width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.micro }}>+{ride.memberIds.length - 5}</Text>
                          </View>
                        )}
                      </HStack>
                    ) : <View />}
                    <Text style={{ color: darkTheme.textGhost, fontSize: TYPE.size.label }}>
                      {rideStarted ? "Started" : getRelativeTime(ride.createdAt)}
                    </Text>
                  </View>

                  {/* Divider */}
                  <View style={{ height: 1, backgroundColor: darkTheme.raised, marginVertical: SPACE.md }} />

                  {/* CTA row */}
                  <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                    {isLocked ? (
                      <SpringPressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          missingGender
                            ? showGenderRestrictionToast("missing")
                            : showGenderRestrictionToast("restricted", restrictedLabel);
                        }}
                        style={{
                          paddingHorizontal: SPACE.lg,
                          paddingVertical: SPACE.sm,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: darkTheme.borderStrong,
                        }}
                      >
                        <Text style={{ color: darkTheme.textMuted, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold }}>
                          {missingGender ? "Set Gender" : "Restricted"}
                        </Text>
                      </SpringPressable>
                    ) : ride.memberIds.includes(userId!) ? (
                      <SpringPressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          router.push({ pathname: "/(stack)/ride/[id]/chat", params: { id: ride.id } });
                        }}
                        style={{
                          paddingHorizontal: SPACE.lg,
                          paddingVertical: SPACE.sm,
                          borderRadius: 8,
                          backgroundColor: ACCENT,
                        }}
                      >
                        <Text style={{ color: darkTheme.bg, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold }}>View Chat</Text>
                      </SpringPressable>
                    ) : !canJoin ? (
                      <View style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: 8, borderWidth: 1, borderColor: darkTheme.borderStrong }}>
                        <Text style={{ color: darkTheme.textGhost, fontSize: TYPE.size.body }}>{rideStarted ? "Started" : "Closed"}</Text>
                      </View>
                    ) : (
                      <SpringPressable
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleJoinRide(ride.id);
                        }}
                        disabled={ride.seats <= 0}
                        style={{
                          paddingHorizontal: SPACE.lg,
                          paddingVertical: SPACE.sm,
                          borderRadius: 8,
                          backgroundColor: ride.seats <= 0 ? darkTheme.raised : ACCENT,
                        }}
                      >
                        <Text style={{
                          color: ride.seats <= 0 ? darkTheme.textMuted : darkTheme.bg,
                          fontSize: TYPE.size.body,
                          fontWeight: TYPE.weight.semibold,
                        }}>
                          {ride.seats <= 0 ? "Full" : "Join Group"}
                        </Text>
                      </SpringPressable>
                    )}
                  </View>

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
                </View>
              </TouchableOpacity>
            );
          })}

          {!loading && filteredRides.length === 0 && (
            <FadeSlideIn delay={100}>
              <VStack alignItems="center" mt="$8" px="$6" space="md">
                <Image
                  source={require("../../assets/images/empty-bear.png")}
                  style={{ width: 260, height: 260 }}
                  resizeMode="contain"
                />
                <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold, textAlign: "center" }}>
                  {searchQuery ? "No rides match your search" : "No rides posted yet"}
                </Text>
                <Text style={{ color: darkTheme.textSecondary, textAlign: "center", fontSize: TYPE.size.body, lineHeight: TYPE.size.body * TYPE.leading.relaxed }}>
                  {searchQuery
                    ? "Try a different location or clear the search."
                    : "Be the first to post a ride and find people to split the cost with."}
                </Text>
                {!searchQuery && (
                  <SpringPressable
                    onPress={() => router.push("/(tabs)/post")}
                    style={{
                      marginTop: SPACE.sm,
                      backgroundColor: ACCENT,
                      paddingVertical: SPACE.md,
                      paddingHorizontal: SPACE["2xl"],
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: darkTheme.bg, fontWeight: TYPE.weight.semibold, fontSize: TYPE.size.body }}>
                      + Post a Ride
                    </Text>
                  </SpringPressable>
                )}
              </VStack>
            </FadeSlideIn>
          )}
        </VStack>
      </ScrollView>
    </View>
  );
}
