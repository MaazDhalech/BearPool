import { ACCENT } from "@/constants/Colors";
import { TYPE } from "@/constants/Typography";
import { SPACE } from "@/constants/Spacing";
import { FadeSlideIn } from "@/components/FadeSlideIn";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
  Avatar,
  AvatarImage,
  Box,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { useFocusEffect, useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { RefreshControl, ScrollView, TouchableOpacity, View } from "react-native";

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
  const hasLoadedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setupListeners();
      return () => {
        unsubRidesRef.current?.();
      };
    }, [userId]),
  );

  const getUserData = async (uid: string) => {
    if (userCache.current[uid]) return userCache.current[uid];
    try {
      const udoc = await getDoc(doc(db, "users", uid));
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

  const getUnreadStatus = async (rideId: string): Promise<boolean> => {
    try {
      const [readStateSnap, lastMsgSnap] = await Promise.all([
        getDoc(doc(db, "rides", rideId, "readState", userId!)),
        getDocs(
          query(
            collection(db, "rides", rideId, "messages"),
            orderBy("createdAt", "desc"),
            limit(1),
          ),
        ),
      ]);

      const lastMsg = lastMsgSnap.docs[0]?.data();
      if (!lastMsg) return false;

      if (!readStateSnap.exists()) return true;

      const lastReadAt = readStateSnap.data().lastReadAt;
      if (!lastReadAt) return true;

      return lastMsg.createdAt?.toMillis() > lastReadAt.toMillis();
    } catch {
      return false;
    }
  };

  const setupListeners = () => {
    unsubRidesRef.current?.();
    setError(null);
    if (!hasLoadedOnce.current) setLoading(true);

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
            from: ride.from ?? "Unknown",
            to: ride.to ?? "Unknown",
            members: [] as any[],
            joinedAt: (ride.createdAt as any)?.toMillis() || 0,
            archived: ride.archived ?? false,
            date: ride.date ?? "",
            time: ride.time ?? "",
            hasUnread: false,
          };

          const ids: string[] = ride.memberIds || [];
          const [members, hasUnread] = await Promise.all([
            Promise.all(ids.map((uid) => getUserData(uid))),
            getUnreadStatus(rideId),
          ]);
          group.members = members.filter(Boolean);
          group.hasUnread = hasUnread;

          if (group.archived) {
            archived.push(group);
          } else {
            active.push(group);
          }
        }

        hasLoadedOnce.current = true;
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
    <TouchableOpacity
      key={grp.id}
      activeOpacity={0.75}
      onPress={() => handlePress(grp.id)}
      style={{
        borderRadius: 12,
        backgroundColor: muted ? "#161616" : "#1e1e1e",
        padding: 16,
        borderWidth: 1,
        borderColor: grp.hasUnread && !muted ? ACCENT + "55" : muted ? "#222" : "#333",
        opacity: muted ? 0.65 : 1,
      }}
    >
      <VStack space="xs">
        <HStack justifyContent="space-between" alignItems="flex-start">
          <VStack style={{ flex: 1, marginRight: SPACE.sm }}>
            <HStack alignItems="center" space="sm">
              <Text style={{ color: muted ? "#888" : "#ffffff", fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.bold, lineHeight: TYPE.size.subheading * TYPE.leading.tight }}>
                {grp.to}
              </Text>
              {grp.hasUnread && !muted && (
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT }} />
              )}
            </HStack>
            <Text style={{ color: muted ? "#555" : "#a0a0a0", fontSize: TYPE.size.label, fontWeight: TYPE.weight.medium, marginTop: 2 }}>
              from {grp.from}
            </Text>
          </VStack>
          {muted && (
            <View style={{ backgroundColor: "#2a2a2a", paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ color: "#666", fontSize: TYPE.size.micro }}>Archived</Text>
            </View>
          )}
        </HStack>
        {grp.date ? (
          <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.caption, marginTop: SPACE.xs }}>
            {grp.date} · {grp.time}
          </Text>
        ) : null}
        <HStack space="sm" mt="$2">
          {grp.members.slice(0, 5).map((u: any) => (
            <Avatar key={u.id} size="sm" bgColor="#121212">
              <AvatarImage source={{ uri: u.avatar }} alt="" />
            </Avatar>
          ))}
          {grp.members.length > 5 && (
            <Box
              bg="#2a2a2a"
              borderRadius="$full"
              w="$6"
              h="$6"
              alignItems="center"
              justifyContent="center"
            >
              <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.micro }}>
                +{grp.members.length - 5}
              </Text>
            </Box>
          )}
        </HStack>
      </VStack>
    </TouchableOpacity>
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
        contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#a0a0a0"
          />
        }
      >
        <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg }}>
          <View style={{ marginTop: SPACE["4xl"], marginBottom: SPACE["2xl"] }}>
            <Text style={{ color: "#ffffff", fontSize: TYPE.size.display, fontWeight: TYPE.weight.bold, lineHeight: TYPE.size.display * TYPE.leading.tight }}>
              Your{"\n"}Ride Groups
            </Text>
          </View>

          {loading ? (
            <HStack justifyContent="center" mt="$10">
              <Spinner size="large" color={ACCENT} />
            </HStack>
          ) : error ? (
            <Text style={{ color: "#ff6666", textAlign: "center", fontSize: TYPE.size.body }}>
              {error}
            </Text>
          ) : activeGroups.length === 0 && archivedGroups.length === 0 ? (
            <FadeSlideIn delay={100}>
              <VStack alignItems="center" mt="$8" px="$6" space="md">
                <Text style={{ fontSize: 36, marginBottom: SPACE.sm }}>🐻</Text>
                <Text style={{ color: "#ffffff", fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold, textAlign: "center" }}>
                  No ride groups yet
                </Text>
                <Text style={{ color: "#a0a0a0", textAlign: "center", fontSize: TYPE.size.body, lineHeight: TYPE.size.body * TYPE.leading.relaxed }}>
                  Join or post a ride on the feed to start coordinating with your group.
                </Text>
              </VStack>
            </FadeSlideIn>
          ) : (
            <VStack space="lg">
              {activeGroups.length > 0 && (
                <VStack space="md">
                  {activeGroups.map((grp) => renderGroup(grp))}
                </VStack>
              )}

              {archivedGroups.length > 0 && (
                <VStack space="md" mt={activeGroups.length > 0 ? "$4" : "$0"}>
                  <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.label, fontWeight: TYPE.weight.medium, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: SPACE.xs }}>
                    Past Rides
                  </Text>
                  {archivedGroups.map((grp) => renderGroup(grp, true))}
                </VStack>
              )}
            </VStack>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
