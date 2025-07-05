import { db } from "@/services/firebaseConfig";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  Box,
  HStack,
  Heading,
  Input,
  InputField,
  Pressable,
  ScrollView,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { Filter } from 'bad-words';
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
  Alert,
  Animated,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TouchableWithoutFeedback
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const [rideInfo, setRideInfo] = useState<{ from: string; to: string } | null>(
    null
  );
  const [userMap, setUserMap] = useState<UserMap>({});
  const scrollRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  // Initialize content filter
  const filter = useRef(new Filter()).current;

  const animatedValue = useRef(new Animated.Value(0)).current;
  const prevMembersRef = useRef<string[]>([]);

  // Configure filter settings (optional customization)
  useEffect(() => {
    // You can add custom words to the filter
    // filter.addWords('customword1', 'customword2');
    
    // You can remove words if needed
    // filter.removeWords('word1', 'word2');
    
    // Set placeholder character (default is '*')
    filter.placeHolder = '*';
  }, []);

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

  // Content filtering function
  const filterContent = (text: string): { filtered: string; containsProfanity: boolean } => {
    const containsProfanity = filter.isProfane(text);
    const filtered = filter.clean(text);
    return { filtered, containsProfanity };
  };

  const fetchUserDetails = async (uid: string) => {
    if (userMap[uid]) return; // Prevent refetching
    const uDoc = await getDoc(doc(db, "users", uid));
    if (uDoc.exists()) {
      const d = uDoc.data();
      setUserMap((prev) => ({
        ...prev,
        [uid]: {
          name: d.username || "Anonymous",
          avatar: d.avatar || DEFAULT_AVATAR,
        },
      }));
    }
  };

  // Navigate to user profile
  const handleUserPress = (userId: string) => {
    if (userId === user?.id) {
      // If it's the current user, go to their own profile
      router.push("/(tabs)/profile");
    } else {
      // Navigate to other user's profile
      router.push({
        pathname: "/(stack)/ride/[id]/viewProfile",
        params: { id: rideId as string, userId }
      });
    }
  };

  // Listen for membership changes to post system messages
  useEffect(() => {
    if (!rideId) return;
    const rideDocRef = doc(db, "rides", String(rideId));
    const unsubRide = onSnapshot(rideDocRef, async (snap) => {
      const data = snap.data();
      if (!data) return;

      const newMembers: string[] = data.memberIds || [];
      const prevMembers = prevMembersRef.current;

      if (prevMembers.length === 0) {
        prevMembersRef.current = newMembers;
        return;
      }

      const joined = newMembers.filter((uid) => !prevMembers.includes(uid));
      const left = prevMembers.filter((uid) => !newMembers.includes(uid));

      for (const uid of [...joined, ...left]) {
        let name = userMap[uid]?.name;
        if (!name) {
          const uDoc = await getDoc(doc(db, "users", uid));
          name = uDoc.exists()
            ? uDoc.data().username || "Anonymous"
            : "Unknown";
        }
        await addDoc(collection(db, "rides", String(rideId), "messages"), {
          text: `${name} has ${joined.includes(uid) ? "joined" : "left"} the ride`,
          senderId: null,
          timestamp: serverTimestamp(),
          system: true,
        });
      }

      prevMembersRef.current = newMembers;
    });

    return () => unsubRide();
  }, [rideId, userMap]);

  useEffect(() => {
    if (!rideId) return;

    const q = query(
      collection(db, "rides", String(rideId), "messages"),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);

      const uniqueIds = Array.from(
        new Set(msgs.map((m) => m.senderId).filter(Boolean))
      );
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
      InteractionManager.runAfterInteractions(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    });

    return () => unsubscribe();
  }, [rideId, userMap]);

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

  const sendMessage = async (messageText: string) => {
    try {
      console.log("📤 Sending message:", {
        text: messageText,
        senderId: user?.id,
        senderName: user?.fullName || user?.primaryEmailAddress || "Anonymous",
        avatar: user?.imageUrl || DEFAULT_AVATAR,
      });

      await addDoc(collection(db, "rides", String(rideId), "messages"), {
        text: messageText,
        senderId: user?.id,
        senderName: user?.fullName || user?.primaryEmailAddress || "Anonymous",
        avatar: user?.imageUrl || DEFAULT_AVATAR,
        timestamp: serverTimestamp(),
      });

      setInput("");
    } catch (err) {
      console.error("❌ Failed to send message:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  const handleSend = async () => {
    console.log("📨 handleSend triggered");

    const trimmed = input.trim();
  
    if (!trimmed) {
      console.warn("✋ Empty input. Aborting send.");
      return;
    }
  
    if (!rideId) {
      console.error("❌ rideId is undefined.");
      return;
    }
  
    if (!user?.id) {
      console.error("❌ Clerk user is not available.");
      return;
    }

    const { filtered, containsProfanity } = filterContent(trimmed);

    // Option 1: Block messages with profanity entirely
    if (containsProfanity) {
      Alert.alert(
        "Message Not Sent",
        "Your message contains inappropriate language and cannot be sent. Please revise your message.",
        [{ text: "OK" }]
      );
      return;
    }

    // Option 2: Send filtered message (uncomment this and comment out the above if you prefer filtering)
    /*
    if (containsProfanity) {
      Alert.alert(
        "Message Filtered",
        "Your message contained inappropriate language and has been filtered.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Send Anyway",
            onPress: async () => {
              await sendMessage(filtered);
            }
          }
        ]
      );
      return;
    }
    */

    await sendMessage(filtered);
  };

  // Real-time input validation (optional - shows warning as user types)
  const handleInputChange = (text: string) => {
    setInput(text);
    
    // Optional: Show real-time feedback
    // if (filter.isProfane(text)) {
    //   // Could show a warning indicator here
    // }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Box flex={1}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <Box flex={1} bg="#121212" pt={insets.top}>
            {/* Header */}
            <HStack
              alignItems="center"
              px="$4"
              py="$3"
              borderBottomWidth="$1"
              borderBottomColor="#333"
            >
              <Pressable
                onPress={() => router.back()}
                p="$2"
                borderRadius="$full"
                mr="$3"
              >
                <HStack alignItems="center" space="sm">
                  <Ionicons name="arrow-back" size={24} color="white" />
                  <Heading size="sm" color="white">
                    Back
                  </Heading>
                </HStack>
              </Pressable>
            </HStack>

            <Box flex={1} px="$3" py="$4">
              {/* Ride Info */}
              {rideInfo && (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(stack)/ride/[id]/group-settings",
                      params: { id: rideId as string },
                    })
                  }
                >
                  <Box alignItems="center" paddingVertical={8} marginBottom={16}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "600",
                        color: "white",
                        textAlign: "center",
                      }}
                    >
                      {rideInfo.from} TO {rideInfo.to}
                    </Text>
                  </Box>
                </Pressable>
              )}

              {/* Messages */}
              <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 90 }}
              >
                <VStack space="sm">
                  {messages.map((msg) => {
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
                          <TouchableOpacity
                            onPress={() => handleUserPress(msg.senderId)}
                            activeOpacity={0.7}
                          >
                            <Avatar size="sm" bgColor="#1e1e1e">
                              <Avatar.Image
                                source={{ uri: sender.avatar }}
                                alt="User avatar"
                              />
                            </Avatar>
                          </TouchableOpacity>
                        )}

                        <VStack
                          alignItems={isCurrentUser ? "flex-end" : "flex-start"}
                          maxWidth="80%"
                        >
                          {!isCurrentUser && (
                            <TouchableOpacity
                              onPress={() => handleUserPress(msg.senderId)}
                              activeOpacity={0.7}
                            >
                              <Text fontSize="$xs" color="#aaaaaa" mb="$1">
                                {sender.name}
                              </Text>
                            </TouchableOpacity>
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

              {/* Message Input + Send Button */}
              <HStack
                space="sm"
                alignItems="center"
                mt="$2"
                bg="transparent"
                p="$2"
                borderRadius="$xl"
                pb={Platform.OS === "android" ? "$6" : "$2"}
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
                    onChangeText={handleInputChange}
                    multiline
                    textAlignVertical="top"
                    style={{ maxHeight: 100 }}
                  />
                </Input>

                <Pressable
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
                </Pressable>
              </HStack>
            </Box>
          </Box>
        </KeyboardAvoidingView>
      </Box>
    </TouchableWithoutFeedback>
  );
}