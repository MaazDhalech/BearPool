import { ACCENT } from "@/constants/Colors";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/services/firebaseConfig";
import { getOtherUid } from "@/utils/conversations";
import { Ionicons } from "@expo/vector-icons";
import { HStack, Input, InputField, Pressable, Text } from "@gluestack-ui/themed";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import * as filter from "leo-profanity";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import { TouchableOpacity as GHTouchableOpacity, Swipeable } from "react-native-gesture-handler";
import ReAnimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_CHARS = 500;
const MESSAGE_WINDOW = 50;
const REPLY_SNIPPET_MAX = 80;
const GROUP_BREAK_MS = 5 * 60 * 1000;
const DIVIDER_THRESHOLD_MS = 60 * 60 * 1000;

type ReplyTo = {
  messageId: string;
  text: string;
  senderId: string;
};

type Message = {
  id: string;
  text: string;
  senderId?: string;
  timestamp?: Timestamp;
  replyTo?: ReplyTo;
};

type ProcessedMessage = Message & {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

type ListItem =
  | { type: "message"; data: ProcessedMessage }
  | { type: "divider"; id: string; text: string };

type ReplyTarget = {
  messageId: string;
  text: string;
  senderId: string;
};

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function formatDividerText(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `Today ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { month: "long", day: "numeric" })} ${time}`;
}

function ChatEmptyState() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2200 }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const bearStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: SPACE["4xl"],
        paddingHorizontal: SPACE["3xl"],
      }}
    >
      <ReAnimated.View style={[{ marginBottom: SPACE.lg }, bearStyle]}>
        <Text style={{ fontSize: 40 }}>🐻</Text>
      </ReAnimated.View>
      <Text
        style={{
          color: "#ffffff",
          fontSize: TYPE.size.subheading,
          fontWeight: TYPE.weight.bold,
          textAlign: "center",
          marginBottom: SPACE.sm,
        }}
      >
        No messages yet
      </Text>
      <Text
        style={{
          color: "#a0a0a0",
          fontSize: TYPE.size.body,
          textAlign: "center",
          lineHeight: TYPE.size.body * 1.7,
        }}
      >
        Say hi and start the conversation.
      </Text>
    </View>
  );
}

