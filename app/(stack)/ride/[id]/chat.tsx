import { db } from "@/services/firebaseConfig";
import { useUser } from "@clerk/clerk-expo";
import {
    Avatar,
    Box,
    HStack,
    Input,
    InputField,
    ScrollView,
    Text,
    VStack
} from "@gluestack-ui/themed";
import { router, useLocalSearchParams } from "expo-router";
import {
    addDoc,
    collection,
    doc,
    getDoc,
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
    Pressable,
    TouchableWithoutFeedback,
} from "react-native";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

type UserMap = {
  [userId: string]: {
    name: string;
    avatar: string;
  };
};

export default function RideChatScreen() {
  const { id: rideId } = useLocalSearchParams();
  const { user } = useUser();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [rideInfo, setRideInfo] = useState<{ from: string; to: string } | null>(null);
  const [userMap, setUserMap] = useState<UserMap>({});
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
    outputRange: ["#3a7bd5", "#122a58"],
  });

  useEffect(() => {
    if (!rideId) return;

    const q = query(
      collection(db, "rides", String(rideId), "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      // Fetch user data for all unique senderIds
      const uniqueSenderIds = Array.from(new Set(msgs.map((m) => m.senderId)));
      const newUserMap: UserMap = { ...userMap };

      for (const uid of uniqueSenderIds) {
        if (!newUserMap[uid]) {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            newUserMap[uid] = {
              name: data.username || "Anonymous",
              avatar: data.avatar || DEFAULT_AVATAR,
            };
          } else {
            newUserMap[uid] = {
              name: "Unknown",
              avatar: DEFAULT_AVATAR,
            };
          }
        }
      }
      

      setUserMap(newUserMap);

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return unsubscribe;
  }, [rideId]);

  useEffect(() => {
    if (!rideId) return;

    const fetchRideInfo = async () => {
      try {
        const rideRef = doc(db, "rides", String(rideId));
        const rideSnap = await getDoc(rideRef);
        if (rideSnap.exists()) {
          const data = rideSnap.data();
          setRideInfo({ from: data.from, to: data.to });
        }
      } catch (err) {
        console.error("Failed to fetch ride info:", err);
      }
    };

    fetchRideInfo();
  }, [rideId]);

  const handleSend = async () => {
    if (!input.trim() || !user?.id) return;

    try {
      const userDoc = await getDoc(doc(db, "users", user.id));
      const userData = userDoc.exists() ? userDoc.data() : null;

      await addDoc(collection(db, "rides", String(rideId), "messages"), {
        text: input.trim(),
        senderId: user.id,
        senderName:
          userData?.username || user.username || user.fullName || "Anonymous",
        avatar: userData?.avatar || user.imageUrl || DEFAULT_AVATAR,
        timestamp: serverTimestamp(),
      });

      setInput("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <Box flex={1} px="$3" py="$4" bg="#121212">
          {rideInfo && (
            <Box mb="$4" alignItems="center">
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(stack)/ride/[id]/group-settings",
                    params: { id: rideId as string },
                  })
                }
              >
                <Text
                  fontSize={18}
                  fontWeight="600"
                  color="white"
                  textAlign="center"
                  style={{ textDecorationLine: "underline" }}
                >
                  {rideInfo.from} → {rideInfo.to}
                </Text>
              </Pressable>
            </Box>
          )}

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
                const senderInfo = userMap[msg.senderId] || {
                  name: msg.senderName || "Unknown",
                  avatar: msg.avatar || DEFAULT_AVATAR,
                };

                return (
                  <HStack
                    key={msg.id}
                    space="sm"
                    alignItems="flex-end"
                    justifyContent={isCurrentUser ? "flex-end" : "flex-start"}
                  >
                    {!isCurrentUser && (
                      <Avatar size="sm" bgColor="#1e1e1e">
                        <Avatar.Image
                          source={{ uri: senderInfo.avatar }}
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
                          {senderInfo.name}
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
