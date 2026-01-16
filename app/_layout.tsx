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
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
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
  AppState,
  AppStateStatus,
  Platform,
  StatusBar,
  View,
} from "react-native";

// ✅ Access Clerk publishable key via correct env variable
const publishableKey =
  Constants.expoConfig?.extra?.expoPublicClerkPublishableKey || "";

const tokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value),
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

// AsyncStorage keys
const RATED_RIDES_KEY = "rated_rides";
const RATE_LATER_RIDES_KEY = "rate_later_rides";
const FEEDBACK_COOLDOWN_KEY = "feedback_cooldown";

function RootLayoutContent() {
  const { userId: clerkUserId, isLoaded: isAuthLoaded } = useAuth();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const [isClerkReady, setIsClerkReady] = useState(false);
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
        await AsyncStorage.setItem(
          RATED_RIDES_KEY,
          JSON.stringify([...ratedRides]),
        );
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
          paddingTop:
            Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
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
