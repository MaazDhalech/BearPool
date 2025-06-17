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
  orderBy,
  query,
  updateDoc
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { RefreshControl } from "react-native";

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
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

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

  // Fetch user's gender preference
  const fetchUserGenderPref = async () => {
    if (!userId) return;
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserGenderPref(data.pref || "N"); // Changed to use 'pref'
      }
    } catch (err) {
      console.error("Error fetching user gender pref:", err);
    }
  };

  const fetchRidesAndUsers = async () => {
    try {
      // First fetch user's gender preference
      await fetchUserGenderPref();

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
        };
      });
  
      const usersData: Record<string, User> = {};
      for (const ride of rideData) {
        for (const uid of ride.memberIds) {
          if (!usersData[uid]) {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              usersData[uid] = {
                id: uid,
                avatar: data.avatar || data.profileImage || DEFAULT_AVATAR,
                genderPref: data.pref || "N", // Changed to use 'pref'
              };
            } else {
              usersData[uid] = {
                id: uid,
                avatar: DEFAULT_AVATAR,
                genderPref: "N",
              };
            }
          }
        }
      }
  
      setUsers(usersData);
      setRides(rideData);
    } catch (err) {
      console.error("Error fetching rides/users:", err);
    }
  };

  useEffect(() => {
    fetchRidesAndUsers();
  }, [sortOrder]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRidesAndUsers();
    setRefreshing(false);
  };

  const handleJoinRide = async (rideId: string) => {
    if (!userId) return;
  
    try {
      const rideRef = doc(db, "rides", rideId);
      await updateDoc(rideRef, {
        memberIds: arrayUnion(userId),
      });
  
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
            <Text color="white" fontWeight="$bold">Join Failed</Text>
            <Text color="white">Could not join this ride. Try again.</Text>
          </Box>
        ),
      });
    }
  };
  
  const filteredRides = rides.filter((ride) => {
    const matchesSearch = 
      ride.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ride.to.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesGenderPref = 
      ride.genderPref === "N" ||
      ride.genderPref === userGenderPref ||
      userGenderPref === "N";
    
    return matchesSearch && matchesGenderPref;
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
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#a0a0a0" />
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
          <Text color="#3a7bd5" fontSize="$2xl" fontWeight="$bold">⇅</Text>
        </Pressable>
      </HStack>

      <VStack space="lg" pb="$16">
        {filteredRides.map((ride) => (
          <Box
            key={ride.id}
            p="$4"
            borderRadius="$lg"
            borderWidth="$1"
            borderColor="#333"
            backgroundColor="#1e1e1e"
            mb="$4"
          >
            <VStack space="xs">
              <Text fontWeight="$bold" fontSize="$md" color="white">
                {ride.from} → {ride.to}
              </Text>
              <Text color="#a0a0a0">
                {ride.date}, {ride.time}
              </Text>
              <Text color="#a0a0a0">
                {ride.seats} seat{ride.seats > 1 ? "s" : ""} available
              </Text>
              {ride.genderPref !== "N" && (
                <Text color="#a0a0a0" fontSize="$sm">
                  Gender preference: {ride.genderPref === "M" ? "Male" : 
                                  ride.genderPref === "F" ? "Female" : 
                                  "Non-binary"}
                </Text>
              )}
              {ride.memberIds.length > 0 && (
                <HStack space="sm" mt="$2" alignItems="center">
                  <Text color="#a0a0a0" mr="$2" fontSize="$sm">
                    Members:
                  </Text>
                  <HStack space="sm">
                    {ride.memberIds.slice(0, 5).map((uid) => {
                      const user = users[uid] || { avatar: DEFAULT_AVATAR };
                      return (
                        <Avatar key={uid} size="sm" bgColor="#1e1e1e">
                          <AvatarImage source={{ uri: user.avatar }} alt="User avatar" />
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
                <Text color="#a0a0a0" mt="$1">
                  {ride.notes}
                </Text>
              )}
              <Text mt="$1" color="#666" fontSize="$xs">
                Posted {getRelativeTime(ride.createdAt)}
              </Text>
            </VStack>

            <HStack space="md" justifyContent="flex-end" mt="$4">
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
                <Box
                  px="$3"
                  py="$2"
                  borderWidth="$1"
                  borderRadius="$md"
                  borderColor="#3a7bd5"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="#3a7bd5" fontSize="$sm">
                    You are already in this group
                  </Text>
                </Box>
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