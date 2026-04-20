import { ACCENT } from "@/constants/Colors";
import { TYPE } from "@/constants/Typography";
import { SPACE } from "@/constants/Spacing";
import { NotificationOptInModal } from "@/components/NotificationOptInModal";
import { useNotificationOptInPrompt } from "@/hooks/useNotificationOptInPrompt";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SpringPressable } from "@/components/SpringPressable";
import { Stack, useRouter } from "expo-router";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  setDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import * as filter from "leo-profanity";

// Optional: Customize
filter.add(["ridehate", "berkeleybully"]);
// filter.remove("assassin");

const MAX_NOTES_LENGTH = 200;

export default function PostScreen() {
  const { userId } = useFirebaseAuth();
  const router = useRouter();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState<Date>(() => {
    const now = new Date();
    // Set default to current date and time
    return new Date(now);
  });
  const [seats, setSeats] = useState("1");
  const [notes, setNotes] = useState("");
  const [genderPref, setGenderPref] = useState("N");
  const [userGender, setUserGender] = useState<"M" | "F" | "NB" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTestRide, setIsTestRide] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [notifDenied, setNotifDenied] = useState(false);
  const pendingSuccessRef = useRef<(() => void) | null>(null);

  // Picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Success popup state
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [lastRideId, setLastRideId] = useState<string | null>(null);

  const { shouldPrompt, requestPermission, openSettings, markDismissed } =
    useNotificationOptInPrompt(userId);
  const { registerForPush } = usePushNotifications();

  const modalScale = useSharedValue(0.88);
  const modalOpacity = useSharedValue(0);
  const modalAnimStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));

  useEffect(() => {
    if (showSuccessPopup) {
      modalOpacity.value = withTiming(1, { duration: 200 });
      modalScale.value = withSpring(1, { damping: 20, stiffness: 320 });
    } else {
      modalOpacity.value = 0;
      modalScale.value = 0.88;
    }
  }, [showSuccessPopup]);

  const getSafeSeats = () => {
    const parsed = parseInt(seats, 10);
    return isNaN(parsed) ? 1 : parsed;
  };

  const clearForm = () => {
    setFrom("");
    setTo("");
    const now = new Date();
    // Set to current date and time
    setDate(new Date(now));
    setSeats("1");
    setNotes("");
    setGenderPref("N");
    setIsTestRide(false);
  };

  const triggerNotificationPrompt = async () => {
    const res = await shouldPrompt();
    console.log("[notif prompt][create] decision", res);
    if (res.shouldShow) {
      setNotifDenied(res.permissionStatus === "denied");
      setShowNotifPrompt(true);
    } else {
      if (res.permissionStatus === "granted") {
        // Permission already granted: ensure token registration happens
        await registerForPush?.();
      }
      // If no prompt, run any pending success action now
      pendingSuccessRef.current?.();
      pendingSuccessRef.current = null;
    }
  };

  // === Content validation using leo-profanity ===
  const validateContent = (text: string, fieldName: string): boolean => {
    if (filter.check(text)) {
      Alert.alert(
        "Inappropriate Content",
        `Please remove inappropriate language from the ${fieldName} field.`,
      );
      return false;
    }
    return true;
  };

  const cleanContent = (text: string): string => {
    return filter.clean(text);
  };

  // Date picker handler
  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    // Android handling
    if (Platform.OS === "android") {
      if (event.type === "set" && selectedDate) {
        // Keep the time from existing date, just change the date part
        const newDate = new Date(selectedDate);
        newDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
        setDate(newDate);
      }
      // Close the picker for both "set" and "dismissed" events
      setShowDatePicker(false);
      return;
    }

    // iOS handling - always update the date
    if (selectedDate) {
      // Keep the time from existing date, just change the date part
      const newDate = new Date(selectedDate);
      newDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setDate(newDate);
    }
  };

  // Time picker handler
  const handleTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date,
  ) => {
    // Android handling
    if (Platform.OS === "android") {
      if (event.type === "set" && selectedTime) {
        // Keep the date from existing date, just change the time part
        const newDate = new Date(date);
        newDate.setHours(
          selectedTime.getHours(),
          selectedTime.getMinutes(),
          0,
          0,
        );
        setDate(newDate);
      }
      // Close the picker for both "set" and "dismissed" events
      setShowTimePicker(false);
      return;
    }

    // iOS handling - always update the time
    if (selectedTime) {
      // Keep the date from existing date, just change the time part
      const newDate = new Date(date);
      newDate.setHours(
        selectedTime.getHours(),
        selectedTime.getMinutes(),
        0,
        0,
      );
      setDate(newDate);
    }
  };

  // Show date picker with platform-specific handling
  const showDatePickerModal = () => {
    setShowDatePicker(true);
  };

  // Show time picker with platform-specific handling
  const showTimePickerModal = () => {
    setShowTimePicker(true);
  };

  // === Load user gender ===
  useEffect(() => {
    const fetchUserGender = async () => {
      if (!userId) return;
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          setUserGender(userDoc.data()?.gender ?? null);
          setIsAdmin(userDoc.data()?.isAdmin === true);
        } else {
          setUserGender(null);
        }
      } catch (error) {
        console.error("Failed to fetch user gender:", error);
        setUserGender(null);
      }
    };
    fetchUserGender();
  }, [userId]);

  const allowedGenderPrefOptions = useMemo(() => {
    const options: { label: string; value: "N" | "M" | "F" | "NB" }[] = [
      { label: "No preference", value: "N" },
    ];
    if (userGender) {
      options.push({
        label:
          userGender === "M"
            ? "Men only"
            : userGender === "F"
              ? "Women only"
              : "Non-binary only",
        value: userGender,
      });
    }
    return options;
  }, [userGender]);

  useEffect(() => {
    const allowedValues = allowedGenderPrefOptions.map((opt) => opt.value);
    if (!allowedValues.includes(genderPref as any)) {
      setGenderPref("N");
    }
  }, [allowedGenderPrefOptions, genderPref]);

  // === Submit ride ===
  const handleSubmit = async () => {
    if (!from || !to || !seats) {
      Alert.alert("Error", "Please fill out all required fields");
      return;
    }

    if (!validateContent(from, "From")) return;
    if (!validateContent(to, "To")) return;
    if (!validateContent(notes, "Notes")) return;

    // Validate that date is in the future
    const now = new Date();
    if (date <= now) {
      Alert.alert(
        "Invalid Date",
        "Please select a date and time in the future.",
      );
      return;
    }

    setLoading(true);
    try {
      if (!userId) throw new Error("User not authenticated");
      const userDocRef = doc(db, "users", userId);
      const existing = await getDoc(userDocRef);

      if (!existing.exists()) {
        await setDoc(userDocRef, {
          createdAt: Timestamp.now(),
          ridesHosted: 1,
        });
      } else {
        await setDoc(
          userDocRef,
          { ridesHosted: increment(1) },
          { merge: true },
        );
      }

      const chatId = `ride_${Date.now()}_${userId}`;
      const cleanedFrom = cleanContent(from);
      const cleanedTo = cleanContent(to);
      const cleanedNotes = cleanContent(notes);

      const rideDocRef = await addDoc(collection(db, "rides"), {
        from: cleanedFrom,
        to: cleanedTo,
        date: format(date, "MMMM d"),
        time: format(date, "h:mm a"),
        seats: Number(getSafeSeats()),
        notes: cleanedNotes,
        createdAt: Timestamp.now(),
        hostId: userId,
        memberIds: [userId],
        chatId,
        rideFull: false,
        isActive: true,
        genderPref,
        isTest: isAdmin && isTestRide,
      });

      // Save the ride document ID to state
      setLastRideId(rideDocRef.id);

      clearForm();
      // Queue success popup, then run notification prompt. The popup appears after prompt completes.
      pendingSuccessRef.current = () => setShowSuccessPopup(true);
      triggerNotificationPrompt();
    } catch (error) {
      console.error("Post error:", error);
      Alert.alert("Error", "Failed to post ride. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle navigation after success
  const handleGoToHome = () => {
    setShowSuccessPopup(false);
    router.replace("/");
  };

  const handleGoToChat = () => {
    setShowSuccessPopup(false);
    router.replace("/(tabs)/chats");
  };

  // === Real-time input filtering ===
  const handleTextChange = (
    text: string,
    setter: (value: string) => void,
    maxLength?: number,
  ) => {
    if (maxLength && text.length > maxLength) return;

    if (filter.check(text)) {
      Alert.alert(
        "Inappropriate Content",
        "Please avoid using inappropriate language.",
      );
      return;
    }

    setter(text);
  };

  // Format date for display
  const formattedDate = format(date, "MMMM d, yyyy");
  const formattedTime = format(date, "h:mm a");

  const handleEnableNotifications = async () => {
    try {
      if (notifDenied) {
        await openSettings();
        return;
      }

      const status = await requestPermission();
      setNotifDenied(status === "denied");
      if (status === "granted") {
        await registerForPush?.();
      }
    } catch (error) {
      console.error("Notification prompt failed", error);
    } finally {
      setShowNotifPrompt(false);
      pendingSuccessRef.current?.();
      pendingSuccessRef.current = null;
    }
  };

  const handleDismissNotifications = async () => {
    try {
      await markDismissed();
    } catch (error) {
      console.error("Failed to mark notification prompt dismissed", error);
    } finally {
      setShowNotifPrompt(false);
      pendingSuccessRef.current?.();
      pendingSuccessRef.current = null;
    }
  };

  return (
    <>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#121212" }}
    >
      <LinearGradient
        colors={["rgba(255, 190, 92, 0.28)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }}
        pointerEvents="none"
      />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginTop: 60, marginBottom: 20 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: TYPE.size.display,
              fontWeight: TYPE.weight.bold,
              lineHeight: TYPE.size.display * TYPE.leading.tight,
              marginBottom: SPACE["2xl"],
              textAlign: "left",
            }}
          >
            Post a Ride
          </Text>

          {/* From */}
          <View style={{ marginBottom: SPACE.lg }}>
            <Text style={{ color: "#a0a0a0", marginBottom: SPACE.sm, fontSize: TYPE.size.caption }}>
              From
            </Text>
            <TextInput
              value={from}
              placeholder="e.g. Berkeley – Unit 1"
              placeholderTextColor="#666"
              onChangeText={(text) => handleTextChange(text, setFrom)}
              style={{
                backgroundColor: "#1e1e1e",
                color: "#ffffff",
                padding: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                fontSize: 16,
              }}
            />
          </View>

          {/* To */}
          <View style={{ marginBottom: SPACE.lg }}>
            <Text style={{ color: "#a0a0a0", marginBottom: SPACE.sm, fontSize: TYPE.size.caption }}>
              To
            </Text>
            <TextInput
              value={to}
              placeholder="e.g. SFO Terminal 2"
              placeholderTextColor="#666"
              onChangeText={(text) => handleTextChange(text, setTo)}
              style={{
                backgroundColor: "#1e1e1e",
                color: "#ffffff",
                padding: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                fontSize: 16,
              }}
            />
          </View>

          {/* Date Picker */}
          <View style={{ marginBottom: SPACE.lg }}>
            <Text style={{ color: "#a0a0a0", marginBottom: SPACE.sm, fontSize: TYPE.size.caption }}>
              Date
            </Text>
            <TouchableOpacity
              onPress={showDatePickerModal}
              activeOpacity={0.7}
              style={{
                backgroundColor: "#1e1e1e",
                padding: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 16 }}>
                {formattedDate}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={ACCENT} />
            </TouchableOpacity>
          </View>

          {/* Time Picker */}
          <View style={{ marginBottom: SPACE.lg }}>
            <Text style={{ color: "#a0a0a0", marginBottom: SPACE.sm, fontSize: TYPE.size.caption }}>
              Time
            </Text>
            <TouchableOpacity
              onPress={showTimePickerModal}
              activeOpacity={0.7}
              style={{
                backgroundColor: "#1e1e1e",
                padding: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 16 }}>
                {formattedTime}
              </Text>
              <Ionicons name="time-outline" size={18} color={ACCENT} />
            </TouchableOpacity>
          </View>

          {/* Seats */}
          <View style={{ marginBottom: SPACE.lg }}>
            <Text style={{ color: "#a0a0a0", marginBottom: SPACE.sm, fontSize: TYPE.size.caption }}>
              Open seats
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#1e1e1e",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                overflow: "hidden",
              }}
            >
              <TouchableOpacity
                onPress={() => setSeats(String(Math.max(1, getSafeSeats() - 1)))}
                disabled={getSafeSeats() <= 1}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: SPACE.xl,
                  backgroundColor: getSafeSeats() <= 1 ? "transparent" : "#2a2a2a",
                }}
              >
                <Text style={{ color: getSafeSeats() <= 1 ? "#555" : "white", fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.medium }}>−</Text>
              </TouchableOpacity>

              <Text style={{ color: "white", fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.bold, flex: 1, textAlign: "center" }}>
                {seats}
              </Text>

              <TouchableOpacity
                onPress={() => setSeats(String(Math.min(5, getSafeSeats() + 1)))}
                disabled={getSafeSeats() >= 5}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: SPACE.xl,
                  backgroundColor: getSafeSeats() >= 5 ? "transparent" : "#2a2a2a",
                }}
              >
                <Text style={{ color: getSafeSeats() >= 5 ? "#555" : "white", fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.medium }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Gender Preference */}
          <View style={{ marginBottom: SPACE.lg }}>
            <Text style={{ color: "#a0a0a0", marginBottom: SPACE.sm, fontSize: TYPE.size.caption }}>
              Gender Preference
            </Text>
            <Text style={{ color: "#666", fontSize: TYPE.size.micro, marginBottom: SPACE.sm }}>
              Only riders who match this selection will see your post. We hide other options to keep rides aligned with your profile.
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              {allowedGenderPrefOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setGenderPref(option.value)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: genderPref === option.value ? "#2e2610" : "#1e1e1e",
                    paddingVertical: SPACE.md,
                    paddingHorizontal: SPACE.lg,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: genderPref === option.value ? ACCENT : "#333",
                    marginBottom: SPACE.sm,
                    width: allowedGenderPrefOptions.length > 1 ? "48%" : "100%",
                  }}
                >
                  <Text
                    style={{
                      color: genderPref === option.value ? ACCENT : "#a0a0a0",
                      textAlign: "center",
                      fontSize: TYPE.size.body,
                      fontWeight: genderPref === option.value ? TYPE.weight.semibold : TYPE.weight.regular,
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={{ marginBottom: SPACE["2xl"] }}>
            <Text style={{ color: "#a0a0a0", marginBottom: SPACE.sm, fontSize: TYPE.size.caption }}>
              Notes
            </Text>
            <TextInput
              value={notes}
              placeholder="Optional"
              placeholderTextColor="#666"
              onChangeText={(text) =>
                handleTextChange(text, setNotes, MAX_NOTES_LENGTH)
              }
              maxLength={MAX_NOTES_LENGTH}
              multiline
              style={{
                backgroundColor: "#1e1e1e",
                color: "#ffffff",
                padding: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                fontSize: 16,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
            <Text
              style={{
                color: "#666",
                fontSize: 12,
                marginTop: 4,
                textAlign: "right",
              }}
            >
              {notes.length} / {MAX_NOTES_LENGTH}
            </Text>
          </View>

          {/* Test ride toggle — admin only */}
          {isAdmin && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#2e2610",
                borderWidth: 1,
                borderColor: ACCENT,
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ color: ACCENT, fontWeight: "600", fontSize: 15 }}>
                  Test Ride
                </Text>
                <Text style={{ color: "#888", fontSize: 13, marginTop: 2 }}>
                  Only visible to admins
                </Text>
              </View>
              <Switch
                value={isTestRide}
                onValueChange={setIsTestRide}
                trackColor={{ false: "#444", true: ACCENT }}
                thumbColor="#ffffff"
              />
            </View>
          )}

          {/* Submit */}
          <SpringPressable
            onPress={handleSubmit}
            disabled={loading}
            style={{
              backgroundColor: ACCENT,
              padding: 16,
              borderRadius: 8,
              opacity: loading ? 0.7 : 1,
              shadowColor: ACCENT,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text
              style={{
                color: "#121212",
                textAlign: "center",
                fontWeight: TYPE.weight.semibold,
                fontSize: TYPE.size.body,
              }}
            >
              {loading ? "Posting..." : "Post Ride"}
            </Text>
          </SpringPressable>
        </View>
      </ScrollView>

      {/* Success Popup Modal */}
      <Modal
        visible={showSuccessPopup}
        transparent={true}
        animationType="none"
        onRequestClose={handleGoToHome}
      >
        <TouchableWithoutFeedback onPress={handleGoToHome}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.7)",
              justifyContent: "center",
              alignItems: "center",
              padding: 20,
            }}
          >
            <TouchableWithoutFeedback>
              <Animated.View
                style={[modalAnimStyle, {
                  backgroundColor: "#1e1e1e",
                  borderRadius: 16,
                  padding: 24,
                  width: "100%",
                  maxWidth: 400,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#333",
                }]}
              >
                {/* Success Icon */}
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: "#4CAF50",
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 20,
                  }}
                >
                  <Ionicons name="checkmark" size={32} color="white" />
                </View>

                {/* Title */}
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: TYPE.size.subheading,
                    fontWeight: TYPE.weight.bold,
                    marginBottom: SPACE.sm,
                    textAlign: "center",
                  }}
                >
                  Ride is live
                </Text>

                {/* Message */}
                <Text
                  style={{
                    color: "#a0a0a0",
                    fontSize: TYPE.size.body,
                    marginBottom: SPACE["2xl"],
                    textAlign: "center",
                    lineHeight: TYPE.size.body * TYPE.leading.relaxed,
                  }}
                >
                  Your ride is now visible on the feed. Chat with anyone who joins to coordinate the details.
                </Text>

                {/* Buttons Container */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    width: "100%",
                    gap: 12,
                  }}
                >
                  {/* Go to Home Button */}
                  <TouchableOpacity
                    onPress={handleGoToHome}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      backgroundColor: "transparent",
                      paddingVertical: 14,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: ACCENT,
                    }}
                  >
                    <Text
                      style={{
                        color: ACCENT,
                        textAlign: "center",
                        fontWeight: "600",
                        fontSize: 16,
                      }}
                    >
                      Go to Home
                    </Text>
                  </TouchableOpacity>

                  {/* Go to Chat Button */}
                  <TouchableOpacity
                    onPress={handleGoToChat}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      backgroundColor: ACCENT,
                      paddingVertical: 14,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: "#121212",
                        textAlign: "center",
                        fontWeight: "600",
                        fontSize: 16,
                      }}
                    >
                      View Chats
                    </Text>
                  </TouchableOpacity>
                </View>

              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <NotificationOptInModal
        visible={showNotifPrompt}
        isDenied={notifDenied}
        onEnable={handleEnableNotifications}
        onClose={handleDismissNotifications}
      />

      {/* Android Date Picker Modal */}
      {Platform.OS === "android" && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.7)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <TouchableWithoutFeedback>
                <View
                  style={{
                    backgroundColor: "#1e1e1e",
                    borderRadius: 16,
                    padding: 24,
                    width: "90%",
                    maxWidth: 400,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 20,
                      fontWeight: "600",
                      marginBottom: 20,
                    }}
                  >
                    Select Date
                  </Text>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    themeVariant="dark"
                    textColor="#ffffff"
                    style={{
                      backgroundColor: "#1e1e1e",
                      width: "100%",
                      height: 180,
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(false)}
                    style={{
                      backgroundColor: ACCENT,
                      paddingVertical: 12,
                      paddingHorizontal: 32,
                      borderRadius: 8,
                      marginTop: 20,
                      alignSelf: "stretch",
                    }}
                  >
                    <Text
                      style={{
                        color: "#121212",
                        textAlign: "center",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Android Time Picker Modal */}
      {Platform.OS === "android" && showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowTimePicker(false)}>
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.7)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <TouchableWithoutFeedback>
                <View
                  style={{
                    backgroundColor: "#1e1e1e",
                    borderRadius: 16,
                    padding: 24,
                    width: "90%",
                    maxWidth: 400,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 20,
                      fontWeight: "600",
                      marginBottom: 20,
                    }}
                  >
                    Select Time
                  </Text>
                  <DateTimePicker
                    value={date}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    themeVariant="dark"
                    textColor="#ffffff"
                    style={{
                      backgroundColor: "#1e1e1e",
                      width: "100%",
                      height: 180,
                    }}
                    is24Hour={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(false)}
                    style={{
                      backgroundColor: ACCENT,
                      paddingVertical: 12,
                      paddingHorizontal: 32,
                      borderRadius: 8,
                      marginTop: 20,
                      alignSelf: "stretch",
                    }}
                  >
                    <Text
                      style={{
                        color: "#121212",
                        textAlign: "center",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* iOS Date Picker Modal */}
      {Platform.OS === "ios" && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" }}>
              <TouchableWithoutFeedback>
                <View style={{ backgroundColor: "#1e1e1e", borderRadius: 16, padding: SPACE["2xl"], width: "90%", maxWidth: 400, alignItems: "center" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.xl, width: "100%" }}>
                    <Text style={{ color: "#ffffff", fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.semibold }}>
                      Select Date
                    </Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ padding: SPACE.sm }}>
                      <Text style={{ color: ACCENT, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold }}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                    themeVariant="dark"
                    textColor="#ffffff"
                    style={{ backgroundColor: "#1e1e1e", width: "100%", height: 200 }}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* iOS Time Picker Modal */}
      {Platform.OS === "ios" && showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowTimePicker(false)}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" }}>
              <TouchableWithoutFeedback>
                <View style={{ backgroundColor: "#1e1e1e", borderRadius: 16, padding: SPACE["2xl"], width: "90%", maxWidth: 400, alignItems: "center" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.xl, width: "100%" }}>
                    <Text style={{ color: "#ffffff", fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.semibold }}>
                      Select Time
                    </Text>
                    <TouchableOpacity onPress={() => setShowTimePicker(false)} style={{ padding: SPACE.sm }}>
                      <Text style={{ color: ACCENT, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold }}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={date}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    themeVariant="dark"
                    textColor="#ffffff"
                    style={{ backgroundColor: "#1e1e1e", width: "100%", height: 200 }}
                    is24Hour={false}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </KeyboardAvoidingView>
    </>
  );
}
