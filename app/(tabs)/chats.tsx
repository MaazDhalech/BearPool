import { db } from "@/services/firebaseConfig";
import { useAuth } from "@clerk/clerk-expo";
import {
  Avatar,
  Box,
  HStack,
  Heading,
  Pressable,
  ScrollView,
  Spinner,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl } from "react-native";

export default function ChatsScreen() {
  const [chatGroups, setChatGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { userId } = useAuth();
  const router = useRouter();

  const fetchChatGroups = useCallback(async () => {
    setError(null);
    try {
      const q = query(
        collection(db, "rides"),
        where("memberIds", "array-contains", userId)
      );
      const snapshot = await getDocs(q);

      const rideData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const rideId = docSnap.id;
          const ride = docSnap.data();

          const messagesRef = collection(db, "rides", rideId, "messages");
          const messagesQuery = query(
            messagesRef,
            orderBy("timestamp", "desc"),
            limit(1)
          );
          const messagesSnapshot = await getDocs(messagesQuery);
          const latestMessage = messagesSnapshot.docs[0]?.data();

          return {
            id: rideId,
            title: `${ride.from} → ${ride.to}`,
            preview: latestMessage?.text ?? "No messages yet",
            timestamp:
              latestMessage?.timestamp?.toDate().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }) ?? "—",
            members: ride.memberIds ?? [],
          };
        })
      );

      setChatGroups(rideData);
    } catch (err) {
      console.error("Error fetching chat groups:", err);
      setError("Failed to load your ride chats.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchChatGroups();
  }, [userId, fetchChatGroups]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchChatGroups();
  };

  return (
    <ScrollView
      bg="$backgroundLight"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Box px="$4" py="$6">
        <Heading size="xl" mb="$4" color="$textDark">
          Your Ride Groups
        </Heading>

        {loading ? (
          <HStack justifyContent="center" mt="$10">
            <Spinner size="large" color="$primary500" />
          </HStack>
        ) : error ? (
          <Text color="$red600" mt="$4" textAlign="center">
            {error}
          </Text>
        ) : chatGroups.length === 0 ? (
          <Text color="$coolGray500" mt="$4" textAlign="center">
            You’re not part of any ride groups yet.
          </Text>
        ) : (
          <VStack space="lg">
            {chatGroups.map((group) => (
              <Pressable
                key={group.id}
                borderRadius="$lg"
                bg="$white"
                p="$4"
                onPress={() =>
                  router.push({
                    pathname: "/(stack)/ride/[id]/chat",
                    params: { id: group.id },
                  })
                }
              >
                <VStack space="xs">
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontWeight="$bold" fontSize="$md" color="$textDark">
                      {group.title}
                    </Text>
                    <Text fontSize="$xs" color="$coolGray500">
                      {group.timestamp}
                    </Text>
                  </HStack>

                  <VStack space="xs">
                    <Text color="$coolGray600" numberOfLines={1}>
                      {group.preview}
                    </Text>
                    <Text color="$coolGray400" fontSize="$xs" italic>
                      Tap to view chat →
                    </Text>
                  </VStack>

                  <HStack space="sm" mt="$2">
                    {group.members.map((uid: string, index: number) => (
                      <Avatar key={index} size="sm">
                        <Text>{uid.slice(0, 2).toUpperCase()}</Text>
                      </Avatar>
                    ))}
                  </HStack>
                </VStack>
              </Pressable>
            ))}
          </VStack>
        )}
      </Box>
    </ScrollView>
  );
}
