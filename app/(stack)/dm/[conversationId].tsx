import { ACCENT } from "@/constants/Colors";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/services/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { HStack, Input, InputField, Pressable, Text } from "@gluestack-ui/themed";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as filter from "leo-profanity";

const MAX_CHARS = 500;
const MESSAGE_WINDOW = 50;

type Message = {
  id: string;
  text: string;
  senderId?: string;
  timestamp?: Timestamp;
};

export default function DirectMessageScreen() {
  const { conversationId } = useLocalSearchParams();
  const convId = String(conversationId);
  const { userId } = useFirebaseAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);

  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom > 0 ? insets.bottom : 8;

  // ── Messages subscription ─────────────────────────────
  useEffect(() => {
    if (!convId) return;

    // Newest first so the inverted FlatList renders the latest at the bottom.
    const q = query(
      collection(db, "conversations", convId, "messages"),
      orderBy("timestamp", "desc"),
      limit(MESSAGE_WINDOW),
    );

    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs);
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [convId]);

  // ── Read state ────────────────────────────────────────
  // Mark this thread read/active on open; mark inactive on unmount. The inbox
  // uses lastReadAt to compute unread badges.
  useEffect(() => {
    if (!convId || !userId) return;
    const readStateRef = doc(db, "conversations", convId, "readState", userId);
    setDoc(
      readStateRef,
      { lastReadAt: serverTimestamp(), activeChat: true, activeAt: serverTimestamp() },
      { merge: true },
    ).catch((err) => console.error("Failed to update read state", err));

    return () => {
      setDoc(
        readStateRef,
        { activeChat: false, activeAt: serverTimestamp() },
        { merge: true },
      ).catch((err) => console.error("Failed to update read state", err));
    };
  }, [convId, userId]);

  // ── Send ──────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !convId || !userId || trimmed.length > MAX_CHARS) return;

    // Strip profanity before persisting; skip empty results.
    const cleaned = filter.clean(trimmed);
    if (!cleaned.trim()) return;

    // Firebase UIDs contain no underscores, so the conversation ID splits
    // cleanly back into its two participants.
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
      batch.set(messageRef, {
        text: cleaned,
        senderId: userId,
        timestamp: serverTimestamp(),
      });

      await batch.commit();

      // Clear only after the commit succeeds; the onSnapshot listener updates the UI.
      setInput("");
    } catch (err) {
      console.error("Failed to send message:", err);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  // ── Render item ──────────────────────────────────────
  const renderItem = ({ item }: { item: Message }) => {
    const isCurrentUser = item.senderId === userId;

    return (
      <View
        style={{
          flexDirection: isCurrentUser ? "row-reverse" : "row",
          paddingHorizontal: SPACE.md,
          marginBottom: SPACE.sm,
        }}
      >
        <View style={{ maxWidth: "75%" }}>
          <View
            style={{
              backgroundColor: isCurrentUser ? ACCENT : "#252525",
              borderRadius: 18,
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: 7,
            }}
          >
            <Text
              style={{
                color: isCurrentUser ? "#121212" : "#e8e8e8",
                fontSize: TYPE.size.body,
                lineHeight: TYPE.size.body * 1.45,
              }}
            >
              {item.text}
            </Text>
            {item.timestamp?.toDate && (
              <Text
                style={{
                  fontSize: 10,
                  color: isCurrentUser ? "rgba(18,18,18,0.5)" : "#555",
                  textAlign: isCurrentUser ? "right" : "left",
                  marginTop: 3,
                }}
              >
                {item.timestamp
                  .toDate()
                  .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── Render ───────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      {/* Top chrome */}
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
            Direct Message
          </Text>
        </HStack>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
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
        />

        {/* Input bar */}
        <View
          style={{
            paddingHorizontal: SPACE.md,
            paddingTop: SPACE.sm,
            paddingBottom: safeBottom,
            backgroundColor: "#121212",
            borderTopWidth: 1,
            borderTopColor: "#2a2a2a",
          }}
        >
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
    </View>
  );
}
