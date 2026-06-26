import { ACCENT } from "@/constants/Colors";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { NavHeader } from "@/components/ui/NavHeader";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/services/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  HStack,
  Input,
  InputField,
  Pressable,
  Text,
} from "@gluestack-ui/themed";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
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
import * as filter from "leo-profanity";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  TouchableOpacity as GHTouchableOpacity,
} from "react-native-gesture-handler";
import ReAnimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

filter.add(["berkeleyhate", "ridebully"]);

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

const MAX_CHARS = 500;

type UserMap = { [userId: string]: { name: string; avatar: string } };

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

type ReplyMeta = {
  id: string;
  text: string;
  senderName: string;
  senderId: string;
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
  deleted?: boolean;
  sent?: boolean;
  replyTo?: ReplyMeta | null;
};

type ProcessedMessage = Message & {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

type ListItem =
  | { type: "message"; data: ProcessedMessage }
  | { type: "divider"; id: string; text: string };

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
  }, []);

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
        Say hi to your group. Coordinate pickup spots, arrival times, or just break the ice.
      </Text>
    </View>
  );
}

function TypingDots() {
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const d3 = useSharedValue(0);

  useEffect(() => {
    const bounce = (sv: typeof d1, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: 350 }),
          ),
          -1,
          false,
        ),
      );
    };
    bounce(d1, 0);
    bounce(d2, 160);
    bounce(d3, 320);
  }, []);

  const s1 = useAnimatedStyle(() => ({ opacity: 0.35 + d1.value * 0.65, transform: [{ translateY: -d1.value * 4 }] }));
  const s2 = useAnimatedStyle(() => ({ opacity: 0.35 + d2.value * 0.65, transform: [{ translateY: -d2.value * 4 }] }));
  const s3 = useAnimatedStyle(() => ({ opacity: 0.35 + d3.value * 0.65, transform: [{ translateY: -d3.value * 4 }] }));

  const dot = { width: 6, height: 6, borderRadius: 3, backgroundColor: "#888" as const };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2 }}>
      <ReAnimated.View style={[dot, s1]} />
      <ReAnimated.View style={[dot, s2]} />
      <ReAnimated.View style={[dot, s3]} />
    </View>
  );
}

const REPLY_THRESHOLD = 56;

