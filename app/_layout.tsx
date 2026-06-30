import { darkTheme } from "@/constants/theme";
// app/_layout.tsx
import { ACCENT } from "@/constants/Colors";
import RideFeedbackModal from "@/components/RideFeedbackModal";
import { DialogHost } from "@/components/ui/Dialog";
import "@/global.css";
import { config } from "@/gluestack-ui.config";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Linking,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ✅ Set full notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Date utility function
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
          const [__, monthName, day] = dateParts;
          const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
          ];
          const monthIndex = monthNames.findIndex(
            (m) => m.toLowerCase() === monthName.toLowerCase(),
          );

          if (monthIndex !== -1) {
            return new Date(
              currentYear, monthIndex, parseInt(day), hourNum, parseInt(minutes),
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

// AsyncStorage keys
const RATED_RIDES_KEY = "rated_rides";
const RATE_LATER_RIDES_KEY = "rate_later_rides";
const FEEDBACK_COOLDOWN_KEY = "feedback_cooldown";

const APP_STORE_URL = "https://apps.apple.com/ph/app/bearpool/id6747465780";

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function RootLayoutContent() {
  const { userId, isLoaded: isAuthLoaded } = useFirebaseAuth();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const router = useRouter();

  const [showForceUpdate, setShowForceUpdate] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ratedRides, setRatedRides] = useState<Set<string>>(new Set());
  const [rateLaterRides, setRateLaterRides] = useState<Set<string>>(new Set());

  const rideCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // Load rated rides and rate-later rides from storage
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [ratedData, rateLaterData] = await Promise.all([
          AsyncStorage.getItem(RATED_RIDES_KEY),
          AsyncStorage.getItem(RATE_LATER_RIDES_KEY),
        ]);

        if (ratedData) {
          setRatedRides(new Set(JSON.parse(ratedData)));
        }
        if (rateLaterData) {
          setRateLaterRides(new Set(JSON.parse(rateLaterData)));
        }
      } catch (error) {
        console.error("Error loading stored data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredData();
  }, []);

  // Save rated rides to storage when they change
  useEffect(() => {
    if (ratedRides.size > 0) {
      AsyncStorage.setItem(RATED_RIDES_KEY, JSON.stringify([...ratedRides])).catch(console.error);
    }
  }, [ratedRides]);

  // Save rate-later rides to storage when they change
  useEffect(() => {
    if (rateLaterRides.size > 0) {
      AsyncStorage.setItem(RATE_LATER_RIDES_KEY, JSON.stringify([...rateLaterRides])).catch(console.error);
    }
  }, [rateLaterRides]);

  // Check for rides that need feedback
  const checkRidesForFeedback = async () => {
    if (!userId || !isAuthLoaded || isLoading) return;

    try {
      const cooldownData = await AsyncStorage.getItem(FEEDBACK_COOLDOWN_KEY);
      if (cooldownData) {
        const { timestamp } = JSON.parse(cooldownData);
        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) return;
      }

      const ridesQuery = query(
        collection(db, "rides"),
        where("memberIds", "array-contains", userId),
        where("archived", "==", false),
        orderBy("startTime", "desc"),
      );

      const unsubscribe = onSnapshot(
        ridesQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              const rideData = change.doc.data();
              const rideId = change.doc.id;

              if (ratedRides.has(rideId) || rateLaterRides.has(rideId)) return;

              let startTime: Date | null = null;
              if (rideData.startTime) {
                startTime = rideData.startTime.toDate();
              } else if (rideData.date && rideData.time) {
                startTime = parseRideDateTime(rideData.date, rideData.time);
              }

              if (!startTime) return;

              const timeSinceStart = Date.now() - startTime.getTime();
              const thirtyMinutes = 1 * 60 * 1000;
              const twentyFourHours = 24 * 60 * 60 * 1000;

              if (timeSinceStart >= thirtyMinutes && timeSinceStart <= twentyFourHours) {
                if (!showFeedback) {
                  setCurrentRide({
                    id: rideId,
                    from: rideData.from || "Unknown",
                    to: rideData.to || "Unknown",
                    date: rideData.date || "",
                    time: rideData.time || "",
                    startTime: rideData.startTime || null,
                    hostId: rideData.hostId || "",
                    memberIds: rideData.memberIds || [],
                    seats: rideData.seats || 0,
                    rideFull: rideData.rideFull || false,
                    archived: rideData.archived || false,
                  });
                  setShowFeedback(true);
                  AsyncStorage.setItem(
                    FEEDBACK_COOLDOWN_KEY,
                    JSON.stringify({ timestamp: Date.now() }),
                  ).catch(console.error);
                }
              }
            }
          });
        },
        (error) => {
          console.error("Error in rides snapshot:", error);
        },
      );

      return unsubscribe;
    } catch (error) {
      console.error("Error checking rides for feedback:", error);
    }
  };

  // Monitor user's rides for feedback opportunities
  useEffect(() => {
    if (!userId || !isAuthLoaded || isLoading) return;

    const unsubscribePromise = checkRidesForFeedback();

    rideCheckIntervalRef.current = setInterval(
      () => { checkRidesForFeedback(); },
      5 * 60 * 1000,
    ) as unknown as NodeJS.Timeout;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === "active") {
        checkRidesForFeedback();
      }
      appStateRef.current = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      if (rideCheckIntervalRef.current) clearInterval(rideCheckIntervalRef.current);
      appStateSubscription.remove();
      unsubscribePromise
        ?.then((unsubscribe) => { if (unsubscribe) unsubscribe(); })
        ?.catch(console.error);
    };
  }, [userId, isAuthLoaded, isLoading, ratedRides, rateLaterRides, showFeedback]);

  const handleFeedbackClose = () => {
    setShowFeedback(false);
    setCurrentRide(null);
  };

  const handleRateLater = async () => {
    if (currentRide?.id) {
      setRateLaterRides(new Set([...rateLaterRides, currentRide.id]));
      await AsyncStorage.setItem(
        `rate_reminder_${currentRide.id}`,
        JSON.stringify({ rideId: currentRide.id, reminderTime: Date.now() + 6 * 60 * 60 * 1000 }),
      );
    }
    handleFeedbackClose();
  };

  const handleFeedbackSubmit = async () => {
    if (currentRide?.id) {
      setRatedRides(new Set([...ratedRides, currentRide.id]));
      if (rateLaterRides.has(currentRide.id)) {
        const next = new Set([...rateLaterRides]);
        next.delete(currentRide.id);
        setRateLaterRides(next);
        await AsyncStorage.removeItem(`rate_reminder_${currentRide.id}`);
      }
    }
    handleFeedbackClose();
  };

  // Check for pending reminders when app loads
  useEffect(() => {
    const checkReminders = async () => {
      if (!userId || !isAuthLoaded) return;

      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const reminderKeys = allKeys.filter((key) => key.startsWith("rate_reminder_"));
        const now = Date.now();

        for (const key of reminderKeys) {
          const reminderData = await AsyncStorage.getItem(key);
          if (reminderData) {
            const { rideId, reminderTime } = JSON.parse(reminderData);
            if (now >= reminderTime) {
              try {
                const rideDoc = await getDoc(doc(db, "rides", rideId));
                const rideData = rideDoc.data();
                if (rideData?.memberIds?.includes(userId) && !ratedRides.has(rideId)) {
                  setCurrentRide({
                    id: rideId,
                    from: rideData.from || "Unknown",
                    to: rideData.to || "Unknown",
                    date: rideData.date || "",
                    time: rideData.time || "",
                    startTime: rideData.startTime || null,
                    hostId: rideData.hostId || "",
                    memberIds: rideData.memberIds || [],
                    seats: rideData.seats || 0,
                    rideFull: rideData.rideFull || false,
                    archived: rideData.archived || false,
                  });
                  setShowFeedback(true);
                  await AsyncStorage.removeItem(key);
                  const next = new Set([...rateLaterRides]);
                  next.delete(rideId);
                  setRateLaterRides(next);
                  break;
                }
              } catch (error) {
                console.error(`Error checking reminder for ride ${rideId}:`, error);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error checking reminders:", error);
      }
    };

    if (isAuthLoaded && !isLoading) checkReminders();
  }, [userId, isAuthLoaded, isLoading, ratedRides, rateLaterRides]);

  // Force update check
  useEffect(() => {
    if (!isAuthLoaded) return;
    const checkVersion = async () => {
      try {
        const configDoc = await getDoc(doc(db, "config", "appVersion"));
        if (!configDoc.exists()) return;
        const minRequired: string = configDoc.data()?.minRequiredVersion;
        const current: string = Constants.expoConfig?.version ?? "0.0.0";
        if (minRequired && compareVersions(current, minRequired) < 0) {
          setShowForceUpdate(true);
        }
      } catch (e) {
        // Silently fail - don't block the app if Firestore is unreachable
      }
    };
    checkVersion();
  }, [isAuthLoaded]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === "chat_message" && data?.rideId) {
        router.push({
          pathname: "/(stack)/ride/[id]/chat",
          params: { id: String(data.rideId) },
        });
      }
    });
    return () => sub.remove();
  }, [router]);

  if (!loaded || !isAuthLoaded || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" }}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <ExpoStatusBar style="light" translucent backgroundColor="transparent" />
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000",
          paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
        }}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: true,
            contentStyle: { backgroundColor: "#000000" },
          }}
        >
          {/* Tabs are a root destination - never swipeable back into auth */}
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          {/* Edit Profile - native modal sheet, no swipe-dismiss (exit via Cancel/Save) */}
          <Stack.Screen
            name="edit-profile"
            options={{ presentation: "modal", gestureEnabled: false }}
          />
          {/* Detail / form screens presented as modal sheets */}
          <Stack.Screen name="(stack)/ride/[id]/edit" options={{ presentation: "modal" }} />
          <Stack.Screen name="(stack)/ride/[id]/group-settings" options={{ presentation: "modal" }} />
          <Stack.Screen name="(stack)/ride/[id]/viewProfile" options={{ presentation: "modal" }} />
          <Stack.Screen name="(stack)/settings/settings" options={{ presentation: "modal" }} />
          <Stack.Screen name="(stack)/settings/report-user" options={{ presentation: "modal" }} />
          <Stack.Screen name="(stack)/settings/contact-support" options={{ presentation: "modal" }} />
          <Stack.Screen name="(stack)/settings/privacy-policy" options={{ presentation: "modal" }} />
          <Stack.Screen name="(stack)/settings/terms-of-service" options={{ presentation: "modal" }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </View>

      {/* Force Update Modal */}
      <Modal visible={showForceUpdate} transparent animationType="fade">
        <View style={forceUpdateStyles.backdrop}>
          <View style={forceUpdateStyles.card}>
            <Text style={forceUpdateStyles.title}>Update Required</Text>
            <Text style={forceUpdateStyles.body}>
              A new version of BearPool is available with important improvements. Please update to continue.
            </Text>
            <TouchableOpacity
              style={forceUpdateStyles.button}
              onPress={() => Linking.openURL(APP_STORE_URL)}
            >
              <Text style={forceUpdateStyles.buttonText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Ride Feedback Modal */}
      <RideFeedbackModal
        visible={showFeedback}
        rideInfo={currentRide}
        onClose={handleFeedbackClose}
        onRateLater={handleRateLater}
        onFeedbackSubmit={handleFeedbackSubmit}
      />

      {/* App-wide confirm dialogs, action menus, and toasts */}
      <DialogHost />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const forceUpdateStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    backgroundColor: darkTheme.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
  },
  title: { color: darkTheme.textPrimary, fontSize: 20, fontWeight: "700", marginBottom: 12 },
  body: { color: darkTheme.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  button: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  buttonText: { color: darkTheme.textPrimary, fontSize: 16, fontWeight: "600" },
});

export default function RootLayout() {
  return (
    <GluestackUIProvider config={config}>
      <ThemeProvider value={DarkTheme}>
        <RootLayoutContent />
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
