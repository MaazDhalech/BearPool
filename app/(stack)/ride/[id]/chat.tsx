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
  const navAnim = useRef(new Animated.Value(0)).current;

  const prevMembersRef = useRef<string[]>([]);

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

  const animateNavPressIn = () => {
    Animated.timing(navAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const animateNavPressOut = () => {
    Animated.timing(navAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const interpolatedColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#3a7bd5", "#122a58"],
  });

  // Listen for membership changes to post system messages
  useEffect(() => {
    if (!rideId) return;
    const rideDocRef = doc(db, "rides", String(rideId));
    const unsubRide = onSnapshot(rideDocRef, async (snap) => {
      const data = snap.data();
      if (!data) return;

      const newMembers: string[] = data.memberIds || [];
      const prevMembers = prevMembersRef.current;

      // initial load: just set prevMembers
      if (prevMembers.length === 0) {
        prevMembersRef.current = newMembers;
        return;
      }

      // joined and left
      const joined = newMembers.filter(uid => !prevMembers.includes(uid));
      const left = prevMembers.filter(uid => !newMembers.includes(uid));

      // for each joined, post a system message
      for (const uid of joined) {
        // get username
        let name = userMap[uid]?.name;
        if (!name) {
          const uDoc = await getDoc(doc(db, "users", uid));
          name = uDoc.exists() ? uDoc.data().username || "Anonymous" : "Unknown";
        }
        await addDoc(collection(db, "rides", String(rideId), "messages"), {
          text: `${name} has joined the ride`,
          senderId: null,
          timestamp: serverTimestamp(),
          system: true,
        });
      }

      // for each left, post a system message
      for (const uid of left) {
        let name = userMap[uid]?.name;
        if (!name) {
          const uDoc = await getDoc(doc(db, "users", uid));
          name = uDoc.exists() ? uDoc.data().username || "Anonymous" : "Unknown";
        }
        await addDoc(collection(db, "rides", String(rideId), "messages"), {
          text: `${name} has left the ride`,
          senderId: null,
          timestamp: serverTimestamp(),
          system: true,
        });
      }

      prevMembersRef.current = newMembers;
    });

    return () => unsubRide();
  }, [rideId, userMap]);

  // Listen for incoming messages
  useEffect(() => {
    if (!rideId) return;

    const q = query(
      collection(db, "rides", String(rideId), "messages"),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      // build userMap for avatar & name lookups
      const uniqueIds = Array.from(new Set(msgs.map(m => m.senderId).filter(Boolean)));
      const newMap = { ...userMap };
      for (const uid of uniqueIds) {
        if (!newMap[uid]) {
          const uDoc = await getDoc(doc(db, "users", uid));
          if (uDoc.exists()) {
            const d = uDoc.data();
            newMap[uid] = {
              name: d.username || "Anonymous",
              avatar: d.avatar || DEFAULT_AVATAR,
            };
          }
        }
      }
      setUserMap(newMap);

      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => unsubscribe();
  }, [rideId, userMap]);

  // Load ride info
  useEffect(() => {
    if (!rideId) return;
    (async () => {
      const rideSnap = await getDoc(doc(db, "rides", String(rideId)));
      if (rideSnap.exists()) {
        const d = rideSnap.data();
        setRideInfo({ from: d.from, to: d.to });
      }
    })();
  }, [rideId]);

  const handleSend = async () => {
    if (!input.trim() || !user?.id) return;

    try {
      await addDoc(collection(db, "rides", String(rideId), "messages"), {
        text: input.trim(),
        senderId: user.id,
        senderName: user.username || user.fullName || "Anonymous",
        avatar: user.imageUrl || DEFAULT_AVATAR,
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
            <Pressable
              onPressIn={animateNavPressIn}
              onPressOut={animateNavPressOut}
              onPress={() =>
                router.push({
                  pathname: "/(stack)/ride/[id]/group-settings",
                  params: { id: rideId as string },
                })
              }
            >
              <Animated.View
                style={{
                  alignItems: "center",
                  paddingVertical: 8,
                  marginBottom: 16,
                  backgroundColor: navAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["transparent", "#2a2a2a"],
                  }),
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "white",
                    textAlign: "center",
                  }}
                >
                  {rideInfo.from} → {rideInfo.to}
                </Text>
              </Animated.View>
            </Pressable>
          )}

          <ScrollView
            flex={1}
            ref={scrollRef}
            mb="$4"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <VStack space="sm">
              {messages.map(msg => {
                const isSystem = !!msg.system;
                const isCurrentUser = msg.senderId === user?.id;
                const sender = userMap[msg.senderId] || {
                  name: msg.senderName || "Unknown",
                  avatar: msg.avatar || DEFAULT_AVATAR,
                };

                if (isSystem) {
                  return (
                    <Text
                      key={msg.id}
                      fontSize="$xs"
                      color="#888"
                      textAlign="center"
                      my="$2"
                    >
                      {msg.text}
                    </Text>
                  );
                }

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
                          source={{ uri: sender.avatar }}
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
                          {sender.name}
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
