import { db } from "@/services/firebaseConfig";
import {
    Box,
    Button,
    Heading,
    ScrollView,
    Spinner,
    Text,
    VStack,
} from "@gluestack-ui/themed";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Timestamp, doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

// Type for a single ride
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
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg="$backgroundLight">
        <Spinner size="large" />
        <Text mt="$4">Loading ride details...</Text>
      </Box>
    );
  }

  if (!ride) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" px="$4" bg="$backgroundLight">
        <Text fontSize="$lg" color="$red500">
          Ride not found.
        </Text>
        <Button mt="$4" onPress={() => router.back()}>
          <Text color="white">Go Back</Text>
        </Button>
      </Box>
    );
  }

  return (
    <ScrollView px="$4" py="$6" bg="$backgroundLight">
      <VStack space="md">
        <Heading size="lg">Ride from {ride.from} → {ride.to}</Heading>
        <Text>Date: {ride.date}</Text>
        <Text>Time: {ride.time}</Text>
        <Text>Seats Available: {ride.seats}</Text>
        {ride.notes ? <Text>Notes: {ride.notes}</Text> : null}
        <Text fontSize="$sm" color="$coolGray500">
          Posted {getRelativeTime(ride.createdAt)}
        </Text>

        <Button
          size="md"
          mt="$4"
          action="primary"
          onPress={() => {
            // Placeholder — integrate join logic later
            console.log(`Joined ride ${ride.id}`);
          }}
        >
          <Text color="white">Join Ride</Text>
        </Button>

        <Button
          mt="$2"
          variant="outline"
          action="secondary"
          onPress={() => router.back()}
        >
          <Text color="$primary500">Back</Text>
        </Button>
      </VStack>
    </ScrollView>
  );
}
