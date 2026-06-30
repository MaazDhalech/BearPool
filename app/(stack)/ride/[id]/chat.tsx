import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { ImageLightbox } from "@/components/ImageLightbox";
import { findLinks, LinkedText } from "@/components/LinkedText";
import { LinkPreview } from "@/components/LinkPreview";
import { MessageReactions, type Reaction } from "@/components/MessageReactions";
import { PhonePreview } from "@/components/PhonePreview";
import { NavHeader } from "@/components/ui/NavHeader";
import { Sheet, SheetAction, SHEET_DESTRUCTIVE } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/Dialog";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db, storage } from "@/services/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
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
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import * as filter from "leo-profanity";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  Gesture,
  GestureDetector,
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
  imageUrl?: string;
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
  reactions?: Reaction[] | null;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
};

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👎"];
const MESSAGE_PAGE_SIZE = 50;

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
          color: darkTheme.textPrimary,
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
          color: darkTheme.textSecondary,
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

  const dot = { width: 6, height: 6, borderRadius: 3, backgroundColor: darkTheme.textFaint };
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 2 }}>
      <ReAnimated.View style={[dot, s1]} />
      <ReAnimated.View style={[dot, s2]} />
      <ReAnimated.View style={[dot, s3]} />
    </View>
  );
}

const REPLY_THRESHOLD = 56;

