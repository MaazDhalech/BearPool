import React from "react";
import { ACCENT } from "@/constants/Colors";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  Box,
  Heading,
  HStack,
  Input,
  InputField,
  Pressable,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
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
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  LayoutAnimation,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as filter from "leo-profanity";

filter.add(["berkeleyhate", "ridebully"]);

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

type UserMap = {
  [userId: string]: {
    name: string;
    avatar: string;
  };
};

type RideInfo = {
  from: string;
  to: string;
  date: string;
  time: string;
  startTime: Timestamp | null;
  archived: boolean;
  archivedAt: Timestamp | null;
  isActive: boolean;
  hostId: string;
  memberIds: string[];
  seats: number;
  rideFull: boolean;
};

type Message = {
  id: string;
  text: string;
  senderId?: string;
  senderName?: string;
  avatar?: string;
  timestamp?: Timestamp;
  system?: boolean;
  archivedNotice?: boolean;
};

export default function RideChatScreen() {
  const { id: rideId } = useLocalSearchParams();
  const { user } = useFirebaseAuth();
  const isFocused = useIsFocused();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [rideInfo, setRideInfo] = useState<RideInfo | null>(null);
  const [userMap, setUserMap] = useState<UserMap>({});
  const [isArchived, setIsArchived] = useState(false);
  const [timeUntilArchive, setTimeUntilArchive] = useState<string | null>(null);
  const [shouldShowArchiveCountdown, setShouldShowArchiveCountdown] =
    useState(false);
  const userMapRef = useRef<UserMap>({});
  const scrollRef = useRef<ScrollView>(null);
  // Use a ref for autoScroll so it doesn't cause the Firestore listener to
  // re-subscribe every time the user scrolls. A state copy drives rendering.
  const autoScrollRef = useRef(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const insets = useSafeAreaInsets();

  const animatedValue = useRef(new Animated.Value(0)).current;
  const hasLoadedMessagesRef = useRef(false);
  const lastReadWriteAtRef = useRef(0);
  const rideCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const archiveCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const readStateHeartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const safeBottom = insets.bottom > 0 ? insets.bottom : 8;
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (e) => {
      LayoutAnimation.configureNext({
        duration: e.duration ?? 250,
        update: { type: "easeInEaseOut" },
      });
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardWillHide", (e) => {
      LayoutAnimation.configureNext({
        duration: e.duration ?? 250,
        update: { type: "easeInEaseOut" },
      });
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const setAutoScrollBoth = (val: boolean) => {
    autoScrollRef.current = val;
    setAutoScroll(val);
  };

  const updateReadState = useCallback(
    async (payload: Record<string, any>) => {
      if (!rideId || !user?.uid) return;
      try {
        await setDoc(
          doc(db, "rides", String(rideId), "readState", user.uid),
          payload,
          { merge: true },
        );
      } catch (error) {
        console.error("Failed to update read state", error);
      }
    },
    [rideId, user?.uid],
  );

  const markReadIfAllowed = useCallback(() => {
    const now = Date.now();
    if (now - lastReadWriteAtRef.current < 4000) return;
    lastReadWriteAtRef.current = now;
    updateReadState({ lastReadAt: serverTimestamp() });
  }, [updateReadState]);

  useFocusEffect(
    useCallback(() => {
      if (!rideId || !user?.uid) return;

      hasLoadedMessagesRef.current = false;
      updateReadState({
        activeChat: true,
        activeAt: serverTimestamp(),
      });

      readStateHeartbeatRef.current = setInterval(() => {
        updateReadState({
          activeChat: true,
          activeAt: serverTimestamp(),
        });
      }, 27000) as unknown as NodeJS.Timeout;

      return () => {
        if (readStateHeartbeatRef.current) {
          clearInterval(readStateHeartbeatRef.current);
          readStateHeartbeatRef.current = null;
        }
        updateReadState({
          activeChat: false,
          activeAt: serverTimestamp(),
        });
      };
    }, [rideId, updateReadState, user?.uid]),
  );

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
    outputRange: [ACCENT, "#2a2a2a"],
  });

  const filterContent = (
    text: string,
  ): { filtered: string; containsProfanity: boolean } => {
    const containsProfanity = filter.check(text);
    const filtered = filter.clean(text);
    return { filtered, containsProfanity };
  };

  const parseRideDateTime = (dateStr: string, timeStr: string): Date | null => {
    try {
      const currentYear = new Date().getFullYear();
      const dateTimeStr = `${dateStr}, ${currentYear} ${timeStr}`;
      const parsedDate = new Date(dateTimeStr);

      if (isNaN(parsedDate.getTime())) {
        const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeParts) {
          let [_, hours, minutes, period] = timeParts;
          let hourNum = parseInt(hours);
          if (period.toUpperCase() === "PM" && hourNum < 12) hourNum += 12;
          if (period.toUpperCase() === "AM" && hourNum === 12) hourNum = 0;

          const dateParts = dateStr.match(/(\w+)\s+(\d+)/);
          if (dateParts) {
            const [_, monthName, day] = dateParts;
            const monthNames = [
              "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December",
            ];
            const monthIndex = monthNames.findIndex(
              (m) => m.toLowerCase() === monthName.toLowerCase(),
            );
            if (monthIndex !== -1) {
              return new Date(currentYear, monthIndex, parseInt(day), hourNum, parseInt(minutes));
            }
          }
        }
        return null;
      }
      return parsedDate;
    } catch {
      return null;
    }
  };

  const calculateTimeUntilArchive = (startTime: Date): string | null => {
    const now = new Date();
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    const timeSinceStart = now.getTime() - startTime.getTime();
    const timeLeftMs = sixHoursInMs - timeSinceStart;

    if (timeSinceStart >= sixHoursInMs) return "Archived";
    if (timeSinceStart < 0) return "Not started";

    const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

    return hoursLeft > 0
      ? `Archives in ${hoursLeft}h ${minutesLeft}m`
      : `Archives in ${minutesLeft}m`;
  };

  const updateArchiveCountdown = (rideData: RideInfo) => {
    if (rideData.archived) {
      setTimeUntilArchive("Archived");
      setShouldShowArchiveCountdown(false);
      return;
    }

    let startTime: Date | null = null;
    if (rideData.startTime) {
      startTime = rideData.startTime.toDate();
    } else if (rideData.date && rideData.time) {
      startTime = parseRideDateTime(rideData.date, rideData.time);
    }

    if (!startTime) {
      setTimeUntilArchive(null);
      setShouldShowArchiveCountdown(false);
      return;
    }

    const now = new Date();
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    const timeSinceStart = now.getTime() - startTime.getTime();
    const shouldShow = timeSinceStart >= 0 && timeSinceStart < sixHoursInMs;
    setShouldShowArchiveCountdown(shouldShow);

    if (shouldShow) {
      setTimeUntilArchive(calculateTimeUntilArchive(startTime));
    } else if (timeSinceStart < 0) {
      setTimeUntilArchive("Not started");
      setShouldShowArchiveCountdown(false);
    } else {
      setTimeUntilArchive(null);
      setShouldShowArchiveCountdown(false);
    }
  };

  const checkAndArchiveRide = async (rideData: RideInfo) => {
    try {
      if (rideData.archived) return;

      let startTime: Date | null = null;
      if (rideData.startTime) {
        startTime = rideData.startTime.toDate();
      } else if (rideData.date && rideData.time) {
        startTime = parseRideDateTime(rideData.date, rideData.time);
      }
      if (!startTime) return;

      const now = new Date();
      const sixHoursInMs = 6 * 60 * 60 * 1000;
      const timeSinceStart = now.getTime() - startTime.getTime();

      if (timeSinceStart >= sixHoursInMs) {
        const rideDocRef = doc(db, "rides", String(rideId));
        await updateDoc(rideDocRef, {
          archived: true,
          archivedAt: serverTimestamp(),
          isActive: false,
        });
        await addDoc(collection(db, "rides", String(rideId), "messages"), {
          text: "This ride chat has been archived because the ride started more than 6 hours ago. You can still send messages.",
          senderId: null,
          timestamp: serverTimestamp(),
          system: true,
          archivedNotice: true,
        });
        setIsArchived(true);
        setTimeUntilArchive("Archived");
        setShouldShowArchiveCountdown(false);
        if (rideCheckIntervalRef.current) clearInterval(rideCheckIntervalRef.current);
        if (archiveCountdownIntervalRef.current) clearInterval(archiveCountdownIntervalRef.current);
      } else {
        const timeUntilStart = startTime.getTime() - now.getTime();
        const shouldBeActive = timeUntilStart > 0;
        if (rideData.isActive !== shouldBeActive) {
          await updateDoc(doc(db, "rides", String(rideId)), { isActive: shouldBeActive });
        }
      }
    } catch (error) {
      console.error("Error in checkAndArchiveRide:", error);
    }
  };

  // === Load ride info ===
  useEffect(() => {
    if (!rideId) return;

    const loadRideInfo = async () => {
      try {
        const rideSnap = await getDoc(doc(db, "rides", String(rideId)));
        if (!rideSnap.exists()) return;

        const d = rideSnap.data();
        const rideData: RideInfo = {
          from: d.from || "Unknown",
          to: d.to || "Unknown",
          date: d.date || "",
          time: d.time || "",
          startTime: d.startTime || null,
          archived: d.archived || false,
          archivedAt: d.archivedAt || null,
          isActive: d.isActive !== undefined ? d.isActive : true,
          hostId: d.hostId || "",
          memberIds: d.memberIds || [],
          seats: d.seats || 0,
          rideFull: d.rideFull || false,
        };

        setRideInfo(rideData);
        setIsArchived(rideData.archived || false);

        if (rideData.archived) {
          setTimeUntilArchive("Archived");
          return;
        }

        updateArchiveCountdown(rideData);
        archiveCountdownIntervalRef.current = setInterval(() => {
          updateArchiveCountdown(rideData);
        }, 60000) as unknown as NodeJS.Timeout;

        await checkAndArchiveRide(rideData);

        rideCheckIntervalRef.current = setInterval(async () => {
          const snap = await getDoc(doc(db, "rides", String(rideId)));
          if (snap.exists()) {
            const ud = snap.data();
            const updated: RideInfo = {
              from: ud.from || "Unknown",
              to: ud.to || "Unknown",
              date: ud.date || "",
              time: ud.time || "",
              startTime: ud.startTime || null,
              archived: ud.archived || false,
              archivedAt: ud.archivedAt || null,
              isActive: ud.isActive !== undefined ? ud.isActive : true,
              hostId: ud.hostId || "",
              memberIds: ud.memberIds || [],
              seats: ud.seats || 0,
              rideFull: ud.rideFull || false,
            };
            await checkAndArchiveRide(updated);
            updateArchiveCountdown(updated);
          }
        }, 60000) as unknown as NodeJS.Timeout;
      } catch (error) {
        console.error("Error loading ride info:", error);
      }
    };

    loadRideInfo();

    return () => {
      if (rideCheckIntervalRef.current) clearInterval(rideCheckIntervalRef.current);
      if (archiveCountdownIntervalRef.current) clearInterval(archiveCountdownIntervalRef.current);
    };
  }, [rideId]);

  useEffect(() => {
    userMapRef.current = userMap;
  }, [userMap]);

  // === Load messages + user data ===
  // autoScroll is intentionally NOT in deps — read via autoScrollRef to avoid
  // tearing down and recreating the Firestore listener on every scroll event.
  useEffect(() => {
    if (!rideId) return;

    const q = query(
      collection(db, "rides", String(rideId), "messages"),
      orderBy("timestamp", "asc"),
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs);

      if (isFocused) {
        let latestNonSystemTs: number | null = null;
        let newestSenderId: string | null = null;
        for (const msg of msgs) {
          const ts = msg.timestamp?.toMillis?.() ?? null;
          if (!msg.system && ts !== null) {
            if (latestNonSystemTs === null || ts > latestNonSystemTs) {
              latestNonSystemTs = ts;
              newestSenderId = msg.senderId || null;
            }
          }
        }

        const isFirstLoad = !hasLoadedMessagesRef.current;
        const userSentLatest = newestSenderId === user?.uid;
        if (isFirstLoad || autoScrollRef.current || userSentLatest) {
          markReadIfAllowed();
          hasLoadedMessagesRef.current = true;
        } else if (isFirstLoad) {
          hasLoadedMessagesRef.current = true;
        }
      }

      // Fetch any unseen user details
      const uniqueIds = Array.from(
        new Set(msgs.map((m) => m.senderId).filter(Boolean) as string[]),
      );
      const newMap = { ...userMapRef.current };
      let hasUpdates = false;
      for (const uid of uniqueIds) {
        if (!newMap[uid]) {
          const uDoc = await getDoc(doc(db, "users", uid));
          if (uDoc.exists()) {
            const d = uDoc.data();
            newMap[uid] = { name: d.username || "Anonymous", avatar: d.avatar || DEFAULT_AVATAR };
            hasUpdates = true;
          }
        }
      }
      if (hasUpdates) setUserMap(newMap);

      // Scroll to bottom for new messages (only if autoScroll is on)
      if (autoScrollRef.current) {
        // Use requestAnimationFrame so the new message is rendered before we scroll
        requestAnimationFrame(() => {
          scrollRef.current?.scrollToEnd({ animated: hasLoadedMessagesRef.current });
        });
      }
    });

    return () => unsubscribe();
  }, [rideId, isFocused, markReadIfAllowed, user?.uid]);

  const handleUserPress = (userId: string) => {
    if (userId === user?.uid) {
      router.push("/(tabs)/profile");
    } else {
      router.push({
        pathname: "/(stack)/ride/[id]/viewProfile",
        params: { id: rideId as string, userId },
      });
    }
  };

  const sendMessage = async (messageText: string) => {
    try {
      await addDoc(collection(db, "rides", String(rideId), "messages"), {
        text: messageText,
        senderId: user?.uid,
        senderName: user?.fullName || user?.primaryEmailAddress || "Anonymous",
        avatar: user?.imageUrl || DEFAULT_AVATAR,
        timestamp: serverTimestamp(),
      });
      setInput("");
    } catch (err) {
      console.error("Failed to send message:", err);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !rideId || !user?.uid) return;

    const { filtered, containsProfanity } = filterContent(trimmed);
    if (containsProfanity) {
      Alert.alert(
        "Message Not Sent",
        "Your message contains inappropriate language and cannot be sent. Please revise your message.",
        [{ text: "OK" }],
      );
      return;
    }

    // Ensure we scroll to bottom when the user sends a message
    setAutoScrollBoth(true);
    await sendMessage(filtered);
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: "#121212", paddingTop: insets.top, paddingBottom: keyboardHeight }}
    >

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
                <Heading size="sm" color="white">Back</Heading>
              </HStack>
            </Pressable>
          </HStack>

          {/* Archive Countdown */}
          {shouldShowArchiveCountdown && timeUntilArchive && (
            <Box
              alignItems="center"
              justifyContent="center"
              paddingVertical={8}
              style={{
                backgroundColor: "#2a2a2a",
                borderBottomWidth: 1,
                borderBottomColor: "#444",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: timeUntilArchive.includes("Archives in")
                    ? "#ffcc00"
                    : timeUntilArchive === "Archived"
                      ? "#ff6666"
                      : "#888",
                  textAlign: "center",
                }}
              >
                {timeUntilArchive}
              </Text>
              <Text style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                Ride chats archive 6 hours after start time
              </Text>
            </Box>
          )}

          {/* Sticky Ride Info Card — stays visible while messages scroll */}
          {rideInfo && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(stack)/ride/[id]/group-settings",
                  params: { id: rideId as string },
                })
              }
              style={{ marginHorizontal: 12, marginTop: 10, marginBottom: 4 }}
            >
              <Box
                alignItems="center"
                paddingVertical={12}
                borderRadius={12}
                style={{
                  backgroundColor: isArchived ? "#2a2a2a" : "#1e1e1e",
                  borderWidth: 1,
                  borderColor: isArchived ? "#444" : "#333",
                  opacity: isArchived ? 0.8 : 1,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "600", color: isArchived ? "#888" : "white", textAlign: "center" }}>
                  {rideInfo.from} → {rideInfo.to}
                </Text>
                <Text style={{ fontSize: 14, color: isArchived ? "#666" : "#a0a0a0", marginTop: 4 }}>
                  {rideInfo.date} at {rideInfo.time}
                </Text>
                <Text style={{ fontSize: 12, color: isArchived ? "#666" : "#808080", marginTop: 2 }}>
                  {rideInfo.memberIds?.length || 0} member(s) • {rideInfo.seats} seat(s)
                </Text>
                <Text style={{ fontSize: 12, color: isArchived ? "#666" : "#a0a0a0", marginTop: 4 }}>
                  {isArchived
                    ? "Chat Archived • Ride started more than 6 hours ago"
                    : "Tap to view group members"}
                </Text>
              </Box>
            </Pressable>
          )}

          {/* Messages — fills all remaining vertical space */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => setAutoScrollBoth(false)}
            onMomentumScrollEnd={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const distanceFromBottom =
                contentSize.height - (contentOffset.y + layoutMeasurement.height);
              if (distanceFromBottom < 40) setAutoScrollBoth(true);
            }}
            onScrollEndDrag={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const distanceFromBottom =
                contentSize.height - (contentOffset.y + layoutMeasurement.height);
              if (distanceFromBottom < 40) setAutoScrollBoth(true);
            }}
          >

            {/* Archived Notice */}
            {isArchived && (
              <Box
                alignItems="center"
                paddingVertical={10}
                mb="$4"
                borderRadius={8}
                style={{
                  backgroundColor: "#2d2d00",
                  borderWidth: 1,
                  borderColor: "#555500",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "500", color: "#ffff99", textAlign: "center", paddingHorizontal: 10 }}>
                  ⚠️ This ride chat has been archived because the ride started more than 6 hours ago. You can still send and receive messages.
                </Text>
              </Box>
            )}

            {/* Messages */}
            <VStack space="sm">
              {messages.map((msg, index) => {
                const isSystem = msg.system === true;
                const isArchivedNotice = !!msg.archivedNotice;
                const isCurrentUser = msg.senderId === user?.uid;
                const sender = userMap[msg.senderId || ""] || {
                  name: msg.senderName || "Unknown",
                  avatar: msg.avatar || DEFAULT_AVATAR,
                };

                const currentMsgDate = msg.timestamp?.toDate();
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const prevMsgDate = prevMsg?.timestamp?.toDate();

                let showTimeDivider = false;
                let dividerText = "";

                if (currentMsgDate) {
                  if (index === 0) {
                    showTimeDivider = true;
                  } else if (prevMsgDate) {
                    const timeDiff = currentMsgDate.getTime() - prevMsgDate.getTime();
                    const isDifferentDay = currentMsgDate.toDateString() !== prevMsgDate.toDateString();
                    const isHourApart = timeDiff >= 60 * 60 * 1000;
                    if (isDifferentDay || isHourApart) showTimeDivider = true;
                  }

                  if (showTimeDivider) {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const time = currentMsgDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

                    if (currentMsgDate.toDateString() === today.toDateString()) {
                      dividerText = `Today ${time}`;
                    } else if (currentMsgDate.toDateString() === yesterday.toDateString()) {
                      dividerText = `Yesterday ${time}`;
                    } else {
                      const date = currentMsgDate.toLocaleDateString([], { month: "long", day: "numeric" });
                      dividerText = `${date} ${time}`;
                    }
                  }
                }

                if (isSystem || isArchivedNotice) {
                  return (
                    <Box key={msg.id} alignItems="center" paddingVertical={6}>
                      <Box
                        px="$3"
                        py="$2"
                        borderRadius="$xl"
                        style={{
                          backgroundColor: isArchivedNotice ? "#2d2d00" : "transparent",
                          borderWidth: isArchivedNotice ? 1 : 0,
                          borderColor: isArchivedNotice ? "#555500" : "transparent",
                        }}
                      >
                        <Text fontSize="$xs" color={isArchivedNotice ? "#ffff99" : "#888"} textAlign="center">
                          {msg.text}
                        </Text>
                      </Box>
                    </Box>
                  );
                }

                return (
                  <React.Fragment key={`msg-frag-${msg.id}`}>
                    {showTimeDivider && (
                      <Box alignItems="center" my="$3">
                        <Text fontSize="$xs" color="#888888" fontWeight="500">
                          {dividerText}
                        </Text>
                      </Box>
                    )}
                    <HStack
                      space="sm"
                      alignItems="flex-end"
                      justifyContent={isCurrentUser ? "flex-end" : "flex-start"}
                    >
                      {!isCurrentUser && (
                        <TouchableOpacity onPress={() => handleUserPress(msg.senderId || "")} activeOpacity={0.7}>
                          <Avatar size="sm" bgColor="#1e1e1e">
                            <Avatar.Image source={{ uri: sender.avatar }} alt="User avatar" />
                          </Avatar>
                        </TouchableOpacity>
                      )}

                      <VStack alignItems={isCurrentUser ? "flex-end" : "flex-start"} maxWidth="80%">
                        {!isCurrentUser && (
                          <TouchableOpacity onPress={() => handleUserPress(msg.senderId || "")} activeOpacity={0.7}>
                            <Text fontSize="$xs" color="#aaaaaa" mb="$1" pl="$2">
                              {sender.name}
                            </Text>
                          </TouchableOpacity>
                        )}

                        <Box
                          pl={isCurrentUser ? "$4" : "$0"}
                          pr="$4"
                          py="$2"
                          bg={isCurrentUser ? ACCENT : "#1e1e1e"}
                          borderTopLeftRadius={isCurrentUser ? "$xl" : "$sm"}
                          borderTopRightRadius={isCurrentUser ? "$sm" : "$xl"}
                          borderBottomLeftRadius="$xl"
                          borderBottomRightRadius="$xl"
                        >
                          <Text color={isCurrentUser ? "#121212" : "#e0e0e0"} fontSize="$sm" pl={isCurrentUser ? "$0" : "$2"}>
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
                            {msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        )}
                      </VStack>
                    </HStack>
                  </React.Fragment>
                );
              })}
            </VStack>
          </ScrollView>

          {/* Input bar — sibling of ScrollView, always visible above keyboard */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: keyboardHeight > 0 ? 8 : safeBottom,
              backgroundColor: "#121212",
              borderTopWidth: 1,
              borderTopColor: "#2a2a2a",
              gap: 8,
            }}
          >
            <Input
              flex={1}
              size="md"
              borderWidth={0}
              borderRadius="$full"
              backgroundColor={isArchived ? "#1a1a1a" : "#2a2a2a"}
              px="$4"
              py="$2"
            >
              <InputField
                placeholder={isArchived ? "Chat archived - you can still message..." : "Message..."}
                placeholderTextColor={isArchived ? "#555" : "#777"}
                color="white"
                value={input}
                onChangeText={setInput}
                multiline
                textAlignVertical="top"
                style={{ maxHeight: 100 }}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
              />
            </Input>

            <Pressable onPressIn={animatePressIn} onPressOut={animatePressOut} onPress={handleSend}>
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
          </View>

    </View>
  );
}
