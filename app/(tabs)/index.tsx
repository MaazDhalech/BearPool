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
  useToast
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs, increment, onSnapshot,
  orderBy,
  query, writeBatch
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
};

type User = {
  id: string;
  avatar?: string;
  genderPref?: string;
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

export default function HomeScreen() {
  const router = useRouter();
  const toast = useToast();
  const { userId } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [rides, setRides] = useState<Ride[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [userGenderPref, setUserGenderPref] = useState<string>("N");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Refs to track listeners and prevent memory leaks
  const ridesUnsubscribeRef = useRef<(() => void) | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchUserGenderPref = async () => {
    if (!userId) return;
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserGenderPref(data.pref || "N");
      }
    } catch (err) {
      console.error("Error fetching user gender pref:", err);
    }
  };

  const fetchUsersForRides = async (rideData: Ride[]) => {
    const usersData: Record<string, User> = {};
    
    // Get all unique user IDs from all rides
    const allUserIds = new Set<string>();
    rideData.forEach(ride => {
      ride.memberIds.forEach(uid => allUserIds.add(uid));
    });

    // Fetch user data for all unique user IDs
    for (const uid of allUserIds) {
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          usersData[uid] = {
            id: uid,
            avatar: data.avatar || data.profileImage || DEFAULT_AVATAR,
            genderPref: data.pref || "N",
          };
        } else {
          usersData[uid] = {
            id: uid,
            avatar: DEFAULT_AVATAR,
            genderPref: "N",
          };
        }
      } catch (err) {
        console.error(`Error fetching user ${uid}:`, err);
        usersData[uid] = {
          id: uid,
          avatar: DEFAULT_AVATAR,
          genderPref: "N",
        };
      }
    }

    setUsers(prev => ({ ...prev, ...usersData }));
  };

  const setupRealTimeListener = () => {
    // Clean up existing listener
    if (ridesUnsubscribeRef.current) {
      ridesUnsubscribeRef.current();
    }

    const rideQuery = query(
      collection(db, "rides"),
      orderBy("createdAt", sortOrder === "newest" ? "desc" : "asc")
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      rideQuery,
      async (snapshot) => {
        try {
          const rideData: Ride[] = snapshot.docs.map((doc) => {
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
            };
          });

          setRides(rideData);
          
          // Fetch user data for new rides
          await fetchUsersForRides(rideData);
          
        } catch (err) {
          console.error("Error processing real-time update:", err);
        }
      },
      (error) => {
        console.error("Real-time listener error:", error);
        // Fall back to manual fetch if real-time fails
        fetchRidesManually();
      }
    );

    ridesUnsubscribeRef.current = unsubscribe;
  };

  const fetchRidesManually = async () => {
    try {
      const rideQuery = query(
        collection(db, "rides"),
        orderBy("createdAt", sortOrder === "newest" ? "desc" : "asc")
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
        };
      });

      setRides(rideData);
      await fetchUsersForRides(rideData);
    } catch (err) {
      console.error("Error fetching rides manually:", err);
    }
  };

  // Initialize data and set up listeners
  useEffect(() => {
    const initializeData = async () => {
      await fetchUserGenderPref();
      setupRealTimeListener();
    };

    initializeData();

    // Clean up listener on unmount
    return () => {
      if (ridesUnsubscribeRef.current) {
        ridesUnsubscribeRef.current();
      }
    };
  }, [sortOrder]); // Re-setup when sort order changes

  // Handle app state changes (foreground/background)
  useEffect(() => {
const handleAppStateChange = (nextAppState: AppStateStatus) => {
  if (
    appStateRef.current.match(/inactive|background/) &&
    nextAppState === 'active'
  ) {
    // App came to foreground, refresh data
    setupRealTimeListener();
  }
  appStateRef.current = nextAppState;
};

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => subscription?.remove();
  }, [sortOrder]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUserGenderPref();
    await fetchRidesManually();
    setRefreshing(false);
  };

