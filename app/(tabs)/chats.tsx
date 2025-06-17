import { db } from "@/services/firebaseConfig";
import { useAuth } from "@clerk/clerk-expo";
import {
  Avatar,
  AvatarImage,
  Box,
  HStack,
  Heading,
  Pressable,
  ScrollView,
  Spinner,
  Text,
  VStack
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl } from "react-native";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

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

          const memberData = await Promise.all(
            (ride.memberIds ?? []).map(async (uid: string) => {
              try {
                const userDoc = await getDoc(doc(db, "users", uid));
                if (userDoc.exists()) {
                  const data = userDoc.data();
                  return {
                    id: uid,
                    username: data.username || "Unknown",
                    avatar: data.avatar || DEFAULT_AVATAR,
                  };
                }
              } catch {
                return null;
              }
            })
          );

          return {
            id: rideId,
            title: `${ride.from} → ${ride.to}`,
            preview: latestMessage?.text ?? "No messages yet",
            timestamp:
              latestMessage?.timestamp?.toDate().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }) ?? "—",
            members: memberData.filter(Boolean),
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
      bg="#121212"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#a0a0a0"
        />
      }
    >
      <Box px="$4" py="$6">
        <Heading size="xl" color="white" mb="$6" mt="$16">
          Your Ride Groups
        </Heading>

        {loading ? (
          <HStack justifyContent="center" mt="$10">
            <Spinner size="large" color="#3a7bd5" />
          </HStack>
        ) : error ? (
          <Text color="#ff6666" mt="$4" textAlign="center">
            {error}
          </Text>
        ) : chatGroups.length === 0 ? (
          <Text color="#888" mt="$4" textAlign="center">
            You’re not part of any ride groups yet.
          </Text>
        ) : (
          <VStack space="lg">
            {chatGroups.map((group) => (
              <Pressable
                key={group.id}
                borderRadius="$lg"
                bg="#1e1e1e"
                p="$4"
                borderWidth="$1"
                borderColor="#333"
                onPress={() =>
                  router.push({
                    pathname: "/(stack)/ride/[id]/chat",
                    params: { id: group.id },
                  })
                }
              >
                <VStack space="sm">
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontWeight="$bold" fontSize="$md" color="white">
                      {group.title}
                    </Text>
                    <Text fontSize="$xs" color="#999">
                      {group.timestamp}
                    </Text>
                  </HStack>

                  <Text color="#aaa" numberOfLines={1}>
                    {group.preview}
                  </Text>
                  <Text color="#666" fontSize="$xs" italic>
                    Tap to view chat →
                  </Text>

                  <HStack space="sm" mt="$2">
                    {group.members.slice(0, 5).map((user: any) => (
                      <Avatar key={user.id} size="sm" bgColor="#121212">
                        <AvatarImage
                          source={{ uri: user.avatar }}
                          alt={user.username}
                        />
                      </Avatar>
                    ))}
                    {group.members.length > 5 && (
                      <Box
                        bg="#3a7bd5"
                        borderRadius="$full"
                        w="$6"
                        h="$6"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text color="white" fontSize="$xs">
                          +{group.members.length - 5}
                        </Text>
                      </Box>
                    )}
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
