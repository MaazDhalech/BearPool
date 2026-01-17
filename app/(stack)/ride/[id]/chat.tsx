import { db } from "@/services/firebaseConfig";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  Box,
  Heading,
  HStack,
  Input,
  InputField,
  Pressable,
  ScrollView,
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
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as filter from "leo-profanity";

// Optional: Customize filter on startup
filter.add(["berkeleyhate", "ridebully"]); // Add ride-specific slurs
// filter.remove("assassin"); // Avoid false positives

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

// Define message type
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
  const { user } = useUser();
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
  const scrollRef = useRef<any>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const insets = useSafeAreaInsets();

  const animatedValue = useRef(new Animated.Value(0)).current;
  const prevMembersRef = useRef<string[] | null>(null);
  const pendingSystemMessageRef = useRef<Map<string, number>>(new Map());
  const listenerActiveRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const hasLoadedMessagesRef = useRef(false);
  const lastReadWriteAtRef = useRef(0);
  const rideCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const archiveCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const readStateHeartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const updateReadState = useCallback(
    async (payload: Record<string, any>) => {
      if (!rideId || !user?.id) return;
      try {
        await setDoc(
          doc(db, "rides", String(rideId), "readState", user.id),
          payload,
          { merge: true },
        );
      } catch (error) {
        console.error("Failed to update read state", error);
      }
    },
    [rideId, user?.id],
  );

  const markReadIfAllowed = useCallback(() => {
    const now = Date.now();
    if (now - lastReadWriteAtRef.current < 4000) return; // throttle to avoid spamming writes
    lastReadWriteAtRef.current = now;
    updateReadState({ lastReadAt: serverTimestamp() });
  }, [updateReadState]);

  useFocusEffect(
    useCallback(() => {
      if (!rideId || !user?.id) return;

      hasLoadedMessagesRef.current = false;
      // Mark as active on entry
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
    }, [rideId, updateReadState, user?.id]),
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
    outputRange: ["#3a7bd5", "#122a58"],
  });

  // === Content filtering using leo-profanity ===
  const filterContent = (
    text: string,
  ): { filtered: string; containsProfanity: boolean } => {
    const containsProfanity = filter.check(text);
    const filtered = filter.clean(text);
    return { filtered, containsProfanity };
  };

  // === Parse date and time from your Firebase structure ===
  const parseRideDateTime = (dateStr: string, timeStr: string): Date | null => {
    try {
      // Parse date like "January 16" - assuming current year
      const currentYear = new Date().getFullYear();
      const dateTimeStr = `${dateStr}, ${currentYear} ${timeStr}`;

      // Try parsing with different formats
      const parsedDate = new Date(dateTimeStr);

      // If parsing fails, try alternative formats
      if (isNaN(parsedDate.getTime())) {
        // Try with different time format
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
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ];
            const monthIndex = monthNames.findIndex(
              (m) => m.toLowerCase() === monthName.toLowerCase(),
            );

            if (monthIndex !== -1) {
              return new Date(
                currentYear,
                monthIndex,
                parseInt(day),
                hourNum,
                parseInt(minutes),
              );
            }
          }
        }
        return null;
      }

      return parsedDate;
    } catch (error) {
      console.error("Error parsing date/time:", error);
      return null;
    }
  };

  // === Calculate time until archive ===
  const calculateTimeUntilArchive = (startTime: Date): string | null => {
    const now = new Date();
    const sixHoursInMs = 6 * 60 * 60 * 1000;
    const timeSinceStart = now.getTime() - startTime.getTime();
    const timeLeftMs = sixHoursInMs - timeSinceStart;

    // If ride has already passed the archive threshold
    if (timeSinceStart >= sixHoursInMs) {
      return "Archived";
    }

    // If ride hasn't started yet
    if (timeSinceStart < 0) {
      return "Not started";
    }

    // Calculate hours and minutes remaining
    const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
    const minutesLeft = Math.floor(
      (timeLeftMs % (1000 * 60 * 60)) / (1000 * 60),
    );

    if (hoursLeft > 0) {
      return `Archives in ${hoursLeft}h ${minutesLeft}m`;
    } else {
      return `Archives in ${minutesLeft}m`;
    }
  };

  // === Update archive countdown ===
  const updateArchiveCountdown = (rideData: RideInfo) => {
    if (rideData.archived) {
      setTimeUntilArchive("Archived");
      setShouldShowArchiveCountdown(false);
      return;
    }

    // Parse start time
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

    // Only show countdown if ride has started but not yet archived
    const shouldShow = timeSinceStart >= 0 && timeSinceStart < sixHoursInMs;
    setShouldShowArchiveCountdown(shouldShow);

    if (shouldShow) {
      const timeLeft = calculateTimeUntilArchive(startTime);
      setTimeUntilArchive(timeLeft);
    } else if (timeSinceStart < 0) {
      setTimeUntilArchive("Not started");
      setShouldShowArchiveCountdown(false);
    } else {
      setTimeUntilArchive(null);
      setShouldShowArchiveCountdown(false);
    }
  };

  // === Check if ride should be archived ===
  const checkAndArchiveRide = async (rideData: RideInfo) => {
    try {
      // If already archived, skip
      if (rideData.archived) {
        console.log(`📁 Ride ${rideId} is already archived`);
        return;
      }

      // Parse start time from date and time strings
      let startTime: Date | null = null;

      // First check if we have a startTime field (for backward compatibility)
      if (rideData.startTime) {
        startTime = rideData.startTime.toDate();
      } else if (rideData.date && rideData.time) {
        // Parse from date and time strings
        startTime = parseRideDateTime(rideData.date, rideData.time);
      }

      if (!startTime) {
        console.log(`❌ Could not determine start time for ride ${rideId}`);
        return;
      }

      const now = new Date();
      const sixHoursInMs = 6 * 60 * 60 * 1000;
      const timeSinceStart = now.getTime() - startTime.getTime();

      console.log(
        `🕒 Ride start time: ${startTime}, Now: ${now}, Time since start: ${timeSinceStart}ms`,
      );

      // Check if ride should be archived (6+ hours since start)
      if (timeSinceStart >= sixHoursInMs) {
        console.log(`🕒 Ride ${rideId} should be archived. Archiving now...`);

        try {
          // Update ride document to mark as archived
          const rideDocRef = doc(db, "rides", String(rideId));
          await updateDoc(rideDocRef, {
            archived: true,
            archivedAt: serverTimestamp(),
            isActive: false, // Also set isActive to false
          });

          // Add archive system message
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

          // Clear the intervals since ride is now archived
          if (rideCheckIntervalRef.current) {
            clearInterval(rideCheckIntervalRef.current);
          }
          if (archiveCountdownIntervalRef.current) {
            clearInterval(archiveCountdownIntervalRef.current);
          }

          console.log(`✅ Successfully archived ride ${rideId}`);
        } catch (error) {
          console.error("❌ Error archiving ride:", error);
        }
      } else {
        // Check if ride should be active based on current time vs start time
        const timeUntilStart = startTime.getTime() - now.getTime();
        const shouldBeActive = timeUntilStart > 0; // Ride is active if it hasn't started yet

        if (rideData.isActive !== shouldBeActive) {
          const rideDocRef = doc(db, "rides", String(rideId));
          await updateDoc(rideDocRef, {
            isActive: shouldBeActive,
          });
          console.log(
            `🔄 Updated ride ${rideId} isActive to: ${shouldBeActive}`,
          );
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
        if (rideSnap.exists()) {
          const d = rideSnap.data();

          // Create RideInfo object from your Firebase structure
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

          // Check if already archived
          if (rideData.archived) {
            setTimeUntilArchive("Archived");
            console.log(`📁 Ride ${rideId} is already archived`);
            return;
          }

          // Update archive countdown
          updateArchiveCountdown(rideData);

          // Set up interval to update countdown every minute
          archiveCountdownIntervalRef.current = setInterval(() => {
            updateArchiveCountdown(rideData);
          }, 60000) as unknown as NodeJS.Timeout;

          // Check if should be archived
          await checkAndArchiveRide(rideData);

          // Set up interval to check for archiving every minute
          if (!rideData.archived) {
            rideCheckIntervalRef.current = setInterval(async () => {
              console.log(
                `⏰ Checking if ride ${rideId} should be archived...`,
              );
              const updatedRideSnap = await getDoc(
                doc(db, "rides", String(rideId)),
              );
              if (updatedRideSnap.exists()) {
                const updatedData = updatedRideSnap.data();
                const updatedRideInfo: RideInfo = {
                  from: updatedData.from || "Unknown",
                  to: updatedData.to || "Unknown",
                  date: updatedData.date || "",
                  time: updatedData.time || "",
                  startTime: updatedData.startTime || null,
                  archived: updatedData.archived || false,
                  archivedAt: updatedData.archivedAt || null,
                  isActive:
                    updatedData.isActive !== undefined
                      ? updatedData.isActive
                      : true,
                  hostId: updatedData.hostId || "",
                  memberIds: updatedData.memberIds || [],
                  seats: updatedData.seats || 0,
                  rideFull: updatedData.rideFull || false,
                };
                await checkAndArchiveRide(updatedRideInfo);
                updateArchiveCountdown(updatedRideInfo);
              }
            }, 60000) as unknown as NodeJS.Timeout;
          }
        } else {
          console.log(`❌ No ride found with ID: ${rideId}`);
        }
      } catch (error) {
        console.error("Error loading ride info:", error);
      }
    };

    loadRideInfo();

    // Cleanup intervals on unmount
    return () => {
      if (rideCheckIntervalRef.current) {
        clearInterval(rideCheckIntervalRef.current);
      }
      if (archiveCountdownIntervalRef.current) {
        clearInterval(archiveCountdownIntervalRef.current);
      }
    };
  }, [rideId]);

  const fetchUserDetails = async (uid: string) => {
    if (userMap[uid]) return;
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

  const handleUserPress = (userId: string) => {
    if (userId === user?.id) {
      router.push("/(tabs)/profile");
    } else {
      router.push({
        pathname: "/(stack)/ride/[id]/viewProfile",
        params: { id: rideId as string, userId },
      });
    }
  };

  useEffect(() => {
    userMapRef.current = userMap;
  }, [userMap]);

  // === System messages for join/leave ===
  useEffect(() => {
    if (!rideId) return;

    // Prevent multiple listeners
    if (listenerActiveRef.current) {
      console.log(`⚠️ Listener already active for ride ${rideId}, skipping`);
      return;
    }

    listenerActiveRef.current = true;
    console.log(`🔵 Setting up ride listener for ride: ${rideId}`);

    const rideDocRef = doc(db, "rides", String(rideId));
    const unsubRide = onSnapshot(rideDocRef, async (snap) => {
      const data = snap.data();
      if (!data) {
        console.log(`⚠️ No data found for ride ${rideId}`);
        return;
      }

      const newMembers: string[] = data.memberIds || [];
      const prevMembers = prevMembersRef.current;

      console.log(`👥 Member change detected:`, {
        previous: prevMembers,
        current: newMembers,
        isInitialLoad: prevMembers === null,
      });

      // Initial load - just store the current members
      if (prevMembers === null) {
        console.log(`📝 Initial load - storing ${newMembers.length} members`);
        prevMembersRef.current = newMembers;
        hasInitializedRef.current = true;
        return;
      }

      const joined = newMembers.filter((uid) => !prevMembers.includes(uid));
      const left = prevMembers.filter((uid) => !newMembers.includes(uid));

      console.log(`📊 Changes: ${joined.length} joined, ${left.length} left`);

      // Process each join event
      for (const uid of joined) {
        console.log(`✅ Processing join for user: ${uid}`);

        const now = Date.now();
        const lastMessageTime = pendingSystemMessageRef.current.get(
          `join-${uid}`,
        );

        // Skip if we sent a message for this user in the last 10 seconds
        if (lastMessageTime && now - lastMessageTime < 10000) {
          console.log(
            `⏭️ Skipping duplicate join message for ${uid} (sent ${
              now - lastMessageTime
            }ms ago)`,
          );
          continue;
        }

        try {
          // Fetch user name
          let name = userMapRef.current[uid]?.name;
          if (!name) {
            console.log(`🔍 Fetching user data for ${uid}`);
            const uDoc = await getDoc(doc(db, "users", uid));
            name = uDoc.exists()
              ? uDoc.data().username || "Anonymous"
              : "Unknown";
          }

          console.log(`✉️ Creating join message for ${name} (${uid})`);

          // Mark as pending BEFORE creating the message
          pendingSystemMessageRef.current.set(`join-${uid}`, now);

          // Create system message
          await addDoc(collection(db, "rides", String(rideId), "messages"), {
            text: `${name} has joined the ride`,
            senderId: null,
            timestamp: serverTimestamp(),
            system: true,
          });

          console.log(`✅ Join message created successfully`);
        } catch (error) {
          console.error("❌ Error creating join message:", error);
          // Remove from pending on error so it can be retried
          pendingSystemMessageRef.current.delete(`join-${uid}`);
        }
      }

      // Process each leave event
      for (const uid of left) {
        console.log(`❌ Processing leave for user: ${uid}`);

        const now = Date.now();
        const lastMessageTime = pendingSystemMessageRef.current.get(
          `leave-${uid}`,
        );

        // Skip if we sent a message for this user in the last 10 seconds
        if (lastMessageTime && now - lastMessageTime < 10000) {
          console.log(
            `⏭️ Skipping duplicate leave message for ${uid} (sent ${
              now - lastMessageTime
            }ms ago)`,
          );
          continue;
        }

        try {
          // Fetch user name
          let name = userMapRef.current[uid]?.name;
          if (!name) {
            console.log(`🔍 Fetching user data for ${uid}`);
            const uDoc = await getDoc(doc(db, "users", uid));
            name = uDoc.exists()
              ? uDoc.data().username || "Anonymous"
              : "Unknown";
          }

          console.log(`✉️ Creating leave message for ${name} (${uid})`);

          // Mark as pending BEFORE creating the message
          pendingSystemMessageRef.current.set(`leave-${uid}`, now);

          // Create system message
          await addDoc(collection(db, "rides", String(rideId), "messages"), {
            text: `${name} has left the ride`,
            senderId: null,
            timestamp: serverTimestamp(),
            system: true,
          });

          console.log(`✅ Leave message created successfully`);
        } catch (error) {
          console.error("❌ Error creating leave message:", error);
          // Remove from pending on error so it can be retried
          pendingSystemMessageRef.current.delete(`leave-${uid}`);
        }
      }

      prevMembersRef.current = newMembers;
    });

    return () => {
      console.log(`🔴 Cleaning up ride listener for ride: ${rideId}`);
      listenerActiveRef.current = false;
      unsubRide();
    };
  }, [rideId]);

  // === Load messages + user data ===
  useEffect(() => {
    if (!rideId) return;

    const q = query(
      collection(db, "rides", String(rideId), "messages"),
      orderBy("timestamp", "asc"),
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(msgs);

      if (isFocused) {
        // Determine latest non-system message timestamp
        let latestNonSystemTs: number | null = null;
        let newestSenderId: string | null = null;
        for (const msg of msgs) {
          const isSystem = msg.system === true;
          const ts = msg.timestamp?.toMillis?.()
            ? msg.timestamp.toMillis()
            : null;
          if (!isSystem && ts !== null) {
            if (latestNonSystemTs === null || ts > latestNonSystemTs) {
              latestNonSystemTs = ts;
              newestSenderId = msg.senderId || null;
            }
          }
        }

        const isFirstLoad = !hasLoadedMessagesRef.current;
        const userSentLatest = newestSenderId && newestSenderId === user?.id;
        const shouldMarkRead = isFirstLoad || autoScroll || userSentLatest;

        if (shouldMarkRead) {
          markReadIfAllowed();
          hasLoadedMessagesRef.current = true;
        } else if (isFirstLoad) {
          // On first load while focused, mark as loaded even if we didn't mark read
          hasLoadedMessagesRef.current = true;
        }
      }

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
            newMap[uid] = {
              name: d.username || "Anonymous",
              avatar: d.avatar || DEFAULT_AVATAR,
            };
            hasUpdates = true;
          }
        }
      }

      if (hasUpdates) {
        setUserMap(newMap);
      }

      if (autoScroll) {
        InteractionManager.runAfterInteractions(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        });
      }
    });

    return () => unsubscribe();
  }, [
    rideId,
    autoScroll,
    isFocused,
    updateReadState,
    markReadIfAllowed,
    user?.id,
  ]);

  // === Send message with filtering and archive check ===
  const sendMessage = async (messageText: string) => {
    try {
      console.log("Sending message:", {
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
      console.error("Failed to send message:", err);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !rideId || !user?.id) return;

    const { filtered, containsProfanity } = filterContent(trimmed);

    // === Option 1: Block profane messages ===
    if (containsProfanity) {
      Alert.alert(
        "Message Not Sent",
        "Your message contains inappropriate language and cannot be sent. Please revise your message.",
        [{ text: "OK" }],
      );
      return;
    }

    // === Option 2: Allow filtered message (uncomment to enable) ===
    /*
    if (containsProfanity) {
      Alert.alert(
        "Message Filtered",
        "Your message contained inappropriate language and has been filtered.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Send Anyway",
            onPress: () => sendMessage(filtered),
          },
        ]
      );
      return;
    }
    */

    await sendMessage(filtered);
  };

  const handleInputChange = (text: string) => {
    setInput(text);
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

            {/* Archive Countdown Indicator */}
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
                  {timeUntilArchive.includes("Archives in")}
                  {timeUntilArchive}
                  {timeUntilArchive.includes("Archives in")}
                </Text>
                <Text
                  style={{
                    fontSize: 10,
                    color: "#666",
                    marginTop: 2,
                  }}
                >
                  Ride chats archive 6 hours after start time
                </Text>
              </Box>
            )}

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
                  <Box
                    alignItems="center"
                    paddingVertical={12}
                    marginBottom={16}
                    borderRadius={12}
                    style={{
                      backgroundColor: isArchived ? "#2a2a2a" : "#1e1e1e",
                      borderWidth: 1,
                      borderColor: isArchived ? "#444" : "#333",
                      opacity: isArchived ? 0.8 : 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "600",
                        color: isArchived ? "#888" : "white",
                        textAlign: "center",
                      }}
                    >
                      {rideInfo.from} → {rideInfo.to}
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        color: isArchived ? "#666" : "#a0a0a0",
                        marginTop: 4,
                      }}
                    >
                      {rideInfo.date} at {rideInfo.time}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: isArchived ? "#666" : "#808080",
                        marginTop: 2,
                      }}
                    >
                      {rideInfo.memberIds?.length || 0} member(s) •{" "}
                      {rideInfo.seats} seat(s)
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: isArchived ? "#666" : "#a0a0a0",
                        marginTop: 4,
                      }}
                    >
                      {isArchived
                        ? "Chat Archived • Ride started more than 6 hours ago"
                        : "Tap to view group members"}
                    </Text>
                  </Box>
                </Pressable>
              )}

              {/* Archived Notice */}
              {isArchived && (
                <Box
                  alignItems="center"
                  paddingVertical={10}
                  marginBottom={16}
                  borderRadius={8}
                  style={{
                    backgroundColor: "#2d2d00",
                    borderWidth: 1,
                    borderColor: "#555500",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "500",
                      color: "#ffff99",
                      textAlign: "center",
                      paddingHorizontal: 10,
                    }}
                  >
                    ⚠️ This ride chat has been archived because the ride started
                    more than 6 hours ago. You can still send and receive
                    messages.
                  </Text>
                </Box>
              )}

              {/* Messages */}
              <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 90 }}
                onScroll={({ nativeEvent }) => {
                  if (nativeEvent.contentOffset.y > 30 && autoScroll) {
                    setAutoScroll(false);
                  }
                }}
                onScrollToTop={() => setAutoScroll(false)}
                onMomentumScrollEnd={({ nativeEvent }) => {
                  const { layoutMeasurement, contentOffset, contentSize } =
                    nativeEvent;
                  const distanceFromBottom =
                    contentSize.height -
                    (contentOffset.y + layoutMeasurement.height);
                  if (distanceFromBottom < 30) setAutoScroll(true);
                }}
                scrollEventThrottle={16}
              >
                <VStack space="sm">
                  {messages.map((msg, index) => {
                    const isSystem = msg.system === true;
                    const isArchivedNotice = !!msg.archivedNotice;
                    const isCurrentUser = msg.senderId === user?.id;
                    const sender = userMap[msg.senderId || ""] || {
                      name: msg.senderName || "Unknown",
                      avatar: msg.avatar || DEFAULT_AVATAR,
                    };

                    // Determine if we need to show a timestamp divider
                    const currentMsgDate = msg.timestamp?.toDate();
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const prevMsgDate = prevMsg?.timestamp?.toDate();

                    let showTimeDivider = false;
                    let dividerText = "";

                    if (currentMsgDate) {
                      if (index === 0) {
                        // First message always gets a timestamp
                        showTimeDivider = true;
                      } else if (prevMsgDate) {
                        const timeDiff =
                          currentMsgDate.getTime() - prevMsgDate.getTime();
                        const hourInMs = 60 * 60 * 1000;

                        // Check if different days
                        const isDifferentDay =
                          currentMsgDate.toDateString() !==
                          prevMsgDate.toDateString();

                        // Check if more than 1 hour apart
                        const isHourApart = timeDiff >= hourInMs;

                        if (isDifferentDay || isHourApart) {
                          showTimeDivider = true;
                        }
                      }

                      if (showTimeDivider) {
                        const today = new Date();
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);

                        const time = currentMsgDate.toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        });

                        if (
                          currentMsgDate.toDateString() === today.toDateString()
                        ) {
                          dividerText = `Today ${time}`;
                        } else if (
                          currentMsgDate.toDateString() ===
                          yesterday.toDateString()
                        ) {
                          dividerText = `Yesterday ${time}`;
                        } else {
                          const date = currentMsgDate.toLocaleDateString([], {
                            month: "long",
                            day: "numeric",
                          });
                          dividerText = `${date} ${time}`;
                        }
                      }
                    }

                    if (isSystem || isArchivedNotice) {
                      return (
                        <Box
                          key={msg.id}
                          alignItems="center"
                          paddingVertical={6}
                        >
                          <Box
                            px="$3"
                            py="$2"
                            borderRadius="$xl"
                            style={{
                              backgroundColor: isArchivedNotice
                                ? "#2d2d00"
                                : "transparent",
                              borderWidth: isArchivedNotice ? 1 : 0,
                              borderColor: isArchivedNotice
                                ? "#555500"
                                : "transparent",
                            }}
                          >
                            <Text
                              fontSize="$xs"
                              color={isArchivedNotice ? "#ffff99" : "#888"}
                              textAlign="center"
                            >
                              {msg.text}
                            </Text>
                          </Box>
                        </Box>
                      );
                    }

                    return (
                      <>
                        {showTimeDivider && (
                          <Box
                            key={`divider-${msg.id}`}
                            alignItems="center"
                            my="$3"
                          >
                            <Text
                              fontSize="$xs"
                              color="#888888"
                              fontWeight="500"
                            >
                              {dividerText}
                            </Text>
                          </Box>
                        )}
                        <HStack
                          key={msg.id}
                          space="sm"
                          alignItems="flex-end"
                          justifyContent={
                            isCurrentUser ? "flex-end" : "flex-start"
                          }
                        >
                          {!isCurrentUser && (
                            <TouchableOpacity
                              onPress={() =>
                                handleUserPress(msg.senderId || "")
                              }
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
                            alignItems={
                              isCurrentUser ? "flex-end" : "flex-start"
                            }
                            maxWidth="80%"
                          >
                            {!isCurrentUser && (
                              <TouchableOpacity
                                onPress={() =>
                                  handleUserPress(msg.senderId || "")
                                }
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
                              borderTopLeftRadius={
                                isCurrentUser ? "$xl" : "$sm"
                              }
                              borderTopRightRadius={
                                isCurrentUser ? "$sm" : "$xl"
                              }
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
                      </>
                    );
                  })}
                </VStack>
              </ScrollView>

              {/* Input */}
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
                  backgroundColor={isArchived ? "#1a1a1a" : "#2a2a2a"}
                  px="$4"
                  py="$2"
                >
                  <InputField
                    placeholder={
                      isArchived
                        ? "Chat archived - you can still message..."
                        : "Message..."
                    }
                    placeholderTextColor={isArchived ? "#555" : "#777"}
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
