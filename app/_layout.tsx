// app/_layout.tsx
import RideFeedbackModal from "@/components/RideFeedbackModal";
import "@/global.css";
import { config } from "@/gluestack-ui.config";
import { db } from "@/services/firebaseConfig";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
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
  Alert,
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

// ✅ Access Clerk publishable key via correct env variable
const publishableKey =
  Constants.expoConfig?.extra?.expoPublicClerkPublishableKey || "";

const tokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) => SecureStore.setItemAsync(key, value),
};

// Date utility function (moved from your chat screen)
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
  const { userId: clerkUserId, isLoaded: isAuthLoaded } = useAuth();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const router = useRouter();

  const [isClerkReady, setIsClerkReady] = useState(false);
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
          const ratedArray = JSON.parse(ratedData);
          setRatedRides(new Set(ratedArray));
        }

        if (rateLaterData) {
          const rateLaterArray = JSON.parse(rateLaterData);
          setRateLaterRides(new Set(rateLaterArray));
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
    const saveRatedRides = async () => {
      try {
        await AsyncStorage.setItem(RATED_RIDES_KEY, JSON.stringify([...ratedRides]));
      } catch (error) {
        console.error("Error saving rated rides:", error);
      }
    };

    if (ratedRides.size > 0) {
      saveRatedRides();
    }
  }, [ratedRides]);

  // Save rate-later rides to storage when they change
  useEffect(() => {
    const saveRateLaterRides = async () => {
      try {
        await AsyncStorage.setItem(
          RATE_LATER_RIDES_KEY,
          JSON.stringify([...rateLaterRides]),
        );
      } catch (error) {
        console.error("Error saving rate-later rides:", error);
      }
    };

    if (rateLaterRides.size > 0) {
      saveRateLaterRides();
    }
  }, [rateLaterRides]);

  // Check for rides that need feedback
  const checkRidesForFeedback = async () => {
    if (!clerkUserId || !isAuthLoaded || isLoading) return;

    try {
      // Get cooldown status
      const cooldownData = await AsyncStorage.getItem(FEEDBACK_COOLDOWN_KEY);
      if (cooldownData) {
        const { timestamp } = JSON.parse(cooldownData);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        // If within 24-hour cooldown, skip checking
        if (now - timestamp < twentyFourHours) {
          return;
        }
      }

      // Query active rides where user is a member
      const ridesQuery = query(
        collection(db, "rides"),
        where("memberIds", "array-contains", clerkUserId),
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

              // Skip if user has already rated this ride or marked it for later
              if (ratedRides.has(rideId) || rateLaterRides.has(rideId)) {
                return;
              }

              // Parse ride start time
              let startTime: Date | null = null;
              if (rideData.startTime) {
                startTime = rideData.startTime.toDate();
              } else if (rideData.date && rideData.time) {
                startTime = parseRideDateTime(rideData.date, rideData.time);
              }

              if (!startTime) return;

              const now = new Date();
              const timeSinceStart = now.getTime() - startTime.getTime();

              // Show feedback modal if ride started within the last 30 minutes to 24 hours
              // This gives a window for feedback
              const thirtyMinutesInMs = 1 * 60 * 1000;
              const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

              if (
                timeSinceStart >= thirtyMinutesInMs &&
                timeSinceStart <= twentyFourHoursInMs
              ) {
                // Don't show if modal is already showing
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

                  // Set cooldown to prevent immediate re-checking
                  AsyncStorage.setItem(
                    FEEDBACK_COOLDOWN_KEY,
                    JSON.stringify({
                      timestamp: Date.now(),
                    }),
                  );
                }
              }
            }
          });
        },
        (error) => {
          console.error("Error in rides snapshot:", error);
        },
      );

      // Return cleanup function
      return unsubscribe;
    } catch (error) {
      console.error("Error checking rides for feedback:", error);
    }
  };

  // Monitor user's rides for feedback opportunities
  useEffect(() => {
    if (!clerkUserId || !isAuthLoaded || isLoading) return;

    // Initial check
    const unsubscribePromise = checkRidesForFeedback();

    // Set up interval to check every 5 minutes
    rideCheckIntervalRef.current = setInterval(
      () => {
        checkRidesForFeedback();
      },
      5 * 60 * 1000,
    ) as unknown as NodeJS.Timeout; // 5 minutes

    // Check when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        checkRidesForFeedback();
      }
      appStateRef.current = nextAppState;
    };

    const appStateSubscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Cleanup
    return () => {
      if (rideCheckIntervalRef.current) {
        clearInterval(rideCheckIntervalRef.current);
      }
      appStateSubscription.remove();

      // Clean up the snapshot listener
      unsubscribePromise
        .then((unsubscribe) => {
          if (unsubscribe) unsubscribe();
        })
        .catch(console.error);
    };
  }, [
    clerkUserId,
    isAuthLoaded,
    isLoading,
    ratedRides,
    rateLaterRides,
    showFeedback,
  ]);

  const handleFeedbackClose = () => {
    setShowFeedback(false);
    setCurrentRide(null);
  };

  const handleRateLater = async () => {
    if (currentRide?.id) {
      // Add to rate-later list
      const newRateLaterRides = new Set([...rateLaterRides, currentRide.id]);
      setRateLaterRides(newRateLaterRides);

      // Schedule reminder in 6 hours
      const reminderTime = Date.now() + 6 * 60 * 60 * 1000;
      await AsyncStorage.setItem(
        `rate_reminder_${currentRide.id}`,
        JSON.stringify({ rideId: currentRide.id, reminderTime }),
      );

      console.log(`Scheduled reminder for ride ${currentRide.id} in 6 hours`);
    }

    handleFeedbackClose();
  };

  const handleFeedbackSubmit = async () => {
    if (currentRide?.id) {
      // Add to rated rides list
      const newRatedRides = new Set([...ratedRides, currentRide.id]);
      setRatedRides(newRatedRides);

      // Remove from rate-later list if it was there
      if (rateLaterRides.has(currentRide.id)) {
        const newRateLaterRides = new Set([...rateLaterRides]);
        newRateLaterRides.delete(currentRide.id);
        setRateLaterRides(newRateLaterRides);

        // Remove any pending reminder
        await AsyncStorage.removeItem(`rate_reminder_${currentRide.id}`);
      }
    }

    handleFeedbackClose();
  };

  // Check for pending reminders when app loads
  useEffect(() => {
    const checkReminders = async () => {
      if (!clerkUserId || !isAuthLoaded) return;

      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const reminderKeys = allKeys.filter((key) =>
          key.startsWith("rate_reminder_"),
        );

        const now = Date.now();

        for (const key of reminderKeys) {
          const reminderData = await AsyncStorage.getItem(key);
          if (reminderData) {
            const { rideId, reminderTime } = JSON.parse(reminderData);

            if (now >= reminderTime) {
              // Time for reminder - check if ride still exists and user is still a member
              try {
                const rideDoc = await getDoc(doc(db, "rides", rideId));
                const rideData = rideDoc.data();
                if (
                  rideData?.memberIds?.includes(clerkUserId) &&
                  !ratedRides.has(rideId)
                ) {
                  // Show feedback modal
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

                  // Remove the reminder
                  await AsyncStorage.removeItem(key);

                  // Remove from rate-later list
                  const newRateLaterRides = new Set([...rateLaterRides]);
                  newRateLaterRides.delete(rideId);
                  setRateLaterRides(newRateLaterRides);

                  break; // Only show one reminder at a time
                }
              } catch (error) {
                console.error(
                  `Error checking reminder for ride ${rideId}:`,
                  error,
                );
              }
            }
          }
        }
      } catch (error) {
        console.error("Error checking reminders:", error);
      }
    };

    if (isAuthLoaded && !isLoading) {
      checkReminders();
    }
  }, [clerkUserId, isAuthLoaded, isLoading, ratedRides, rateLaterRides]);

  useEffect(() => {
    // Give Clerk a moment to initialize
    const timer = setTimeout(() => setIsClerkReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Force update check — runs after auth is loaded so Firestore rules allow the read
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
        // Silently fail — don't block the app if Firestore is unreachable
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

  if (!loaded || !isClerkReady || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <>
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
            contentStyle: {
              backgroundColor: "#000000",
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
    </>
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
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  body: {
    color: "#a0a0a0",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#3a7bd5",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default function RootLayout() {
  const [isClerkReady, setIsClerkReady] = useState(false);

  useEffect(() => {
    // Give Clerk a moment to initialize
    const timer = setTimeout(() => setIsClerkReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isClerkReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!publishableKey) {
    console.error("❌ Clerk publishable key is missing! App may crash.");
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GluestackUIProvider config={config}>
        <ThemeProvider value={DarkTheme}>
          <RootLayoutContent />
        </ThemeProvider>
      </GluestackUIProvider>
    </ClerkProvider>
  );
}