// Swipe-to-reply wrapper (WhatsApp/iMessage style). Other-user messages swipe
// right with the "Reply" hint in the left gutter; your own (right-aligned)
// messages swipe left with the hint on the right, so it stays on the bubble's
// side. Past the threshold it fires a haptic and triggers onReply.
function SwipeableMessage({
  onReply,
  mirrored,
  children,
}: {
  onReply: () => void;
  mirrored: boolean;
  children: React.ReactNode;
}) {
  const tx = useSharedValue(0);
  const hapticFired = useSharedValue(false);
  const dir = mirrored ? -1 : 1;

  const fireHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

  const pan = Gesture.Pan()
    .activeOffsetX(mirrored ? -14 : 14)
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      // Magnitude in the reply direction, clamped 0..84.
      const mag = Math.min(Math.max(e.translationX * dir, 0), 84);
      tx.value = mag * dir;
      if (mag >= REPLY_THRESHOLD && !hapticFired.value) {
        hapticFired.value = true;
        runOnJS(fireHaptic)();
      } else if (mag < REPLY_THRESHOLD && hapticFired.value) {
        hapticFired.value = false;
      }
    })
    .onEnd(() => {
      if (Math.abs(tx.value) >= REPLY_THRESHOLD) runOnJS(onReply)();
      tx.value = withSpring(0, { damping: 26, stiffness: 220, overshootClamping: true });
      hapticFired.value = false;
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));
  // Reply hint revealed in the gutter as the row slides.
  const hintStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.abs(tx.value) / REPLY_THRESHOLD, 1);
    return { opacity: p, transform: [{ translateX: (1 - p) * 8 * -dir }] };
  });

  return (
    <View>
      <ReAnimated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            top: 0,
            bottom: 0,
            width: 72,
            alignItems: "center",
            justifyContent: "center",
            ...(mirrored ? { right: SPACE.md } : { left: SPACE.md }),
          },
          hintStyle,
        ]}
      >
        <Ionicons name="arrow-undo" size={18} color={darkTheme.textSecondary} />
        <Text
          style={{
            fontSize: TYPE.size.micro,
            color: darkTheme.textSecondary,
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
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [memberReadAt, setMemberReadAt] = useState<Record<string, number>>({});
  const [replyTo, setReplyTo] = useState<ReplyMeta | null>(null);
  const [actionSheetMsg, setActionSheetMsg] = useState<Message | null>(null);
  const [messageLimit, setMessageLimit] = useState(MESSAGE_PAGE_SIZE);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
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

  const animatedValue = useRef(new Animated.Value(0)).current;
  const sendScale = useSharedValue(1);
  const sendScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  // ── Scroll ──────────────────────────────────────────
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
      // Always land on the latest message when (re)opening the chat.
      autoScrollRef.current = true;
      scrollToBottom(false);
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
    }, [rideId, updateReadState, user?.uid, scrollToBottom]),
  );

  // ── Send button animation ────────────────────────────
  const animatePressIn = () => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
    sendScale.value = withSpring(0.88, { damping: 22, stiffness: 500, overshootClamping: true });
  };

  const animatePressOut = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
    sendScale.value = withSpring(1, { damping: 20, stiffness: 300, overshootClamping: true });
  };

  const interpolatedColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [ACCENT, darkTheme.raised],
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

  const loadEarlier = useCallback(() => {
    setLoadingEarlier(true);
    setMessageLimit((l) => l + MESSAGE_PAGE_SIZE);
  }, []);

  // ── Messages subscription (paginated: live window of the latest N) ─────
  useEffect(() => {
    if (!rideId) return;

    // Fetch the most recent `messageLimit` messages, kept live. "Load earlier"
    // grows the window. orderBy desc + limit, then reverse to ascending.
    const q = query(
      collection(db, "rides", String(rideId), "messages"),
      orderBy("timestamp", "desc"),
      limit(messageLimit),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Message)
        .reverse();
      setMessages(msgs);
      setHasMoreMessages(snapshot.size >= messageLimit);
      setLoadingEarlier(false);

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
  }, [rideId, isFocused, markReadIfAllowed, user?.uid, messageLimit]);

  // ── Fetch user details (separate from snapshot to avoid async race) ──
  useEffect(() => {
    if (messages.length === 0) return;
    const uniqueIds = Array.from(
      new Set([
        ...(messages.map((m) => m.senderId).filter(Boolean) as string[]),
        // Reactors may not have sent a message — resolve their names too.
        ...messages.flatMap((m) => (m.reactions ?? []).flatMap((r) => r.userIds)),
      ]),
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

  const handleLongPress = useCallback((msg: Message) => {
    if (msg.deleted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionSheetMsg(msg);
  }, []);

  // Toggle the current user's reaction on a message (read-modify-write so the
  // nested userIds arrays stay consistent under concurrent reactions).
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!rideId || !user?.uid) return;
      const uid = user.uid;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const ref = doc(db, "rides", String(rideId), "messages", messageId);
      try {
        await runTransaction(db, async (txn) => {
          const snap = await txn.get(ref);
          if (!snap.exists()) return;
          const data = snap.data();
          const reactions: Reaction[] = Array.isArray(data.reactions)
            ? data.reactions.map((r: Reaction) => ({
                emoji: r.emoji,
                userIds: [...(r.userIds || [])],
              }))
            : [];

          const existing = reactions.find((r) => r.emoji === emoji);
          if (existing) {
            existing.userIds = existing.userIds.includes(uid)
              ? existing.userIds.filter((id) => id !== uid)
              : [...existing.userIds, uid];
          } else {
            reactions.push({ emoji, userIds: [uid] });
          }

          txn.update(ref, {
            reactions: reactions.filter((r) => r.userIds.length > 0),
          });
        });
      } catch (err) {
        console.error("Failed to toggle reaction", err);
      }
    },
    [rideId, user?.uid],
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
        ...(msg.imageUrl ? { imageUrl: msg.imageUrl } : {}),
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
        senderDoc?.name || user?.displayName || "Anonymous";
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
      toast("Failed to send message. Please try again.", { type: "error" });
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !rideId || !user?.uid || trimmed.length > MAX_CHARS) return;

    const { filtered, containsProfanity } = filterContent(trimmed);
    if (containsProfanity) {
      toast("Your message contains inappropriate language and cannot be sent.", {
        type: "error",
      });
      return;
    }

    clearTyping();
    scrollToBottom(true);
    await sendMessage(filtered);
  };

  // ── Attach a photo ───────────────────────────────────
  const handleAttachImage = async () => {
    if (!rideId || !user?.uid || uploadingImage) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast("Allow photo library access to share images.", { type: "error" });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploadingImage(true);
    try {
      // Resize + compress.
      const manip = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
      );
      // Fetch the file into a native-backed Blob via XHR. (fetch().blob() and
      // base64 uploadString both break Firebase Storage's Blob handling in RN.)
      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error("Failed to read image"));
        xhr.responseType = "blob";
        xhr.open("GET", manip.uri, true);
        xhr.send(null);
      });
      const fileName = `${Date.now()}-${user.uid}.jpg`;
      const sRef = storageRef(storage, `rides/${String(rideId)}/chat/${fileName}`);
      await uploadBytes(sRef, blob, { contentType: "image/jpeg" });
      // @ts-ignore - RN Blob exposes close() to free memory
      blob.close?.();
      const imageUrl = await getDownloadURL(sRef);

      const senderName =
        userMap[user.uid]?.name || user.displayName || "Anonymous";
      await addDoc(collection(db, "rides", String(rideId), "messages"), {
        text: "",
        senderId: user.uid,
        senderName,
        timestamp: serverTimestamp(),
        imageUrl,
        imageWidth: manip.width,
        imageHeight: manip.height,
        ...(replyTo ? { replyTo } : {}),
      });
      setReplyTo(null);
      scrollToBottom(true);
    } catch (err) {
      console.error("Failed to upload image:", err);
      toast("Could not send the photo. Please try again.", { type: "error" });
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Render item ──────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === "divider") {
        return (
          <View style={{ alignItems: "center", paddingVertical: SPACE.md }}>
            <Text
              style={{ fontSize: TYPE.size.label, color: darkTheme.textGhost, fontWeight: "500" }}
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

        return (
          <View style={{ alignItems: "center", paddingVertical: SPACE.md }}>
            <View
              style={{
                backgroundColor: isArchivedNotice ? "#2d2d00" : darkTheme.surface,
                borderWidth: isArchivedNotice ? 1 : 0,
                borderColor: "#555500",
                borderRadius: 999,
                paddingHorizontal: SPACE.md,
                paddingVertical: 5,
              }}
            >
              <Text
                style={{
                  fontSize: TYPE.size.label,
                  color: isArchivedNotice ? "#ffff99" : darkTheme.textGhost,
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
        const deleter =
          msg.senderId === user?.uid
            ? "You"
            : userMap[msg.senderId || ""]?.name || msg.senderName || "Someone";
        return (
          <View style={{ alignItems: "center", paddingVertical: SPACE.md, paddingHorizontal: SPACE.md }}>
            <Text style={{ fontSize: TYPE.size.label, color: darkTheme.textMuted, fontStyle: "italic" }}>
              {deleter} deleted a message
            </Text>
          </View>
        );
      }

      const isCurrentUser = msg.senderId === user?.uid;
      const sender = userMap[msg.senderId || ""] || {
        // Never flash a raw email before the username resolves from userMap.
        name:
          msg.senderName && !msg.senderName.includes("@")
            ? msg.senderName
            : "…",
        avatar: msg.avatar || DEFAULT_AVATAR,
      };
      const { isFirstInGroup, isLastInGroup } = msg;
      const links = findLinks(msg.text);
      const firstPhone = links.find((l) => l.type === "phone");
      const firstUrl = links.find((l) => l.type === "url");
      const trimmedText = msg.text.trim();
      const isOnlyPhone = !!firstPhone && trimmedText === firstPhone.value;
      const isOnlyUrl = !!firstUrl && trimmedText === firstUrl.value;
      const hasImage = !!msg.imageUrl;
      const bareBubble = isOnlyPhone || isOnlyUrl || hasImage;
      const linkColor = isCurrentUser ? "#0a3d91" : "#5ab0ff";
      const imgW = 240;
      const imgAspect =
        msg.imageWidth && msg.imageHeight ? msg.imageWidth / msg.imageHeight : 1;
      const imgH = Math.min(Math.max(imgW / imgAspect, 120), 320);

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


      return (
        <SwipeableMessage onReply={() => handleReply(msg)} mirrored={isCurrentUser}>
        <View
          style={{
            marginBottom: isLastInGroup ? SPACE.md : 2,
            flexDirection: isCurrentUser ? "row-reverse" : "row",
            alignItems: "flex-end",
            paddingHorizontal: SPACE.md,
          }}
        >
          {/* Bubble column */}
          <View
            style={{
              maxWidth: "78%",
              alignItems: isCurrentUser ? "flex-end" : "flex-start",
            }}
          >
            {/* Inline pfp + username header - first in group, other users only */}
            {!isCurrentUser && isFirstInGroup && (
              <TouchableOpacity
                onPress={() => handleUserPress(msg.senderId || "")}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, marginLeft: 2 }}
              >
                <Avatar size="xs" bgColor={darkTheme.surfaceAlt}>
                  <Avatar.Image source={{ uri: sender.avatar }} alt="avatar" />
                </Avatar>
                <Text style={{ fontSize: TYPE.size.label, color: darkTheme.textFaint, fontWeight: "500" }}>
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
                style={
                  bareBubble
                    ? undefined
                    : [
                        {
                          backgroundColor: isCurrentUser ? ACCENT : darkTheme.surfaceAlt,
                          paddingHorizontal: SPACE.md,
                          paddingVertical: SPACE.sm,
                        },
                        bubbleStyle,
                      ]
                }
              >
                {/* Quoted reply preview */}
                {msg.replyTo && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
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
                    {msg.replyTo.imageUrl ? (
                      <Image
                        source={{ uri: msg.replyTo.imageUrl }}
                        style={{ width: 34, height: 34, borderRadius: 5, backgroundColor: darkTheme.raised }}
                        contentFit="cover"
                      />
                    ) : null}
                    <View style={{ flex: 1 }}>
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
                        {msg.replyTo.imageUrl && !msg.replyTo.text?.trim()
                          ? "📷 Photo"
                          : msg.replyTo.text}
                      </Text>
                    </View>
                  </View>
                )}

                {hasImage ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setLightboxUri(msg.imageUrl!)}
                    onLongPress={() => handleLongPress(msg)}
                    delayLongPress={200}
                  >
                    <Image
                      source={{ uri: msg.imageUrl }}
                      style={{ width: imgW, height: imgH, borderRadius: 14, backgroundColor: darkTheme.raised }}
                      contentFit="cover"
                      transition={150}
                    />
                  </TouchableOpacity>
                ) : isOnlyPhone ? (
                  <PhonePreview phone={firstPhone!.value} alignRight={isCurrentUser} />
                ) : isOnlyUrl ? (
                  <LinkPreview url={firstUrl!.value} onlyLink linkColor="#5ab0ff" />
                ) : (
                  <LinkedText
                    text={msg.text}
                    linkColor={linkColor}
                    style={{
                      color: isCurrentUser ? darkTheme.bg : darkTheme.textBright,
                      fontSize: TYPE.size.body,
                      lineHeight: TYPE.size.body * 1.45,
                    }}
                  />
                )}

              </View>
            </TouchableOpacity>

            {/* Phone card when a number is part of a longer message */}
            {firstPhone && !isOnlyPhone && (
              <PhonePreview
                phone={firstPhone.value}
                alignRight={isCurrentUser}
                style={{ marginTop: 4 }}
              />
            )}

            {/* Link preview when a URL is part of a longer message */}
            {firstUrl && !isOnlyUrl && (
              <View style={{ marginTop: 4, alignSelf: isCurrentUser ? "flex-end" : "flex-start" }}>
                <LinkPreview url={firstUrl.value} linkColor={linkColor} />
              </View>
            )}

            {/* Reactions */}
            <MessageReactions
              reactions={msg.reactions}
              currentUserId={user?.uid}
              onToggle={(emoji) => toggleReaction(msg.id, emoji)}
              alignRight={isCurrentUser}
            />

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
                <Text style={{ fontSize: 10, color: darkTheme.textFaint }}>
                  {msg.timestamp
                    .toDate()
                    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </Text>
                {isCurrentUser &&
                  (isSeenByAll(msg) ? (
                    <Ionicons name="checkmark-done" size={13} color="#0a84ff" />
                  ) : msg.sent ? (
                    <Ionicons name="checkmark" size={12} color={darkTheme.textFaint} />
                  ) : (
                    <Ionicons name="time-outline" size={11} color={darkTheme.textFaint} />
                  ))}
              </View>
            )}
          </View>

        </View>
        </SwipeableMessage>
      );
    },
    [user?.uid, userMap, handleUserPress, handleLongPress, isSeenByAll, handleReply, toggleReaction],
  );

  const keyExtractor = useCallback(
    (item: ListItem) => (item.type === "divider" ? item.id : item.data.id),
    [],
  );

  // ── Render ───────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: darkTheme.bg }}>
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
            borderBottomColor: darkTheme.raised,
          }}
        >
          <Text
            style={{
              fontSize: TYPE.size.micro,
              fontWeight: "600",
              color: timeUntilArchive.includes("Archives in") ? "#ffcc00" : darkTheme.textFaint,
            }}
          >
            {timeUntilArchive} · Ride chats archive 6 hours after start time
          </Text>
        </View>
      )}

      {/* ── Keyboard-managed section ── */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
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
            // Inverted list: y≈0 is the latest message. Resume auto-scroll near
            // the bottom; pause it once the user scrolls up to read history.
            const y = nativeEvent.contentOffset.y;
            if (y < 60) autoScrollRef.current = true;
            else if (y > 120) autoScrollRef.current = false;
          }}
          ListHeaderComponent={
            typingUsers.length > 0 ? (
              <View style={{ paddingHorizontal: SPACE.md, paddingBottom: SPACE.sm }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: SPACE.sm }}>
                  <View
                    style={{
                      backgroundColor: darkTheme.surfaceAlt,
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
                    color: darkTheme.textGhost,
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
          ListFooterComponent={
            hasMoreMessages ? (
              <View style={{ alignItems: "center", paddingVertical: SPACE.md }}>
                <TouchableOpacity
                  onPress={loadEarlier}
                  disabled={loadingEarlier}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: SPACE.sm,
                    backgroundColor: darkTheme.surface,
                    borderRadius: 999,
                    paddingHorizontal: SPACE.lg,
                    paddingVertical: SPACE.sm,
                    borderWidth: 1,
                    borderColor: darkTheme.raised,
                  }}
                >
                  {loadingEarlier ? (
                    <ActivityIndicator size="small" color={ACCENT} />
                  ) : (
                    <>
                      <Ionicons name="chevron-up" size={14} color={ACCENT} />
                      <Text style={{ color: ACCENT, fontSize: TYPE.size.label, fontWeight: TYPE.weight.semibold }}>
                        Load earlier messages
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ flexGrow: 1, justifyContent: "center" }}>
              <ChatEmptyState />
            </View>
          }
        />

        {/* Glass composer — in flow, so the list sits above it (nothing renders under) */}
        <View
          style={{ paddingHorizontal: SPACE.sm, paddingTop: SPACE.xs, paddingBottom: safeBottom }}
        >
          <GlassSurface
            effect="regular"
            colorScheme="dark"
            fallbackColor={darkTheme.surface}
            style={{ borderRadius: 26, overflow: "hidden" }}
          >
            <View style={{ paddingHorizontal: SPACE.sm, paddingTop: SPACE.sm, paddingBottom: SPACE.sm }}>
          {/* Reply preview */}
          {replyTo && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: darkTheme.surface,
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
              {replyTo.imageUrl ? (
                <Image
                  source={{ uri: replyTo.imageUrl }}
                  style={{ width: 34, height: 34, borderRadius: 5, backgroundColor: darkTheme.raised, marginRight: 8 }}
                  contentFit="cover"
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={{ color: ACCENT, fontSize: TYPE.size.label, fontWeight: "600", marginBottom: 1 }}>
                  Replying to {replyTo.senderName}
                </Text>
                <Text numberOfLines={1} style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label }}>
                  {replyTo.imageUrl && !replyTo.text?.trim() ? "📷 Photo" : replyTo.text}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={10} style={{ padding: 4 }}>
                <Ionicons name="close" size={18} color={darkTheme.textFaint} />
              </TouchableOpacity>
            </View>
          )}

          {input.length > MAX_CHARS * 0.8 && (
            <Text
              style={{
                color: input.length >= MAX_CHARS ? darkTheme.danger : darkTheme.textSecondary,
                fontSize: TYPE.size.micro,
                textAlign: "right",
                marginBottom: 4,
              }}
            >
              {input.length}/{MAX_CHARS}
            </Text>
          )}

          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: SPACE.sm }}>
            <TouchableOpacity
              onPress={handleAttachImage}
              disabled={uploadingImage}
              activeOpacity={0.7}
              style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
            >
              {uploadingImage ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Ionicons name="image-outline" size={24} color={darkTheme.textBright} />
              )}
            </TouchableOpacity>
            <Input
              flex={1}
              size="md"
              borderWidth={0}
              borderRadius="$2xl"
              backgroundColor={isArchived ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)"}
            >
              <InputField
                ref={inputRef}
                placeholder={
                  isArchived
                    ? "Chat archived, still open for messages"
                    : "Message..."
                }
                placeholderTextColor={isArchived ? darkTheme.borderStrong : darkTheme.textMuted}
                color={darkTheme.textPrimary}
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
                  <Ionicons name="arrow-up" size={20} color={darkTheme.bg} />
                </Animated.View>
              </ReAnimated.View>
            </Pressable>
          </View>
            </View>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>

      {/* Long-press action sheet: reactions + message actions */}
      <Sheet visible={!!actionSheetMsg} onClose={() => setActionSheetMsg(null)}>
        {/* Who reacted with what */}
        {!!actionSheetMsg?.reactions?.length && (
          <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.sm }}>
            {actionSheetMsg.reactions.map((r) => (
              <View
                key={r.emoji}
                style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingVertical: 4 }}
              >
                <Text style={{ fontSize: 18 }}>{r.emoji}</Text>
                <Text numberOfLines={1} style={{ flex: 1, color: "#bbb", fontSize: TYPE.size.label }}>
                  {r.userIds
                    .map((uid) => (uid === user?.uid ? "You" : userMap[uid]?.name || "Someone"))
                    .join(", ")}
                </Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: darkTheme.raised, marginTop: SPACE.sm }} />
          </View>
        )}

        {/* Emoji reactions */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            paddingHorizontal: SPACE.md,
            paddingBottom: SPACE.md,
          }}
        >
          {REACTION_EMOJIS.map((emoji) => {
            const mine = !!actionSheetMsg?.reactions
              ?.find((r) => r.emoji === emoji)
              ?.userIds.includes(user?.uid || "");
            return (
              <TouchableOpacity
                key={emoji}
                activeOpacity={0.7}
                onPress={() => {
                  if (actionSheetMsg) toggleReaction(actionSheetMsg.id, emoji);
                  setActionSheetMsg(null);
                }}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 23,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: mine ? "rgba(10,132,255,0.18)" : darkTheme.raised,
                  borderWidth: mine ? 1 : 0,
                  borderColor: "#0a84ff",
                }}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 1, backgroundColor: darkTheme.raised, marginBottom: 4 }} />

        <SheetAction
          icon="arrow-undo-outline"
          label="Reply"
          onPress={() => {
            const m = actionSheetMsg;
            setActionSheetMsg(null);
            if (m) handleReply(m);
          }}
        />
        {actionSheetMsg?.senderId === user?.uid ? (
          <SheetAction
            icon="trash-outline"
            label="Delete"
            tint={SHEET_DESTRUCTIVE}
            onPress={() => {
              const m = actionSheetMsg;
              setActionSheetMsg(null);
              if (m)
                updateDoc(doc(db, "rides", String(rideId), "messages", m.id), { deleted: true });
            }}
          />
        ) : (
          <SheetAction
            icon="flag-outline"
            label="Report"
            tint={SHEET_DESTRUCTIVE}
            onPress={() => {
              const m = actionSheetMsg;
              setActionSheetMsg(null);
              if (m?.senderId)
                router.push({
                  pathname: "/(stack)/settings/report-user",
                  params: { userId: m.senderId, rideId: rideId as string },
                });
            }}
          />
        )}
      </Sheet>

      {/* Full-screen image viewer */}
      <ImageLightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />
    </View>
  );
}
