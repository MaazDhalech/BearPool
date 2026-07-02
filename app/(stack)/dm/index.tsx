import { ACCENT } from "@/constants/Colors";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Ionicons } from "@expo/vector-icons";
import { HStack, Spinner, Text } from "@gluestack-ui/themed";
import { formatDistanceToNow } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useCallback, useRef, useState } from "react";
import { FlatList, Image, Pressable, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type UserInfo = { firstName: string; lastName: string; avatar: string };

type Conversation = {
  id: string;
  otherUid: string;
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  lastSenderId: string;
  hasUnread: boolean;
};

export default function DMInboxScreen() {
  const { userId } = useFirebaseAuth();
  const insets = useSafeAreaInsets();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userMap, setUserMap] = useState<{ [uid: string]: UserInfo }>({});
  const [loading, setLoading] = useState(true);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const userCache = useRef<{ [uid: string]: UserInfo }>({});
  const hasLoadedOnce = useRef(false);

  // Fetch each unique other-participant doc once, caching results.
  const getUserData = async (uid: string): Promise<UserInfo | null> => {
    if (userCache.current[uid]) return userCache.current[uid];
    try {
      const udoc = await getDoc(doc(db, "users", uid));
      if (udoc.exists()) {
        const d = udoc.data();
        const info: UserInfo = {
          firstName: d.first_name || "",
          lastName: d.last_name || "",
          avatar: typeof d.avatar === "string" ? d.avatar : "",
        };
        userCache.current[uid] = info;
        return info;
      }
    } catch (err) {
      console.error("❌ Error fetching user:", err);
    }
    return null;
  };

  // A conversation is unread when the latest message is newer than the user's
  // last read AND it wasn't sent by the user. One getDoc per conversation on
  // load is fine for MVP.
  const getUnreadStatus = async (
    conv: Pick<Conversation, "id" | "lastMessageAt" | "lastSenderId">,
  ): Promise<boolean> => {
    if (!userId) return false;
    if (!conv.lastMessageAt || conv.lastSenderId === userId) return false;
    try {
      const readSnap = await getDoc(
        doc(db, "conversations", conv.id, "readState", userId),
      );
      const lastReadAt = readSnap.exists() ? readSnap.data().lastReadAt : null;
      if (!lastReadAt) return true;
      return conv.lastMessageAt.toMillis() > lastReadAt.toMillis();
    } catch {
      return false;
    }
  };

  const setupListener = useCallback(() => {
    unsubscribeRef.current?.();
    if (!userId) return;
    if (!hasLoadedOnce.current) setLoading(true);

    const convQ = query(
      collection(db, "conversations"),
      where("participants", "array-contains", userId),
      orderBy("lastMessageAt", "desc"),
    );

    unsubscribeRef.current = onSnapshot(
      convQ,
      async (snap) => {
        const base = snap.docs.map((docSnap) => {
          const data = docSnap.data();
          const participants: string[] = data.participants || [];
          return {
            id: docSnap.id,
            otherUid: participants.find((p) => p !== userId) || "",
            lastMessage: data.lastMessage || "",
            lastMessageAt: (data.lastMessageAt as Timestamp) || null,
            lastSenderId: data.lastSenderId || "",
          };
        });

        // Fetch other-participant profiles and unread status in parallel.
        const [userResults, unreadResults] = await Promise.all([
          Promise.all(base.map((c) => getUserData(c.otherUid))),
          Promise.all(base.map((c) => getUnreadStatus(c))),
        ]);

        const nextMap = { ...userCache.current };
        base.forEach((c, i) => {
          const info = userResults[i];
          if (info) nextMap[c.otherUid] = info;
        });

        setUserMap(nextMap);
        setConversations(
          base.map((c, i) => ({ ...c, hasUnread: unreadResults[i] })),
        );
        hasLoadedOnce.current = true;
        setLoading(false);
      },
      (err) => {
        console.error("conversations listener error", err);
        setLoading(false);
      },
    );
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setupListener();
      return () => {
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
      };
    }, [userId, setupListener]),
  );

  const renderRow = ({ item }: { item: Conversation }) => {
    const info = userMap[item.otherUid];
    const fullName =
      info && (info.firstName || info.lastName)
        ? `${info.firstName} ${info.lastName}`.trim()
        : "Unknown";
    const initial = (info?.firstName?.[0] || fullName[0] || "?").toUpperCase();

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => router.push(`/(stack)/dm/${item.id}`)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#1e1e1e",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: item.hasUnread ? ACCENT + "55" : "#333",
          padding: SPACE.md,
          marginBottom: SPACE.md,
        }}
      >
        {/* Avatar */}
        {info?.avatar ? (
          <Image
            source={{ uri: info.avatar }}
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#121212" }}
          />
        ) : (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: ACCENT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#121212", fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.bold }}>
              {initial}
            </Text>
          </View>
        )}

        {/* Name + preview */}
        <View style={{ flex: 1, marginLeft: SPACE.md, marginRight: SPACE.sm }}>
          <HStack alignItems="center" space="sm">
            <Text
              style={{
                color: "#ffffff",
                fontSize: TYPE.size.body,
                fontWeight: TYPE.weight.semibold,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              {fullName}
            </Text>
            {item.hasUnread && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT }} />
            )}
          </HStack>
          <Text
            style={{
              color: "#a0a0a0",
              fontSize: TYPE.size.label,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>

        {/* Relative timestamp */}
        {item.lastMessageAt?.toDate && (
          <Text style={{ color: "#666", fontSize: TYPE.size.micro }}>
            {formatDistanceToNow(item.lastMessageAt.toDate(), { addSuffix: true })}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <LinearGradient
        colors={["rgba(255, 190, 92, 0.28)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }}
        pointerEvents="none"
      />

      {/* Back chrome */}
      <View style={{ paddingTop: insets.top }}>
        <HStack alignItems="center" px="$3" py="$3">
          <Pressable onPress={() => router.back()} style={{ padding: SPACE.sm }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
        </HStack>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderRow}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: SPACE.lg,
          paddingBottom: 120,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <View style={{ marginTop: SPACE.lg, marginBottom: SPACE["2xl"] }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: TYPE.size.display,
                fontWeight: TYPE.weight.bold,
                lineHeight: TYPE.size.display * TYPE.leading.tight,
              }}
            >
              Your{"\n"}Messages
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <HStack justifyContent="center" mt="$10">
              <Spinner size="large" color={ACCENT} />
            </HStack>
          ) : (
            <View style={{ alignItems: "center", marginTop: SPACE["4xl"] }}>
              <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.body, textAlign: "center" }}>
                No messages yet
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}