export default function DirectMessageScreen() {
  const { conversationId } = useLocalSearchParams();
  const convId = String(conversationId);
  const { userId } = useFirebaseAuth();
  const isFocused = useIsFocused();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [otherLastReadAt, setOtherLastReadAt] = useState<Timestamp | null>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const otherReadUnsubRef = useRef<(() => void) | null>(null);
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const autoScrollRef = useRef(true);
  const hasLoadedMessagesRef = useRef(false);
  const lastReadWriteAtRef = useRef(0);

  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom > 0 ? insets.bottom : 8;
  const inputPadBottom = keyboardHeight > 0 ? 3 : safeBottom;

  const otherUid = userId ? getOtherUid(convId, userId) : null;

  const setAutoScrollBoth = useCallback((val: boolean) => {
    autoScrollRef.current = val;
    setAutoScroll(val);
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  const updateReadState = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!convId || !userId) return;
      try {
        await setDoc(
          doc(db, "conversations", convId, "readState", userId),
          payload,
          { merge: true },
        );
      } catch (error) {
        console.error("Failed to update read state", error);
      }
    },
    [convId, userId],
  );

  const markReadIfAllowed = useCallback(() => {
    const now = Date.now();
    if (now - lastReadWriteAtRef.current < 4000) return;
    lastReadWriteAtRef.current = now;
    updateReadState({ lastReadAt: serverTimestamp() });
  }, [updateReadState]);

  // ── Keyboard height tracking ──────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: { endCoordinates: { height: number } }) =>
      setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // ── Fetch both participant display names once ─────────
  useEffect(() => {
    if (!convId || !userId) return;
    const participants = convId.split("_");
    if (participants.length !== 2) return;

    const loadNames = async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        participants.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (snap.exists()) {
              const d = snap.data();
              const name = `${d.first_name || ""} ${d.last_name || ""}`.trim();
              next[uid] = name || "Unknown";
            } else {
              next[uid] = "Unknown";
            }
          } catch {
            next[uid] = "Unknown";
          }
        }),
      );
      setUserNameMap(next);
    };

    loadNames();
  }, [convId, userId]);

  // ── Read state presence ───────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!convId || !userId) return;
      hasLoadedMessagesRef.current = false;
      updateReadState({
        lastReadAt: serverTimestamp(),
        activeChat: true,
        activeAt: serverTimestamp(),
      });

      return () => {
        updateReadState({ activeChat: false, activeAt: serverTimestamp() });
      };
    }, [convId, userId, updateReadState]),
  );

  // ── Other participant read state (for Seen) ───────────
  useEffect(() => {
    otherReadUnsubRef.current?.();
    if (!convId || !otherUid) return;

    otherReadUnsubRef.current = onSnapshot(
      doc(db, "conversations", convId, "readState", otherUid),
      (snap) => {
        setOtherLastReadAt(
          snap.exists() ? (snap.data().lastReadAt as Timestamp) ?? null : null,
        );
      },
      (err) => console.error("Failed to listen to other read state", err),
    );

    return () => {
      otherReadUnsubRef.current?.();
      otherReadUnsubRef.current = null;
    };
  }, [convId, otherUid]);

  // ── Messages subscription ─────────────────────────────
  useEffect(() => {
    if (!convId) return;

    // TODO: add startAfter(cursor) here for cursor pagination beyond MESSAGE_WINDOW.
    const q = query(
      collection(db, "conversations", convId, "messages"),
      orderBy("timestamp", "asc"),
      limit(MESSAGE_WINDOW),
    );

    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs);

      if (isFocused) {
        let newestSenderId: string | null = null;
        let latestTs: number | null = null;
        for (const msg of msgs) {
          const ts = msg.timestamp?.toMillis?.() ?? null;
          if (ts !== null && (latestTs === null || ts > latestTs)) {
            latestTs = ts;
            newestSenderId = msg.senderId || null;
          }
        }
        const isFirstLoad = !hasLoadedMessagesRef.current;
        if (isFirstLoad || autoScrollRef.current || newestSenderId === userId) {
          markReadIfAllowed();
        }
        hasLoadedMessagesRef.current = true;
      }

      if (autoScrollRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({
            offset: 0,
            animated: hasLoadedMessagesRef.current,
          });
        }, 30);
      }
    });

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [convId, isFocused, markReadIfAllowed, userId]);

  const resolveSenderName = useCallback(
    (senderId: string) => {
      if (senderId === userId) return "You";
      return userNameMap[senderId] || "Unknown";
    },
    [userId, userNameMap],
  );

  const selectReplyTarget = useCallback((msg: Message) => {
    if (!msg.senderId || !msg.text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReplyTarget({
      messageId: msg.id,
      text: msg.text,
      senderId: msg.senderId,
    });
  }, []);

  // ── Send ──────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !convId || !userId || trimmed.length > MAX_CHARS) return;

    const cleaned = filter.clean(trimmed);
    if (!cleaned.trim()) return;

    const participants = convId.split("_");

    try {
      const batch = writeBatch(db);

      batch.set(
        doc(db, "conversations", convId),
        {
          participants,
          lastMessage: cleaned,
          lastMessageAt: serverTimestamp(),
          lastSenderId: userId,
        },
        { merge: true },
      );

      const messageRef = doc(collection(db, "conversations", convId, "messages"));
      const messageData: Record<string, unknown> = {
        text: cleaned,
        senderId: userId,
        timestamp: serverTimestamp(),
      };

      if (replyTarget) {
        messageData.replyTo = {
          messageId: replyTarget.messageId,
          text: truncateText(replyTarget.text, REPLY_SNIPPET_MAX),
          senderId: replyTarget.senderId,
        };
      }

      batch.set(messageRef, messageData);

      await batch.commit();

      setInput("");
      setReplyTarget(null);
      scrollToBottom(true);
      markReadIfAllowed();
    } catch (err) {
      console.error("Failed to send message:", err);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  const listData = useMemo((): ListItem[] => {
    if (messages.length === 0) return [];

    const processed: ProcessedMessage[] = messages.map((msg, i) => {
      const prev = i > 0 ? messages[i - 1] : null;
      const next = i < messages.length - 1 ? messages[i + 1] : null;

      const prevGap =
        prev?.timestamp && msg.timestamp
          ? msg.timestamp.toMillis() - prev.timestamp.toMillis()
          : Infinity;
      const nextGap =
        next?.timestamp && msg.timestamp
          ? next.timestamp.toMillis() - msg.timestamp.toMillis()
          : Infinity;

      const chainedWithPrev =
        !!prev && prev.senderId === msg.senderId && prevGap < GROUP_BREAK_MS;
      const chainedWithNext =
        !!next && next.senderId === msg.senderId && nextGap < GROUP_BREAK_MS;

      return {
        ...msg,
        isFirstInGroup: !chainedWithPrev,
        isLastInGroup: !chainedWithNext,
      };
    });

    const items: ListItem[] = [];

    for (let i = 0; i < processed.length; i++) {
      const msg = processed[i];
      const prev = i > 0 ? processed[i - 1] : null;

      const needsDivider =
        i === 0 ||
        (msg.timestamp &&
          prev?.timestamp &&
          (msg.timestamp.toMillis() - prev.timestamp.toMillis() >= DIVIDER_THRESHOLD_MS ||
            msg.timestamp.toDate().toDateString() !== prev.timestamp.toDate().toDateString()));

      if (needsDivider && msg.timestamp) {
        items.push({
          type: "divider",
          id: `divider-${msg.id}`,
          text: formatDividerText(msg.timestamp.toDate()),
        });
      }

      items.push({ type: "message", data: msg });
    }

    return items.reverse();
  }, [messages]);

  const latestOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.senderId === userId && msg.timestamp) return msg.id;
    }
    return null;
  }, [messages, userId]);

  const isLatestOwnMessageSeen = useCallback(
    (msg: ProcessedMessage) => {
      if (msg.id !== latestOwnMessageId) return false;
      if (!otherLastReadAt || !msg.timestamp) return false;
      return otherLastReadAt.toMillis() >= msg.timestamp.toMillis();
    },
    [latestOwnMessageId, otherLastReadAt],
  );

  const renderSwipeAction = () => (
    <View
      style={{
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: SPACE.md,
      }}
    >
      <Ionicons name="arrow-undo" size={22} color={ACCENT} />
    </View>
  );

  // ── Render item ──────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "divider") {
        return (
          <View style={{ alignItems: "center", paddingVertical: SPACE.md }}>
            <Text style={{ fontSize: TYPE.size.label, color: "#555", fontWeight: "500" }}>
              {item.text}
            </Text>
          </View>
        );
      }

      const msg = item.data;
      const isCurrentUser = msg.senderId === userId;
      const { isLastInGroup } = msg;
      const showSeen = msg.id === latestOwnMessageId && isLatestOwnMessageSeen(msg);

      const R = 18;
      const r = 5;
      const bubbleStyle = isCurrentUser
        ? {
            borderTopLeftRadius: R,
            borderTopRightRadius: msg.isFirstInGroup ? R : r,
            borderBottomLeftRadius: R,
            borderBottomRightRadius: isLastInGroup ? R : r,
          }
        : {
            borderTopLeftRadius: msg.isFirstInGroup ? R : r,
            borderTopRightRadius: R,
            borderBottomLeftRadius: isLastInGroup ? R : r,
            borderBottomRightRadius: R,
          };

      const bubbleContent = (
        <View
          style={{
            marginBottom: isLastInGroup ? SPACE.md : 2,
            flexDirection: isCurrentUser ? "row-reverse" : "row",
            paddingHorizontal: SPACE.md,
          }}
        >
          <View style={{ maxWidth: "75%", alignItems: isCurrentUser ? "flex-end" : "flex-start" }}>
            <TouchableOpacity
              onLongPress={() => selectReplyTarget(msg)}
              onPress={() => setSelectedMsgId((prev) => (prev === msg.id ? null : msg.id))}
              activeOpacity={1}
              delayLongPress={200}
            >
              <View
                style={[
                  {
                    backgroundColor: isCurrentUser ? ACCENT : "#252525",
                    paddingHorizontal: 12,
                    paddingTop: 8,
                    paddingBottom: 7,
                  },
                  bubbleStyle,
                ]}
              >
                {msg.replyTo && (
                  <View
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor: isCurrentUser ? "rgba(18,18,18,0.35)" : ACCENT,
                      paddingLeft: 8,
                      marginBottom: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: TYPE.size.label,
                        fontWeight: TYPE.weight.semibold,
                        color: isCurrentUser ? "rgba(18,18,18,0.7)" : ACCENT,
                        marginBottom: 2,
                      }}
                      numberOfLines={1}
                    >
                      {resolveSenderName(msg.replyTo.senderId)}
                    </Text>
                    <Text
                      style={{
                        fontSize: TYPE.size.label,
                        color: isCurrentUser ? "rgba(18,18,18,0.55)" : "#a0a0a0",
                      }}
                      numberOfLines={2}
                    >
                      {msg.replyTo.text}
                    </Text>
                  </View>
                )}

                <Text
                  style={{
                    color: isCurrentUser ? "#121212" : "#e8e8e8",
                    fontSize: TYPE.size.body,
                    lineHeight: TYPE.size.body * 1.45,
                  }}
                >
                  {msg.text}
                </Text>

                {isLastInGroup && msg.timestamp?.toDate && (
                  <Text
                    style={{
                      fontSize: 10,
                      color: isCurrentUser ? "rgba(18,18,18,0.5)" : "#555",
                      textAlign: isCurrentUser ? "right" : "left",
                      marginTop: 3,
                    }}
                  >
                    {msg.timestamp
                      .toDate()
                      .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {selectedMsgId === msg.id && msg.timestamp?.toDate && (
              <Text
                style={{
                  fontSize: TYPE.size.micro,
                  color: "#555",
                  marginTop: 3,
                  alignSelf: isCurrentUser ? "flex-end" : "flex-start",
                }}
              >
                {msg.timestamp.toDate().toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
                {" · "}
                {msg.timestamp.toDate().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}

            {showSeen && (
              <Text
                style={{
                  fontSize: TYPE.size.micro,
                  color: "#a0a0a0",
                  marginTop: 3,
                  alignSelf: "flex-end",
                }}
              >
                Seen
              </Text>
            )}
          </View>
        </View>
      );

      return (
        <Swipeable
          renderLeftActions={!isCurrentUser ? renderSwipeAction : undefined}
          renderRightActions={isCurrentUser ? renderSwipeAction : undefined}
          onSwipeableOpen={() => selectReplyTarget(msg)}
          overshootLeft={false}
          overshootRight={false}
          friction={2}
        >
          {bubbleContent}
        </Swipeable>
      );
    },
    [
      userId,
      selectedMsgId,
      selectReplyTarget,
      resolveSenderName,
      isLatestOwnMessageSeen,
      latestOwnMessageId,
    ],
  );

  const keyExtractor = useCallback(
    (item: ListItem) => (item.type === "divider" ? item.id : item.data.id),
    [],
  );

  // ── Render ───────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <View style={{ paddingTop: insets.top, backgroundColor: "#121212" }}>
        <HStack
          alignItems="center"
          px="$3"
          py="$3"
          borderBottomWidth="$1"
          borderBottomColor="#2a2a2a"
        >
          <Pressable onPress={() => router.back()} p="$2" borderRadius="$full" mr="$1">
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text
            style={{
              color: "white",
              fontSize: TYPE.size.subheading,
              fontWeight: TYPE.weight.semibold,
            }}
          >
            {otherUid ? userNameMap[otherUid] || "Direct Message" : "Direct Message"}
          </Text>
        </HStack>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          ref={flatListRef}
          data={listData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          contentContainerStyle={{
            paddingTop: SPACE.md,
            paddingBottom: SPACE.md,
            flexGrow: 1,
            justifyContent: "flex-end",
          }}
          scrollEventThrottle={16}
          onScroll={({ nativeEvent }) => {
            const y = nativeEvent.contentOffset.y;
            if (y < 60 && !autoScrollRef.current) setAutoScrollBoth(true);
            else if (y > 120 && autoScrollRef.current) setAutoScrollBoth(false);
          }}
          ListEmptyComponent={
            <View style={{ flexGrow: 1, justifyContent: "center" }}>
              <ChatEmptyState />
            </View>
          }
        />

        <View
          style={{
            paddingHorizontal: SPACE.md,
            paddingTop: SPACE.sm,
            paddingBottom: inputPadBottom,
            backgroundColor: "#121212",
            borderTopWidth: 1,
            borderTopColor: "#2a2a2a",
          }}
        >
          {replyTarget && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#1e1e1e",
                borderLeftWidth: 3,
                borderLeftColor: ACCENT,
                borderRadius: 8,
                paddingHorizontal: SPACE.md,
                paddingVertical: SPACE.sm,
                marginBottom: SPACE.sm,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: TYPE.size.label,
                    fontWeight: TYPE.weight.semibold,
                    color: ACCENT,
                    marginBottom: 2,
                  }}
                  numberOfLines={1}
                >
                  {resolveSenderName(replyTarget.senderId)}
                </Text>
                <Text
                  style={{ fontSize: TYPE.size.label, color: "#a0a0a0" }}
                  numberOfLines={2}
                >
                  {replyTarget.text}
                </Text>
              </View>
              <Pressable onPress={() => setReplyTarget(null)} p="$2">
                <Ionicons name="close" size={20} color="#a0a0a0" />
              </Pressable>
            </View>
          )}

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: SPACE.sm }}>
            <Input
              flex={1}
              size="md"
              borderWidth={0}
              borderRadius="$2xl"
              backgroundColor="#2a2a2a"
            >
              <InputField
                placeholder="Message..."
                placeholderTextColor="#666"
                color="white"
                value={input}
                onChangeText={(text) => {
                  if (text.length <= MAX_CHARS) setInput(text);
                }}
                multiline
                textAlignVertical="top"
                style={{
                  maxHeight: 100,
                  fontSize: TYPE.size.body,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
            </Input>

            <Pressable onPress={handleSend}>
              <View
                style={{
                  backgroundColor: ACCENT,
                  borderRadius: 999,
                  width: 40,
                  height: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: !input.trim() ? 0.35 : 1,
                }}
              >
                <Ionicons name="arrow-up" size={20} color="#121212" />
              </View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {!autoScroll && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            bottom: keyboardHeight > 0 ? keyboardHeight + 60 : safeBottom + 70,
            alignSelf: "center",
            zIndex: 100,
          }}
        >
          <GHTouchableOpacity
            onPress={() => scrollToBottom(true)}
            activeOpacity={0.85}
            style={{
              backgroundColor: "#1e1e1e",
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 7,
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.sm,
              borderWidth: 1,
              borderColor: "#333",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <Ionicons name="chevron-down" size={14} color={ACCENT} />
            <Text style={{ color: ACCENT, fontSize: TYPE.size.label, fontWeight: TYPE.weight.semibold }}>
              Latest messages
            </Text>
          </GHTouchableOpacity>
        </View>
      )}
    </View>
  );
}
