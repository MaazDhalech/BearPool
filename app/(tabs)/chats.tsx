import { ACCENT } from "@/constants/Colors";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
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
  VStack,
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { RefreshControl, View } from "react-native";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function ChatsScreen() {
  const [activeGroups, setActiveGroups] = useState<any[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { userId } = useFirebaseAuth();
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
      where("memberIds", "array-contains", userId),
    );

    unsubRidesRef.current = onSnapshot(
      ridesQ,
      async (rideSnap) => {
        const active: any[] = [];
        const archived: any[] = [];

        for (const docSnap of rideSnap.docs) {
          const ride = docSnap.data();
          const rideId = docSnap.id;

          const group: any = {
            id: rideId,
            title: `${ride.from} → ${ride.to}`,
            members: [] as any[],
            joinedAt: (ride.createdAt as any)?.toMillis() || 0,
            archived: ride.archived ?? false,
            date: ride.date ?? "",
            time: ride.time ?? "",
          };

          const ids: string[] = ride.memberIds || [];
          const members = await Promise.all(ids.map((uid) => getUserData(uid)));
          group.members = members.filter(Boolean);

          if (group.archived) {
            archived.push(group);
          } else {
            active.push(group);
          }
        }

        setActiveGroups(active);
        setArchivedGroups(archived);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.error("rides listener error", err);
        setError("Failed to load your ride chats.");
        setLoading(false);
        setRefreshing(false);
      },
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    setupListeners();
  };

  const handlePress = (rideId: string) => {
    router.push({
      pathname: "/(stack)/ride/[id]/chat",
      params: { id: rideId },
    });
  };

  const renderGroup = (grp: any, muted = false) => (
    <Pressable
      key={grp.id}
      borderRadius="$lg"
      bg={muted ? "#161616" : "#1e1e1e"}
      p="$4"
      borderWidth="$1"
      borderColor={muted ? "#222" : "#333"}
      opacity={muted ? 0.7 : 1}
      onPress={() => handlePress(grp.id)}
    >
      <VStack space="xs">
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontWeight="$bold" fontSize="$md" color={muted ? "#888" : "white"}>
            {grp.title}
          </Text>
          {muted && (
            <Text color="#555" fontSize="$xs">
              Archived
            </Text>
          )}
        </HStack>
        {grp.date ? (
          <Text color="#555" fontSize="$xs">
            {grp.date} · {grp.time}
          </Text>
        ) : null}
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
              bg={ACCENT}
              borderRadius="$full"
              w="$6"
              h="$6"
              alignItems="center"
              justifyContent="center"
            >
              <Text color="#121212" fontSize="$xs">
                +{grp.members.length - 5}
              </Text>
            </Box>
          )}
        </HStack>
      </VStack>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <LinearGradient
        colors={["rgba(255, 190, 92, 0.28)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }}
        pointerEvents="none"
      />
      <ScrollView
        style={{ backgroundColor: "transparent" }}
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
            <Spinner size="large" color={ACCENT} />
          </HStack>
        ) : error ? (
          <Text color="#ff6666" textAlign="center">
            {error}
          </Text>
        ) : activeGroups.length === 0 && archivedGroups.length === 0 ? (
          <Text color="#888" textAlign="center">
            You're not part of any ride groups yet.
          </Text>
        ) : (
          <VStack space="lg">
            {activeGroups.length > 0 && (
              <VStack space="md">
                {activeGroups.map((grp) => renderGroup(grp))}
              </VStack>
            )}

            {archivedGroups.length > 0 && (
              <VStack space="md" mt={activeGroups.length > 0 ? "$4" : "$0"}>
                <Text color="#555" fontSize="$sm" fontWeight="$semibold" letterSpacing={1}>
                  PAST RIDES
                </Text>
                {archivedGroups.map((grp) => renderGroup(grp, true))}
              </VStack>
            )}
          </VStack>
        )}
      </Box>
      </ScrollView>
    </View>
  );
}
