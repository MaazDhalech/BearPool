import { usePushNotifications } from "@/hooks/usePushNotifications";
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
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { RefreshControl } from "react-native";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function ChatsScreen() {
  const { expoPushToken } = usePushNotifications();
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
    if (!userId || !expoPushToken?.data) return;

    const saveTokenToFirestore = async () => {
      try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const existingToken = userSnap.exists() ? userSnap.data()?.expoPushToken : null;

        if (existingToken !== expoPushToken.data) {
          await updateDoc(userRef, {
            expoPushToken: expoPushToken.data,
          });
          console.log("✅ Push token saved to Firestore from ChatsScreen");
        }
      } catch (err) {
        console.error("❌ Error saving push token:", err);
      }
    };

    saveTokenToFirestore();
  }, [expoPushToken, userId]);

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
        console.log("🚨 onSnapshot triggered for rides");
        const groups: any[] = [];
        for (const docSnap of rideSnap.docs) {
          const ride = docSnap.data();
          groups.push({
            id: docSnap.id,
            title: `${ride.from} → ${ride.to}`,
            preview: "No messages yet",
            time: "—",
            members: [] as any[],
            joinedAt: (ride.createdAt as any)?.toMillis() || 0,
            lastMessageTs: 0,
            unreadCount: 0,
          });
        }

        await Promise.all(
          groups.map(async g => {
            const rideDoc = rideSnap.docs.find(d => d.id === g.id)!;
            const ids: string[] = rideDoc.data().memberIds || [];
            const members = await Promise.all(ids.map(uid => getUserData(uid)));
            g.members = members.filter(Boolean);
          })
        );

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
    await updateDoc(doc(db, "rides", rideId), {
      [`lastRead.${userId}`]: serverTimestamp()
    });
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
                  <HStack justifyContent="space-between">
                    <Text color="#aaa" numberOfLines={1} flex={1}>
                      {grp.preview}
                    </Text>
                    <Text fontSize="$xs" color="#999">
                      {grp.time}
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
