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
  onSnapshot,
  query,
  where
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
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

  const unsubRidesRef = useRef<(() => void) | null>(null);
  const userCache = useRef<{ [uid: string]: { id: string; avatar: string } }>({});
  let readCounter = 0;

  useEffect(() => {
    if (!userId) return;

    setupListeners();

    return () => {
      unsubRidesRef.current?.();
    };
  }, [userId]);

  const getUserData = async (uid: string) => {
    if (userCache.current[uid]) return userCache.current[uid];
    try {
      const udoc = await getDoc(doc(db, "users", uid));
      readCounter++;
      console.log(`📚 Firestore user read #${readCounter} for ${uid}`);
      if (udoc.exists()) {
        const d = udoc.data();
        const user = { id: uid, avatar: d.avatar || DEFAULT_AVATAR };
        userCache.current[uid] = user;
        return user;
      }
    } catch (err) {
      console.error("❌ Error fetching user:", err);
    }
    return null;
  };

  const setupListeners = async () => {
    unsubRidesRef.current?.();
    setError(null);
    setLoading(true);

    const ridesQ = query(
      collection(db, "rides"),
      where("memberIds", "array-contains", userId)
    );

    unsubRidesRef.current = onSnapshot(
      ridesQ,
      async rideSnap => {
        const groups: any[] = [];

        for (const docSnap of rideSnap.docs) {
          const ride = docSnap.data();
          const rideId = docSnap.id;

          const group: any = {
            id: rideId,
            title: `${ride.from} → ${ride.to}`,
            members: [] as any[],
            joinedAt: (ride.createdAt as any)?.toMillis() || 0
          };

          const ids: string[] = ride.memberIds || [];
          const members = await Promise.all(ids.map(uid => getUserData(uid)));
          group.members = members.filter(Boolean);

          groups.push(group);
        }

        setChatGroups(groups);
        setLoading(false);
        setRefreshing(false);
      },
      err => {
        console.error("rides listener error", err);
        setError("Failed to load your ride chats.");
        setLoading(false);
        setRefreshing(false);
      }
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    setupListeners();
  };

  const handlePress = async (rideId: string) => {
    router.push({
      pathname: "/(stack)/ride/[id]/chat",
      params: { id: rideId }
    });
  };

  return (
    <ScrollView
      bg="#121212"
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
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
          <Text color="#ff6666" textAlign="center">
            {error}
          </Text>
        ) : chatGroups.length === 0 ? (
          <Text color="#888" textAlign="center">
            You’re not part of any ride groups yet.
          </Text>
        ) : (
          <VStack space="lg">
            {chatGroups.map(grp => (
              <Pressable
                key={grp.id}
                borderRadius="$lg"
                bg="#1e1e1e"
                p="$4"
                borderWidth="$1"
                borderColor="#333"
                onPress={() => handlePress(grp.id)}
              >
                <VStack space="xs">
                  <HStack justifyContent="space-between" alignItems="center">
                    <Text fontWeight="$bold" fontSize="$md" color="white">
                      {grp.title}
                    </Text>
                  </HStack>
                  <Text color="#666" fontSize="$xs" italic>
                    Tap to view chat →
                  </Text>
                  <HStack space="sm" mt="$2">
                    {grp.members.slice(0, 5).map((u: any) => (
                      <Avatar key={u.id} size="sm" bgColor="#121212">
                        <AvatarImage source={{ uri: u.avatar }} alt="" />
                      </Avatar>
                    ))}
                    {grp.members.length > 5 && (
                      <Box
                        bg="#3a7bd5"
                        borderRadius="$full"
                        w="$6"
                        h="$6"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text color="white" fontSize="$xs">
                          +{grp.members.length - 5}
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