const handleJoinRide = async (rideId: string) => {
  if (!userId) return;
  try {
    const rideRef = doc(db, "rides", rideId);
    const userRef = doc(db, "users", userId);
    
    // Perform both updates in a batch to ensure atomicity
    const batch = writeBatch(db);
    
    // Add user to ride's memberIds
    batch.update(rideRef, {
      memberIds: arrayUnion(userId),
    });
    
    // Increment user's ridesJoined count
    batch.update(userRef, {
      ridesJoined: increment(1),
    });
    
    await batch.commit();

    toast.show({
      placement: "top",
      duration: 3000,
      render: () => (
        <Box bg="$green600" px="$4" py="$3" borderRadius="$md">
          <Text color="white" fontWeight="$bold">Joined Group</Text>
          <Text color="white">You've successfully joined the ride.</Text>
        </Box>
      ),
    });
    
    setTimeout(() => {
      router.push({ pathname: "/(stack)/ride/[id]/chat", params: { id: rideId } });
    }, 500);
  } catch (err) {
    console.error("Error joining ride:", err);
    toast.show({
      placement: "top",
      duration: 3000,
      render: () => (
        <Box bg="$red600" px="$4" py="$3" borderRadius="$md">
          <Text color="white" fontWeight="$bold">Join Failed</Text>
          <Text color="white">Could not join this ride. Try again.</Text>
        </Box>
      ),
    });
  }
};

  const handleEditPress = (rideId: string) => {
    setOpenDropdown(null); // Close dropdown
    router.push({
      pathname: "/(stack)/ride/[id]/edit",
      params: { id: rideId },
    });
  };

  const filteredRides = rides.filter((ride) => {
    const qs = searchQuery.toLowerCase();
    return (
      (ride.from.toLowerCase().includes(qs) ||
       ride.to.toLowerCase().includes(qs)) &&
      (ride.genderPref === "N" ||
       ride.genderPref === userGenderPref ||
       userGenderPref === "N")
    );
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
        <Input
          flex={1}
          size="md"
          borderColor="#333"
          backgroundColor="#1e1e1e"
        >
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

      <VStack space="lg" pb="$16">
        {filteredRides.map((ride) => (
          <Box
            key={ride.id}
            p="$4"
            mb="$4"
            bg="#1e1e1e"
            borderWidth={1}
            borderColor="#333"
            borderRadius="$lg"
            position="relative"
          >
            <HStack justifyContent="space-between" alignItems="center" mb="$2">
              <Text fontWeight="$bold" fontSize="$md" color="white">
                {ride.from} → {ride.to}
              </Text>
              {ride.hostId === userId && (
                <Box position="relative">
                  <Pressable
                    onPress={() => setOpenDropdown(openDropdown === ride.id ? null : ride.id)}
                    p="$2"
                  >
                    <Text color="#a0a0a0" fontSize="$lg">⋮</Text>
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
                        <Text color="white" fontSize="$sm">Edit Post</Text>
                      </Pressable>
                    </Box>
                  )}  
                </Box>
              )}
            </HStack>

            <Text color="#a0a0a0">
              {ride.date}, {ride.time}
            </Text>
            <Text color="#a0a0a0">
              {ride.seats} seat{ride.seats > 1 ? "s" : ""} available
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
                        <AvatarImage source={{ uri: u.avatar }} alt="User avatar" />
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
                {ride.notes}
              </Text>
            )}

            <Text fontSize="$xs" color="#666" mb="$4">
              Posted {getRelativeTime(ride.createdAt)}
            </Text>

            <HStack space="md" justifyContent="flex-end">
              <Button
                size="sm"
                backgroundColor="#3a7bd5"
                onPress={() =>
                  router.push({
                    pathname: "/(stack)/ride/[id]",
                    params: { id: ride.id },
                  })
                }
              >
                <Text color="white">View Details</Text>
              </Button>

              {ride.memberIds.includes(userId!) ? (
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
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="#3a7bd5"
                  backgroundColor="transparent"
                  onPress={() => handleJoinRide(ride.id)}
                >
                  <Text color="#3a7bd5">Join Group</Text>
                </Button>
              )}
            </HStack>

            {/* Overlay to close dropdown when clicking outside */}
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
        ))}

        {filteredRides.length === 0 && (
          <Text color="#a0a0a0" textAlign="center" mt="$6">
            No ride groups found.
          </Text>
        )}
      </VStack>
    </ScrollView>
  );
}