// Swipe-right-to-reply wrapper (WhatsApp/iMessage style). Translates the row
// as you drag right; past the threshold it fires a haptic and triggers onReply.
function SwipeableMessage({
  onReply,
  children,
}: {
  onReply: () => void;
  children: React.ReactNode;
}) {
  const tx = useSharedValue(0);
  const hapticFired = useSharedValue(false);

  const fireHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  const pan = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      tx.value = Math.min(Math.max(e.translationX, 0), 84);
      if (tx.value >= REPLY_THRESHOLD && !hapticFired.value) {
        hapticFired.value = true;
        runOnJS(fireHaptic)();
      } else if (tx.value < REPLY_THRESHOLD && hapticFired.value) {
        hapticFired.value = false;
      }
    })
    .onEnd(() => {
      if (tx.value >= REPLY_THRESHOLD) runOnJS(onReply)();
      tx.value = withSpring(0, { damping: 20, stiffness: 220 });
      hapticFired.value = false;
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  // Timestamp revealed in the left gutter as the row slides right.
  const stampStyle = useAnimatedStyle(() => {
    const p = Math.min(tx.value / REPLY_THRESHOLD, 1);
    return { opacity: p, transform: [{ translateX: (1 - p) * -8 }] };
  });

  return (
    <View>
      <ReAnimated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: SPACE.md,
            top: 0,
            bottom: 0,
            width: 72,
            alignItems: "center",
            justifyContent: "center",
          },
          stampStyle,
        ]}
      >
        <Ionicons name="arrow-undo" size={18} color="#9a9a9a" />
        <Text
          style={{
            fontSize: TYPE.size.micro,
            color: "#9a9a9a",
            fontWeight: "600",
            marginTop: 2,
          }}
        >
          Reply
        </Text>
      </ReAnimated.View>
      <GestureDetector gesture={pan}>
        <ReAnimated.View style={rowStyle}>{children}</ReAnimated.View>
      </GestureDetector>
    </View>
  );
}

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
  const [shouldShowArchiveCountdown, setShouldShowArchiveCountdown] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [memberReadAt, setMemberReadAt] = useState<Record<string, number>>({});
  const [replyTo, setReplyTo] = useState<ReplyMeta | null>(null);
  const inputRef = useRef<any>(null);

  const userMapRef = useRef<UserMap>({});
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const autoScrollRef = useRef(true);
  const hasLoadedMessagesRef = useRef(false);
  const lastReadWriteAtRef = useRef(0);
  const rideCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const archiveCountdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const readStateHeartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const typingDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom > 0 ? insets.bottom : 8;
  const inputPadBottom = keyboardHeight > 0 ? 3 : safeBottom;

  const animatedValue = useRef(new Animated.Value(0)).current;
  const sendScale = useSharedValue(1);
  const sendScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  // ── Keyboard height tracking ──────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: any) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  // ── Scroll ──────────────────────────────────────────
  const setAutoScrollBoth = useCallback((val: boolean) => {
    autoScrollRef.current = val;
    setAutoScroll(val);
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  // ── Read state ───────────────────────────────────────
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
      updateReadState({ activeChat: true, activeAt: serverTimestamp() });

      readStateHeartbeatRef.current = setInterval(() => {
        updateReadState({ activeChat: true, activeAt: serverTimestamp() });
      }, 27000) as unknown as NodeJS.Timeout;

      return () => {
        if (readStateHeartbeatRef.current) {
          clearInterval(readStateHeartbeatRef.current);
          readStateHeartbeatRef.current = null;
        }
        updateReadState({ activeChat: false, activeAt: serverTimestamp() });
      };
    }, [rideId, updateReadState, user?.uid]),
  );

  // ── Send button animation ────────────────────────────
  const animatePressIn = () => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
    sendScale.value = withSpring(0.88, { damping: 18, stiffness: 500 });
  };

  const animatePressOut = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
    sendScale.value = withSpring(1, { damping: 12, stiffness: 300 });
  };

  const interpolatedColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [ACCENT, "#2a2a2a"],
  });

  // ── Helpers ──────────────────────────────────────────
  const filterContent = (text: string) => ({
    filtered: filter.clean(text),
    containsProfanity: filter.check(text),
  });

  const parseRideDateTime = (dateStr: string, timeStr: string): Date | null => {
    try {
      const currentYear = new Date().getFullYear();
      const parsedDate = new Date(`${dateStr}, ${currentYear} ${timeStr}`);
      if (!isNaN(parsedDate.getTime())) return parsedDate;

      const timeParts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeParts) {
        let [_, hours, minutes, period] = timeParts;
        let hourNum = parseInt(hours);
        if (period.toUpperCase() === "PM" && hourNum < 12) hourNum += 12;
        if (period.toUpperCase() === "AM" && hourNum === 12) hourNum = 0;

        const dateParts = dateStr.match(/(\w+)\s+(\d+)/);
        if (dateParts) {
          const monthNames = [
            "January","February","March","April","May","June",
            "July","August","September","October","November","December",
          ];
          const monthIndex = monthNames.findIndex(
            (m) => m.toLowerCase() === dateParts[1].toLowerCase(),
          );
          if (monthIndex !== -1) {
            return new Date(currentYear, monthIndex, parseInt(dateParts[2]), hourNum, parseInt(minutes));
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  const formatDividerText = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (date.toDateString() === today.toDateString()) return `Today ${time}`;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
    return `${date.toLocaleDateString([], { month: "long", day: "numeric" })} ${time}`;
  };

  // ── Archive logic ────────────────────────────────────
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
    if (rideData.startTime) startTime = rideData.startTime.toDate();
    else if (rideData.date && rideData.time) startTime = parseRideDateTime(rideData.date, rideData.time);

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

    if (shouldShow) setTimeUntilArchive(calculateTimeUntilArchive(startTime));
    else if (timeSinceStart < 0) {
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
      if (rideData.startTime) startTime = rideData.startTime.toDate();
      else if (rideData.date && rideData.time) startTime = parseRideDateTime(rideData.date, rideData.time);
      if (!startTime) return;

      const now = new Date();
      const timeSinceStart = now.getTime() - startTime.getTime();

      if (timeSinceStart >= 6 * 60 * 60 * 1000) {
        await updateDoc(doc(db, "rides", String(rideId)), {
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
        const shouldBeActive = startTime.getTime() > now.getTime();
        if (rideData.isActive !== shouldBeActive) {
          await updateDoc(doc(db, "rides", String(rideId)), { isActive: shouldBeActive });
        }
      }
    } catch (error) {
      console.error("Error in checkAndArchiveRide:", error);
    }
  };

  // ── Load ride info ────────────────────────────────────
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
        archiveCountdownIntervalRef.current = setInterval(
          () => updateArchiveCountdown(rideData),
          60000,
        ) as unknown as NodeJS.Timeout;

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

  // ── Messages subscription ─────────────────────────────
  useEffect(() => {
    if (!rideId) return;

    const q = query(
      collection(db, "rides", String(rideId), "messages"),
      orderBy("timestamp", "asc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Message[];
      setMessages(msgs);

      if (isFocused) {
        let newestSenderId: string | null = null;
        let latestTs: number | null = null;
        for (const msg of msgs) {
          const ts = msg.timestamp?.toMillis?.() ?? null;
          if (!msg.system && ts !== null && (latestTs === null || ts > latestTs)) {
            latestTs = ts;
            newestSenderId = msg.senderId || null;
          }
        }
        const isFirstLoad = !hasLoadedMessagesRef.current;
        if (isFirstLoad || autoScrollRef.current || newestSenderId === user?.uid) {
          markReadIfAllowed();
        }
        hasLoadedMessagesRef.current = true;
      }

      if (autoScrollRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: hasLoadedMessagesRef.current });
        }, 30);
      }
    });

    return () => unsubscribe();
  }, [rideId, isFocused, markReadIfAllowed, user?.uid]);

  // ── Fetch user details (separate from snapshot to avoid async race) ──
  useEffect(() => {
    if (messages.length === 0) return;
    const uniqueIds = Array.from(
      new Set(messages.map((m) => m.senderId).filter(Boolean) as string[]),
    );
    const newMap = { ...userMapRef.current };
    let hasUpdates = false;
    const fetches = uniqueIds
      .filter((uid) => !newMap[uid])
      .map(async (uid) => {
        try {
          const uDoc = await getDoc(doc(db, "users", uid));
          if (uDoc.exists()) {
            const d = uDoc.data();
            newMap[uid] = { name: d.username || "Anonymous", avatar: d.avatar || DEFAULT_AVATAR };
            hasUpdates = true;
          }
        } catch {}
      });
    Promise.all(fetches).then(() => {
      if (hasUpdates) setUserMap({ ...newMap });
    });
  }, [messages]);

  // ── Read receipts: each member's lastReadAt ──────────
  useEffect(() => {
    if (!rideId) return;
    const readStateCol = collection(db, "rides", String(rideId), "readState");
    const unsub = onSnapshot(readStateCol, (snap) => {
      const map: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const ms = d.data().lastReadAt?.toMillis?.();
        if (typeof ms === "number") map[d.id] = ms;
      });
      setMemberReadAt(map);
    });
    return () => unsub();
  }, [rideId]);

  // "Seen by all" = every other member's lastReadAt is at/after the message time
  const isSeenByAll = useCallback(
    (msg: Message) => {
      const ts = msg.timestamp?.toMillis?.();
      if (!ts || !rideInfo) return false;
      const others = rideInfo.memberIds.filter((id) => id && id !== user?.uid);
      if (others.length === 0) return false;
      return others.every((id) => (memberReadAt[id] ?? 0) >= ts);
    },
    [rideInfo, memberReadAt, user?.uid],
  );

  // ── Typing indicator subscription ────────────────────
  useEffect(() => {
    if (!rideId || !user?.uid) return;
    const typingCol = collection(db, "rides", String(rideId), "typing");
    const unsub = onSnapshot(typingCol, (snap) => {
      const STALE_MS = 8000;
      const now = Date.now();
      const active: string[] = [];
      snap.docs.forEach((d) => {
        if (d.id === user.uid) return;
        const data = d.data();
        if (!data.isTyping) return;
        const updatedMs = data.updatedAt?.toMillis?.() ?? 0;
        if (now - updatedMs < STALE_MS) {
          const firstName = (data.name as string)?.split(" ")[0] || "Someone";
          active.push(firstName);
        }
      });
      setTypingUsers(active);
    });
    return () => {
      unsub();
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (user?.uid) deleteDoc(doc(db, "rides", String(rideId), "typing", user.uid)).catch(() => {});
    };
  }, [rideId, user?.uid]);

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!rideId || !user?.uid) return;
    const name = userMap[user.uid]?.name || user.displayName || "Someone";
    setDoc(
      doc(db, "rides", String(rideId), "typing", user.uid),
      { isTyping, name, updatedAt: serverTimestamp() },
    ).catch(() => {});
  }, [rideId, user?.uid, userMap]);

  const clearTyping = useCallback(() => {
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    sendTypingStatus(false);
  }, [sendTypingStatus]);

  // ── Processed list data (grouping + time dividers) ───
  const listData = useMemo((): ListItem[] => {
    if (messages.length === 0) return [];

    const GROUP_BREAK_MS = 5 * 60 * 1000;
    const DIVIDER_THRESHOLD_MS = 60 * 60 * 1000;

    const processed: ProcessedMessage[] = messages.map((msg, i) => {
      if (msg.system) return { ...msg, isFirstInGroup: true, isLastInGroup: true };

      const prev = i > 0 ? messages[i - 1] : null;
      const next = i < messages.length - 1 ? messages[i + 1] : null;

      const prevGap = prev?.timestamp && msg.timestamp
        ? msg.timestamp.toMillis() - prev.timestamp.toMillis()
        : Infinity;
      const nextGap = next?.timestamp && msg.timestamp
        ? next.timestamp.toMillis() - msg.timestamp.toMillis()
        : Infinity;

      const chainedWithPrev =
        !!prev && !prev.system && prev.senderId === msg.senderId && prevGap < GROUP_BREAK_MS;
      const chainedWithNext =
        !!next && !next.system && next.senderId === msg.senderId && nextGap < GROUP_BREAK_MS;

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

    // Reverse for inverted FlatList (index 0 = newest = visually at bottom)
    return items.reverse();
  }, [messages]);

  // ── Interactions ─────────────────────────────────────
  const handleUserPress = useCallback(
    (userId: string) => {
      if (userId === user?.uid) {
        router.push("/(tabs)/profile");
      } else {
        router.push({
          pathname: "/(stack)/ride/[id]/viewProfile",
          params: { id: rideId as string, userId },
        });
      }
    },
    [user?.uid, rideId],
  );

  const handleLongPress = useCallback(
    (msg: Message) => {
      if (msg.deleted) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const options: any[] = [{ text: "Cancel", style: "cancel" }];
      if (msg.senderId === user?.uid) {
        options.unshift({
          text: "Delete",
          style: "destructive",
          onPress: () =>
            updateDoc(doc(db, "rides", String(rideId), "messages", msg.id), { deleted: true }),
        });
      } else if (msg.senderId) {
        options.unshift({
          text: "Report User",
          style: "destructive",
          onPress: () =>
            router.push({
              pathname: "/(stack)/settings/report-user",
              params: { userId: msg.senderId, rideId: rideId as string },
            }),
        });
      }
      Alert.alert("Message Options", undefined, options);
    },
    [user?.uid, rideId],
  );

  const handleReply = useCallback(
    (msg: Message) => {
      const name =
        msg.senderId === user?.uid
          ? "You"
          : userMap[msg.senderId || ""]?.name || msg.senderName || "Unknown";
      setReplyTo({
        id: msg.id,
        text: msg.text,
        senderName: name,
        senderId: msg.senderId || "",
      });
      // Defer so the input is rendered and the swipe gesture has settled,
      // otherwise the focus() no-ops and the keyboard never opens.
      setTimeout(() => inputRef.current?.focus?.(), 60);
    },
    [user?.uid, userMap],
  );

  const sendMessage = async (messageText: string) => {
    try {
      const senderDoc = userMap[user?.uid || ""];
      const senderName =
        senderDoc?.name || user?.displayName || user?.email || "Anonymous";
      await addDoc(collection(db, "rides", String(rideId), "messages"), {
        text: messageText,
        senderId: user?.uid,
        senderName,
        timestamp: serverTimestamp(),
        ...(replyTo ? { replyTo } : {}),
      });
      setInput("");
      setReplyTo(null);
    } catch (err) {
      console.error("Failed to send message:", err);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !rideId || !user?.uid || trimmed.length > MAX_CHARS) return;

    const { filtered, containsProfanity } = filterContent(trimmed);
    if (containsProfanity) {
      Alert.alert(
        "Message Not Sent",
        "Your message contains inappropriate language and cannot be sent.",
        [{ text: "OK" }],
      );
      return;
    }

    clearTyping();
    scrollToBottom(true);
    await sendMessage(filtered);
  };

  // ── Render item ──────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "divider") {
        return (
          <View style={{ alignItems: "center", paddingVertical: SPACE.md }}>
            <Text
              style={{ fontSize: TYPE.size.label, color: "#555", fontWeight: "500" }}
            >
              {item.text}
            </Text>
          </View>
        );
      }

      const msg = item.data;
      const isSystem = msg.system === true;
      const isArchivedNotice = !!msg.archivedNotice;

      if (isSystem || isArchivedNotice) {
        const text = msg.text ?? "";
        const iconName: keyof typeof Ionicons.glyphMap = isArchivedNotice
          ? "archive-outline"
          : text.toLowerCase().includes("joined")
          ? "person-add-outline"
          : text.toLowerCase().includes("left")
          ? "person-remove-outline"
          : "information-circle-outline";

        return (
          <View style={{ alignItems: "center", paddingVertical: SPACE.sm }}>
            <View
              style={{
                backgroundColor: isArchivedNotice ? "#2d2d00" : "#1e1e1e",
                borderWidth: isArchivedNotice ? 1 : 0,
                borderColor: "#555500",
                borderRadius: 999,
                paddingHorizontal: SPACE.md,
                paddingVertical: 5,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Ionicons
                name={iconName}
                size={12}
                color={isArchivedNotice ? "#ffff99" : "#555"}
              />
              <Text
                style={{
                  fontSize: TYPE.size.label,
                  color: isArchivedNotice ? "#ffff99" : "#555",
                  textAlign: "center",
                }}
              >
                {text}
              </Text>
            </View>
          </View>
        );
      }

      if (msg.deleted) {
        return (
          <View
            style={{
              alignItems: msg.senderId === user?.uid ? "flex-end" : "flex-start",
              paddingHorizontal: SPACE.md,
              marginBottom: msg.isLastInGroup ? SPACE.md : 2,
            }}
          >
            <Text
              style={{
                fontSize: TYPE.size.label,
                color: "#444",
                fontStyle: "italic",
              }}
            >
              Message deleted
            </Text>
          </View>
        );
      }

      const isCurrentUser = msg.senderId === user?.uid;
      const sender = userMap[msg.senderId || ""] || {
        name: msg.senderName || "Unknown",
        avatar: msg.avatar || DEFAULT_AVATAR,
      };
      const { isFirstInGroup, isLastInGroup } = msg;

      // Border radii - iMessage-style chain rounding
      const R = 18;
      const r = 5;
      const bubbleStyle = isCurrentUser
        ? {
            borderTopLeftRadius: R,
            borderTopRightRadius: isFirstInGroup ? R : r,
            borderBottomLeftRadius: R,
            borderBottomRightRadius: isLastInGroup ? R : r,
          }
        : {
            borderTopLeftRadius: isFirstInGroup ? R : r,
            borderTopRightRadius: R,
            borderBottomLeftRadius: isLastInGroup ? R : r,
            borderBottomRightRadius: R,
          };

      const AVATAR_COL = 32 + SPACE.sm;

      return (
        <SwipeableMessage onReply={() => handleReply(msg)}>
        <View
          style={{
            marginBottom: isLastInGroup ? SPACE.md : 2,
            flexDirection: isCurrentUser ? "row-reverse" : "row",
            alignItems: "flex-end",
            paddingHorizontal: SPACE.md,
          }}
        >
          {/* Avatar column - only for other users */}
          {!isCurrentUser && (
            <View style={{ width: AVATAR_COL, alignSelf: "stretch", justifyContent: "center" }}>
              {isLastInGroup ? (
                <TouchableOpacity
                  onPress={() => handleUserPress(msg.senderId || "")}
                  activeOpacity={0.7}
                >
                  <Avatar size="sm" bgColor="#252525">
                    <Avatar.Image source={{ uri: sender.avatar }} alt="avatar" />
                  </Avatar>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Bubble column */}
          <View
            style={{
              maxWidth: "72%",
              alignItems: isCurrentUser ? "flex-end" : "flex-start",
            }}
          >
            {/* Sender name - first in group, other users only */}
            {!isCurrentUser && isFirstInGroup && (
              <TouchableOpacity
                onPress={() => handleUserPress(msg.senderId || "")}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: TYPE.size.label,
                    color: "#777",
                    marginBottom: 3,
                    marginLeft: 2,
                    fontWeight: "500",
                  }}
                >
                  {sender.name}
                </Text>
              </TouchableOpacity>
            )}

            {/* Bubble */}
            <TouchableOpacity
              onLongPress={() => handleLongPress(msg)}
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
                {/* Quoted reply preview */}
                {msg.replyTo && (
                  <View
                    style={{
                      borderLeftWidth: 3,
                      borderLeftColor: isCurrentUser ? "rgba(18,18,18,0.45)" : ACCENT,
                      backgroundColor: isCurrentUser
                        ? "rgba(18,18,18,0.12)"
                        : "rgba(255,255,255,0.06)",
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      marginBottom: 5,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: TYPE.size.label,
                        fontWeight: "600",
                        color: isCurrentUser ? "rgba(18,18,18,0.8)" : ACCENT,
                        marginBottom: 1,
                      }}
                    >
                      {msg.replyTo.senderName}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontSize: TYPE.size.label,
                        color: isCurrentUser ? "rgba(18,18,18,0.65)" : "#aaa",
                      }}
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
              </View>
            </TouchableOpacity>

            {/* Meta: time + read receipts, below the last bubble of a group */}
            {isLastInGroup && msg.timestamp?.toDate && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  marginTop: 3,
                  paddingHorizontal: 2,
                  alignSelf: isCurrentUser ? "flex-end" : "flex-start",
                }}
              >
                <Text style={{ fontSize: 10, color: "#777" }}>
                  {msg.timestamp
                    .toDate()
                    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </Text>
                {isCurrentUser &&
                  (isSeenByAll(msg) ? (
                    <Ionicons name="checkmark-done" size={13} color="#0a84ff" />
                  ) : msg.sent ? (
                    <Ionicons name="checkmark" size={12} color="#8a8a8a" />
                  ) : (
                    <Ionicons name="time-outline" size={11} color="#777" />
                  ))}
              </View>
            )}
          </View>

          {/* Mirror spacer so current-user bubbles don't kiss the right edge */}
          {isCurrentUser && <View style={{ width: AVATAR_COL }} />}
        </View>
        </SwipeableMessage>
      );
    },
    [user?.uid, userMap, handleUserPress, handleLongPress, isSeenByAll, handleReply],
  );

  const keyExtractor = useCallback(
    (item: ListItem) => (item.type === "divider" ? item.id : item.data.id),
    [],
  );

  // ── Render ───────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      {/* ── Top chrome (outside KAV - stays put when keyboard opens) ── */}
      <NavHeader
        title={rideInfo ? `${rideInfo.from} → ${rideInfo.to}` : undefined}
        subtitle={
          rideInfo
            ? `${rideInfo.memberIds?.length || 0} members · ${rideInfo.date} · ${rideInfo.time}${isArchived ? " · Archived" : ""}`
            : undefined
        }
        onTitlePress={
          rideInfo
            ? () =>
                router.push({
                  pathname: "/(stack)/ride/[id]/group-settings",
                  params: { id: rideId as string },
                })
            : undefined
        }
        rightIcon="people-outline"
        rightLabel="Group settings"
        onRightPress={() =>
          router.push({
            pathname: "/(stack)/ride/[id]/group-settings",
            params: { id: rideId as string },
          })
        }
      />

      {/* Archive countdown - single compact line */}
      {shouldShowArchiveCountdown && timeUntilArchive && (
        <View
          style={{
            backgroundColor: "#1a1a1a",
            paddingVertical: 6,
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: "#2a2a2a",
          }}
        >
          <Text
            style={{
              fontSize: TYPE.size.micro,
              fontWeight: "600",
              color: timeUntilArchive.includes("Archives in") ? "#ffcc00" : "#777",
            }}
          >
            {timeUntilArchive} · Ride chats archive 6 hours after start time
          </Text>
        </View>
      )}

      {/* ── Keyboard-managed section ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Messages */}
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
          ListHeaderComponent={
            typingUsers.length > 0 ? (
              <View style={{ paddingHorizontal: SPACE.md, paddingBottom: SPACE.sm }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: SPACE.sm }}>
                  <View
                    style={{
                      backgroundColor: "#252525",
                      borderRadius: 18,
                      borderBottomLeftRadius: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <TypingDots />
                  </View>
                </View>
                <Text
                  style={{
                    fontSize: TYPE.size.micro,
                    color: "#555",
                    marginTop: 4,
                    marginLeft: 2,
                  }}
                >
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} is typing…`
                    : `${typingUsers.slice(0, 2).join(" & ")} are typing…`}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ flexGrow: 1, justifyContent: "center" }}>
              <ChatEmptyState />
            </View>
          }
        />

        {/* Input bar */}
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
          {/* Reply preview */}
          {replyTo && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#1e1e1e",
                borderRadius: 10,
                borderLeftWidth: 3,
                borderLeftColor: ACCENT,
                paddingVertical: 6,
                paddingLeft: 10,
                paddingRight: 6,
                marginBottom: SPACE.sm,
              }}
            >
              <Ionicons
                name="arrow-undo"
                size={15}
                color={ACCENT}
                style={{ marginRight: 8 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: ACCENT, fontSize: TYPE.size.label, fontWeight: "600", marginBottom: 1 }}>
                  Replying to {replyTo.senderName}
                </Text>
                <Text numberOfLines={1} style={{ color: "#999", fontSize: TYPE.size.label }}>
                  {replyTo.text}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="close" size={18} color="#888" />
              </TouchableOpacity>
            </View>
          )}

          {input.length > MAX_CHARS * 0.8 && (
            <Text
              style={{
                color: input.length >= MAX_CHARS ? "#ff5555" : "#a0a0a0",
                fontSize: TYPE.size.micro,
                textAlign: "right",
                marginBottom: 4,
              }}
            >
              {input.length}/{MAX_CHARS}
            </Text>
          )}

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: SPACE.sm }}>
            <Input
              flex={1}
              size="md"
              borderWidth={0}
              borderRadius="$2xl"
              backgroundColor={isArchived ? "#1a1a1a" : "#2a2a2a"}
            >
              <InputField
                ref={inputRef}
                placeholder={
                  isArchived
                    ? "Chat archived, still open for messages"
                    : "Message..."
                }
                placeholderTextColor={isArchived ? "#444" : "#666"}
                color="white"
                value={input}
                onChangeText={(text) => {
                  if (text.length <= MAX_CHARS) setInput(text);
                  if (text.trim()) {
                    sendTypingStatus(true);
                    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
                    typingDebounceRef.current = setTimeout(() => sendTypingStatus(false), 4000) as unknown as NodeJS.Timeout;
                  } else {
                    clearTyping();
                  }
                }}
                onBlur={clearTyping}
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

            <Pressable
              onPressIn={animatePressIn}
              onPressOut={animatePressOut}
              onPress={handleSend}
            >
              <ReAnimated.View style={sendScaleStyle}>
                <Animated.View
                  style={{
                    backgroundColor: interpolatedColor,
                    borderRadius: 999,
                    width: 40,
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: !input.trim() ? 0.35 : 1,
                  }}
                >
                  <Ionicons name="arrow-up" size={20} color="#121212" />
                </Animated.View>
              </ReAnimated.View>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Scroll-to-bottom FAB - outside KAV, positioned above keyboard */}
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
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#333",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <GlassSurface
              fallbackColor="#1e1e1e"
              style={{
                paddingHorizontal: 16,
                paddingVertical: 7,
                flexDirection: "row",
                alignItems: "center",
                gap: SPACE.sm,
              }}
            >
              <Ionicons name="chevron-down" size={14} color={ACCENT} />
              <Text style={{ color: ACCENT, fontSize: TYPE.size.label, fontWeight: TYPE.weight.semibold }}>
                Latest messages
              </Text>
            </GlassSurface>
          </GHTouchableOpacity>
        </View>
      )}
    </View>
  );
}
