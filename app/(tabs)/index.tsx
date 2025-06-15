import { db } from "@/services/firebaseConfig";
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
  VStack
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import { Timestamp, collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { RefreshControl } from "react-native";

const DEFAULT_AVATAR = "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

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
};

type User = {
  id: string;
  avatar?: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [rides, setRides] = useState<Ride[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const fetchRidesAndUsers = async () => {
    try {
      const ridesQuery = query(
        collection(db, "rides"), 
        orderBy("createdAt", sortOrder === "newest" ? "desc" : "asc")
      );
      const ridesSnapshot = await getDocs(ridesQuery);

      const ridesData: Ride[] = ridesSnapshot.docs.map((doc) => {
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
          memberIds: data.memberIds ?? []
        };
      });

      const allUserIds = Array.from(new Set(
        ridesData.flatMap(ride => ride.memberIds)
      ));

      const usersData: Record<string, User> = {};
      for (const userId of allUserIds) {
        const userDoc = await getDocs(query(
          collection(db, "users"), 
          where("id", "==", userId)
        ));
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          usersData[userId] = {
            id: userId,
            avatar: userData.avatar || DEFAULT_AVATAR
          };
        } else {
          usersData[userId] = {
            id: userId,
            avatar: DEFAULT_AVATAR
          };
        }
      }

      setUsers(usersData);
      setRides(ridesData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRidesAndUsers();
    setRefreshing(false);
  };

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === "newest" ? "oldest" : "newest");
  };

  useEffect(() => {
    fetchRidesAndUsers();
  }, [sortOrder]);

  const filteredRides = rides.filter((ride) => {
    const query = searchQuery.toLowerCase();
    return (
      ride.from.toLowerCase().includes(query) ||
      ride.to.toLowerCase().includes(query)
    );
  });

  return (
    <ScrollView
      px="$4"
      pt="$2"
      bg="#121212"
      contentContainerStyle={{
        paddingBottom: 120
      }}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={handleRefresh}
          tintColor="#a0a0a0"
        />
      }
    >
      <Heading 
        size="xl" 
        color="white" 
        mb="$6"
        mt="$16"
      >
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
              
              {ride.memberIds.length > 0 && (
                <HStack space="sm" mt="$2" alignItems="center">
                  <Text color="#a0a0a0" mr="$2" fontSize="$sm">
                    Members:
                  </Text>
                  <HStack space="sm">
                    {ride.memberIds.slice(0, 5).map((userId) => {
                      const user = users[userId] || { id: userId, avatar: DEFAULT_AVATAR };
                      return (
                        <Avatar key={userId} size="sm" bgColor="#1e1e1e">
                          <AvatarImage 
                            source={{ uri: user.avatar }} 
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
                onPress={() => router.push({ pathname: "/(stack)/ride/[id]", params: { id: ride.id } })}
              >
                <Text color="white">View Details</Text>
              </Button>
              <Button
                size="sm"
                variant="outline"
                borderColor="#3a7bd5"
                backgroundColor="transparent"
                onPress={() => {
                  console.log(`Joining ride with ID: ${ride.id}`);
                }}
              >
                <Text color="#3a7bd5">Join Group</Text>
              </Button>
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