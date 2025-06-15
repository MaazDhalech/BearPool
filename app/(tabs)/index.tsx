import { db } from "@/services/firebaseConfig";
import {
  Box,
  Button,
  HStack,
  Heading,
  Input,
  InputField,
  ScrollView,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import { Timestamp, collection, getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { RefreshControl } from "react-native";

// Define Ride type
type Ride = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  seats: number;
  notes?: string;
  createdAt: Timestamp;
};

// Relative time formatter
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
  const [refreshing, setRefreshing] = useState(false);

  const fetchRides = async () => {
    try {
      const q = query(collection(db, "rides"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      const ridesData: Ride[] = querySnapshot.docs.map((doc) => {
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
        };
      });

      setRides(ridesData);
    } catch (error) {
      console.error("Error fetching rides:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRides();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchRides();
  }, []);

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
      py="$6"
      bg="$backgroundLight"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Heading size="xl" mb="$4" color="$textDark">
        Upcoming Ride Groups
      </Heading>

      <Input mb="$6" size="md" variant="outline">
        <InputField
          placeholder="Search by location or destination..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </Input>

      <VStack space="lg">
        {filteredRides.map((ride) => (
          <Box
            key={ride.id}
            p="$4"
            borderRadius="$lg"
            borderWidth="$1"
            borderColor="$coolGray300"
            bg="$backgroundLight0"
          >
            <VStack space="xs">
              <Text fontWeight="$bold" fontSize="$md">
                {ride.from} → {ride.to}
              </Text>
              <Text color="$coolGray500">
                {ride.date}, {ride.time}
              </Text>
              <Text color="$coolGray500">
                {ride.seats} seat{ride.seats > 1 ? "s" : ""} available
              </Text>
              {ride.notes && (
                <Text color="$coolGray400" mt="$1">
                  {ride.notes}
                </Text>
              )}
              <Text mt="$1" color="$coolGray400" fontSize="$xs">
                Posted {getRelativeTime(ride.createdAt)}
              </Text>
            </VStack>

            <HStack space="md" justifyContent="flex-end" mt="$4">
              <Button
                size="sm"
                action="primary"
                variant="solid"
                onPress={() => router.push({ pathname: "/(stack)/ride/[id]", params: { id: ride.id } })}

              >
                <Text color="white">View Details</Text>
              </Button>
              <Button
                size="sm"
                action="secondary"
                variant="outline"
                borderColor="$primary500"
                onPress={() => {
                  // TODO: Implement join functionality (e.g., update Firestore or state)
                  console.log(`Joining ride with ID: ${ride.id}`);
                }}
              >
                <Text color="$primary500">Join Group</Text>
              </Button>
            </HStack>

          </Box>
        ))}

        {filteredRides.length === 0 && (
          <Text color="$coolGray500" textAlign="center" mt="$6">
            No ride groups found.
          </Text>
        )}
      </VStack>
    </ScrollView>
  );
}
