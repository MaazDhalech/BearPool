import { db } from "@/services/firebaseConfig";
import { useUser } from "@clerk/clerk-expo";
import {
    Box, Button, HStack, Input, InputField, ScrollView, Text, VStack
} from "@gluestack-ui/themed";
import { useLocalSearchParams } from "expo-router";
import {
    addDoc, collection, onSnapshot, orderBy, query, serverTimestamp
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform
} from "react-native";

export default function RideChatScreen() {
  const { id: rideId } = useLocalSearchParams();
  const { user } = useUser();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<any>(null);

  useEffect(() => {
    if (!rideId) return;

    const q = query(
      collection(db, "rides", String(rideId), "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return unsubscribe;
  }, [rideId]);

  const handleSend = async () => {
    if (!input.trim() || !user?.id) return;

    await addDoc(collection(db, "rides", String(rideId), "messages"), {
      text: input.trim(),
      senderId: user.id,
      senderName: user.username || user.fullName || "Anonymous",
      timestamp: serverTimestamp(),
    });

    setInput("");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <Box flex={1} px="$4" py="$6" bg="$backgroundLight">
        <ScrollView flex={1} ref={scrollRef} mb="$4" keyboardShouldPersistTaps="handled">
          <VStack space="sm">
            {messages.map((msg) => (
              <Box key={msg.id} p="$3" bg="$coolGray100" borderRadius="$md">
                <Text fontWeight="$bold">{msg.senderName ?? msg.senderId}</Text>
                <Text>{msg.text}</Text>
                {msg.timestamp?.toDate && (
                  <Text fontSize="$xs" color="$coolGray500">
                    {msg.timestamp.toDate().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                )}
              </Box>
            ))}
          </VStack>
        </ScrollView>

        <HStack space="sm" alignItems="center" mt="$2">
          <Input flex={1} bg="#1e1e1e" borderColor="#333">
            <InputField
              placeholder="Type a message..."
              placeholderTextColor="#aaa"
              value={input}
              onChangeText={setInput}
              multiline
              textAlignVertical="top"
              style={{ maxHeight: 100, color: "white" }} // 🔹 white text input
            />
          </Input>
          <Button onPress={handleSend}>
            <Text color="white">Send</Text>
          </Button>
        </HStack>
      </Box>
    </KeyboardAvoidingView>
  );
}
