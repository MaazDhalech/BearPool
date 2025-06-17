import { db } from "@/services/firebaseConfig";
import { useAuth } from "@clerk/clerk-expo";
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
import {
  Timestamp,
  arrayUnion,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";

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
            memberIds: data.memberIds ?? [],
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

  const handleJoinRide = async () => {
    if (!userId || !ride?.id) return;

    try {
      const rideRef = doc(db, "rides", ride.id);
      await updateDoc(rideRef, {
        memberIds: arrayUnion(userId),
      });

      // Redirect to group chat
      router.push({
        pathname: "/(stack)/ride/[id]/chat",
        params: { id: ride.id },
      });
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

  const alreadyJoined = ride.memberIds.includes(userId!);

  return (
    <ScrollView px="$4" pt="$8" bg="#121212" contentContainerStyle={{ paddingBottom: 100 }}>
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

          {ride.notes && (
            <Text color="#a0a0a0" mt="$1">
              Notes: {ride.notes}
            </Text>
          )}

          <Text mt="$1" color="#666" fontSize="$xs">
            Posted {getRelativeTime(ride.createdAt)}
          </Text>

          <VStack space="sm" mt="$4">
            {alreadyJoined ? (
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
                size="md"
                backgroundColor="#3a7bd5"
                onPress={handleJoinRide}
              >
                <Text color="white">Join Ride</Text>
              </Button>
            )}

            <Button
              variant="outline"
              borderColor="#3a7bd5"
              backgroundColor="transparent"
              onPress={() => router.back()}
            >
              <Text color="#3a7bd5">Back</Text>
            </Button>
          </VStack>
        </VStack>
      </Box>
    </ScrollView>
  );
}
