import { db } from "@/services/firebaseConfig";
import { useUser } from "@clerk/clerk-expo";
import {
    Avatar,
    AvatarFallbackText,
    Box,
    HStack,
    Input,
    InputField,
    ScrollView,
    Text,
    VStack,
} from "@gluestack-ui/themed";
import { useLocalSearchParams } from "expo-router";
import {
    addDoc,
    collection,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
} from "react-native";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function RideChatScreen() {
  const { id: rideId } = useLocalSearchParams();
  const { user } = useUser();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<any>(null);

  const animatedValue = useRef(new Animated.Value(0)).current;

  const animatePressIn = () => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const animatePressOut = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const interpolatedColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#3a7bd5", "#122a58"], // darker blue
  });

  useEffect(() => {
    if (!rideId) return;

    const q = query(
      collection(db, "rides", String(rideId), "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
      avatar: user.imageUrl || DEFAULT_AVATAR,
      timestamp: serverTimestamp(),
    });

    setInput("");
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <Box flex={1} px="$3" py="$4" bg="#121212">
          <ScrollView
            flex={1}
            ref={scrollRef}
            mb="$4"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <VStack space="sm">
              {messages.map((msg) => {
                const isCurrentUser = msg.senderId === user?.id;

                return (
                  <HStack
                    key={msg.id}
                    space="sm"
                    alignItems="flex-end"
                    justifyContent={isCurrentUser ? "flex-end" : "flex-start"}
                  >
                    {!isCurrentUser && (
                      <Avatar size="sm" bgColor="#1e1e1e">
                        <AvatarFallbackText>
                          {msg.senderName?.[0] || "U"}
                        </AvatarFallbackText>
                        <Avatar.Image
                          source={{ uri: msg.avatar || DEFAULT_AVATAR }}
                          alt="User avatar"
                        />
                      </Avatar>
                    )}

                    <VStack
                      alignItems={isCurrentUser ? "flex-end" : "flex-start"}
                      maxWidth="80%"
                    >
                      {!isCurrentUser && (
                        <Text fontSize="$xs" color="#aaaaaa" mb="$1">
                          {msg.senderName ?? msg.senderId}
                        </Text>
                      )}

                      <Box
                        px="$4"
                        py="$2"
                        bg={isCurrentUser ? "#3a7bd5" : "#1e1e1e"}
                        borderTopLeftRadius={isCurrentUser ? "$xl" : "$sm"}
                        borderTopRightRadius={isCurrentUser ? "$sm" : "$xl"}
                        borderBottomLeftRadius="$xl"
                        borderBottomRightRadius="$xl"
                      >
                        <Text
                          color={isCurrentUser ? "#ffffff" : "#e0e0e0"}
                          fontSize="$sm"
                        >
                          {msg.text}
                        </Text>
                      </Box>

                      {msg.timestamp?.toDate && (
                        <Text
                          fontSize="$xs"
                          color="#888888"
                          mt="$1"
                          mb="$1"
                          textAlign={isCurrentUser ? "right" : "left"}
                        >
                          {msg.timestamp.toDate().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      )}
                    </VStack>
                  </HStack>
                );
              })}
            </VStack>
          </ScrollView>
        <Box mt="$1" mb="$4">
          <HStack
            space="sm"
            alignItems="center"
            mt="$2"
            bg="transparent"
            p="$2"
            borderRadius="$xl"
          >
            <Input
              flex={1}
              size="md"
              borderWidth={0}
              borderRadius="$full"
              backgroundColor="#2a2a2a"
              px="$4"
              py="$2"
            >
              <InputField
                placeholder="Message..."
                placeholderTextColor="#777"
                color="white"
                value={input}
                onChangeText={setInput}
                multiline
                textAlignVertical="top"
                style={{ maxHeight: 100 }}
              />
            </Input>

            <TouchableWithoutFeedback
              onPressIn={animatePressIn}
              onPressOut={animatePressOut}
              onPress={handleSend}
            >
              <Animated.View
                style={{
                  backgroundColor: interpolatedColor,
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                }}
              >
                <Text color="white">Send</Text>
              </Animated.View>
            </TouchableWithoutFeedback>
          </HStack>
          </Box>
        </Box>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
