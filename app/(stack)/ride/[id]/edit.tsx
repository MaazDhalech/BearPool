import { ACCENT } from "@/constants/Colors";
import { db } from "@/services/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as filter from "leo-profanity";

// Optional: Customize
filter.add(["ridehate", "berkeleybully"]);
// filter.remove("assassin");

const MAX_NOTES_LENGTH = 200;

export default function EditRideScreen() {
  const { userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState<Date>(() => {
    return new Date(); // Just use current time as placeholder
  });
  const [seats, setSeats] = useState("1");
  const [notes, setNotes] = useState("");
  const [genderPref, setGenderPref] = useState("N");
  const [userGender, setUserGender] = useState<"M" | "F" | "NB" | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Deletion states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const deletionReasons = [
    "No longer needed",
    "Found alternative transportation",
    "Change in plans",
    "Low passenger interest",
    "Technical issues",
    "Safety concerns",
    "Other",
  ];

  const allowedGenderPrefOptions = useMemo(() => {
    const options: Array<{ label: string; value: "N" | "M" | "F" | "NB" }> = [
      { label: "No preference", value: "N" as const },
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

  const getSafeSeats = () => {
    const parsed = parseInt(seats, 10);
    return isNaN(parsed) ? 1 : parsed;
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

  // Show date picker
  const showDatePickerModal = () => {
    setShowDatePicker(true);
  };

  // Show time picker
  const showTimePickerModal = () => {
    setShowTimePicker(true);
  };

  // === Real-time input filtering ===
  const handleTextChange = (
    text: string,
    setter: (value: string) => void,
    maxLength?: number,
  ) => {
    if (maxLength && text.length > maxLength) return;

    // Block profanity in real-time
    if (filter.check(text)) {
      Alert.alert(
        "Inappropriate Content",
        "Please avoid using inappropriate language.",
      );
      return;
    }

    setter(text);
  };

  // === Load ride data ===
  useEffect(() => {
    const loadRideData = async () => {
      if (!id || !userId) return;

      try {
        const rideDoc = await getDoc(doc(db, "rides", id as string));
        if (!rideDoc.exists()) {
          Alert.alert("Error", "Ride not found");
          router.back();
          return;
        }

        const rideData = rideDoc.data();
        if (rideData.hostId !== userId) {
          Alert.alert("Error", "You can only edit your own rides");
          router.back();
          return;
        }

        setFrom(rideData.from || "");
        setTo(rideData.to || "");
        setSeats(String(rideData.seats || 1));
        setNotes(rideData.notes || "");
        setGenderPref(rideData.genderPref || "N");

        // Parse date and time from existing ride data
        if (rideData.date && rideData.time) {
          try {
            // Combine date and time into a single Date object
            const currentYear = new Date().getFullYear();
            const dateStr = `${rideData.date}, ${currentYear}`;
            const timeStr = rideData.time.split(" - ")[0]; // Take first time if it's a range

            // Parse the date (format like "June 20, 2024")
            const parsedDate = new Date(dateStr);

            // Parse the time (format like "4:00 PM")
            const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1]);
              const minutes = parseInt(timeMatch[2]);
              const period = timeMatch[3].toUpperCase();

              if (period === "PM" && hours < 12) hours += 12;
              if (period === "AM" && hours === 12) hours = 0;

              parsedDate.setHours(hours, minutes, 0, 0);
            }

            if (!isNaN(parsedDate.getTime())) {
              setDate(parsedDate);
            }
          } catch (error) {
            console.error("Error parsing existing date/time:", error);
            // Fallback to default date
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(8, 0, 0, 0);
            setDate(tomorrow);
          }
        }
      } catch (error) {
        console.error("Error loading ride data:", error);
        Alert.alert("Error", "Failed to load ride data");
        router.back();
      } finally {
        setInitialLoading(false);
      }
    };

    loadRideData();
  }, [id, userId]);

  // === Load user gender ===
  useEffect(() => {
    const fetchUserGender = async () => {
      if (!userId) return;
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          setUserGender(userDoc.data()?.gender ?? null);
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

  // === Save changes ===
  const handleSaveChanges = async () => {
    if (!from || !to || !seats) {
      Alert.alert("Error", "Please fill out all required fields");
      return;
    }

    if (!validateContent(from, "From")) return;
    if (!validateContent(to, "To")) return;
    if (!validateContent(notes, "Additional Notes")) return;

    // Validate that date is in the future
    const now = new Date();
    if (date <= now) {
      Alert.alert(
        "Invalid Date",
        "Please select a date and time in the future.",
      );
      return;
    }

    if (!id) {
      Alert.alert("Error", "No ride ID provided");
      return;
    }

    setLoading(true);
    try {
      const rideRef = doc(db, "rides", id as string);
      const cleanedFrom = cleanContent(from);
      const cleanedTo = cleanContent(to);
      const cleanedNotes = cleanContent(notes);

      await updateDoc(rideRef, {
        from: cleanedFrom,
        to: cleanedTo,
        date: format(date, "MMMM d"),
        time: format(date, "h:mm a"),
        seats: Number(getSafeSeats()),
        notes: cleanedNotes,
        genderPref,
      });

      Alert.alert("Success", "Ride updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error updating ride:", error);
      Alert.alert("Error", "Failed to update ride. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // === Delete ride ===
  const handleDeleteRide = () => {
    Alert.alert(
      "Delete Ride",
      "Are you sure you want to delete this ride? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => setShowDeleteModal(true),
        },
      ],
    );
  };

  const handleSubmitDeletion = async () => {
    if (!deletionReason) {
      Alert.alert("Error", "Please select a reason for deleting the ride.");
      return;
    }

    if (deletionReason === "Other" && !customReason.trim()) {
      Alert.alert("Error", "Please provide a reason for deletion.");
      return;
    }

    const finalReason =
      deletionReason === "Other" ? customReason : deletionReason;

    setDeleting(true);
    try {
      if (!id) {
        throw new Error("No ride ID provided");
      }

      const rideRef = doc(db, "rides", id as string);

      // First verify the ride exists
      const rideSnap = await getDoc(rideRef);
      if (!rideSnap.exists()) {
        throw new Error("Ride not found");
      }

      // Delete the ride document
      await deleteDoc(rideRef);

      Alert.alert("Success", "Ride deleted successfully!", [
        {
          text: "OK",
          onPress: () => {
            // Navigate back to chats or home screen
            router.replace("/(tabs)/chats");
          },
        },
      ]);
    } catch (error) {
      console.error("Error deleting ride:", error);
      Alert.alert("Error", "Failed to delete ride. Please try again.", [
        { text: "OK", style: "default" },
      ]);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
      setDeletionReason("");
      setCustomReason("");
    }
  };

  if (initialLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#121212",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={{ color: "#ffffff", marginTop: 16 }}>
          Loading ride details...
        </Text>
      </View>
    );
  }

  // Format date for display
  const formattedDate = format(date, "MMMM d, yyyy");
  const formattedTime = format(date, "h:mm a");

  return (
    <>
    <Stack.Screen options={{ gestureEnabled: !loading }} />
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#121212" }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#333",
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: 8, borderRadius: 20, marginRight: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text
          style={{ color: "#ffffff", fontSize: 20, fontWeight: "600", flex: 1 }}
        >
          Edit Ride
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 20 }}>
          {/* From */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
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
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
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
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Date
            </Text>
            <TouchableOpacity
              onPress={showDatePickerModal}
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
              <Text style={{ color: ACCENT, fontSize: 16 }}>📅</Text>
            </TouchableOpacity>
          </View>

          {/* Time Picker */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Time
            </Text>
            <TouchableOpacity
              onPress={showTimePickerModal}
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
              <Text style={{ color: ACCENT, fontSize: 16 }}>🕒</Text>
            </TouchableOpacity>
          </View>

          {/* Seats */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              How many other people do you want in the car?
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              <TouchableOpacity
                onPress={() =>
                  setSeats(String(Math.max(1, getSafeSeats() - 1)))
                }
                disabled={getSafeSeats() <= 1}
                style={{
                  backgroundColor: getSafeSeats() <= 1 ? "#333" : ACCENT,
                  padding: 12,
                  borderRadius: 8,
                  marginRight: 16,
                }}
              >
                <Text style={{ color: getSafeSeats() <= 1 ? "#a0a0a0" : "#121212", fontSize: 18 }}>-</Text>
              </TouchableOpacity>

              <Text
                style={{
                  color: "white",
                  fontSize: 18,
                  minWidth: 30,
                  textAlign: "center",
                }}
              >
                {seats}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setSeats(String(Math.min(5, getSafeSeats() + 1)))
                }
                disabled={getSafeSeats() >= 5}
                style={{
                  backgroundColor: getSafeSeats() >= 5 ? "#333" : ACCENT,
                  padding: 12,
                  borderRadius: 8,
                  marginLeft: 16,
                }}
              >
                <Text style={{ color: getSafeSeats() >= 5 ? "#a0a0a0" : "#121212", fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Gender Preference */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Gender Preference
            </Text>
            <Text style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
              We only show options that match your profile to keep rides aligned
              with your identity. Riders who don't match won't see this post.
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
                    backgroundColor:
                      genderPref === option.value ? ACCENT : "#1e1e1e",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor:
                      genderPref === option.value ? ACCENT : "#333",
                    marginBottom: 8,
                    width: allowedGenderPrefOptions.length > 1 ? "48%" : "100%",
                  }}
                >
                  <Text
                    style={{
                      color: genderPref === option.value ? "#121212" : "#a0a0a0",
                      textAlign: "center",
                      fontSize: 14,
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Additional Notes
            </Text>
            <TextInput
              value={notes}
              placeholder="Optional"
              placeholderTextColor="#666"
              onChangeText={(text) =>
                handleTextChange(text, setNotes, MAX_NOTES_LENGTH)
              }
              maxLength={MAX_NOTES_LENGTH}
              multiline={true}
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

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSaveChanges}
            activeOpacity={0.8}
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
              marginBottom: 12,
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
              {loading ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>

          {/* Delete Button */}
          <TouchableOpacity
            onPress={handleDeleteRide}
            activeOpacity={0.8}
            disabled={loading}
            style={{
              backgroundColor: "transparent",
              padding: 16,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#ff5555",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Text
              style={{
                color: "#ff5555",
                textAlign: "center",
                fontWeight: "600",
                fontSize: 16,
              }}
            >
              Delete Ride
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Deletion Feedback Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !deleting && setShowDeleteModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#1e1e1e",
              borderRadius: 16,
              padding: 24,
              maxHeight: "80%",
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={{
                  color: "white",
                  fontSize: 20,
                  fontWeight: "600",
                  marginBottom: 2,
                }}
              >
                Delete Ride
              </Text>
              {from && to ? (
                <Text
                  style={{ color: "white", marginBottom: 16, fontSize: 18 }}
                >
                  {from} → {to}
                </Text>
              ) : (
                <Text
                  style={{ color: "white", marginBottom: 16, fontSize: 18 }}
                >
                  Untitled Ride
                </Text>
              )}

              <Text
                style={{ color: "#a0a0a0", marginBottom: 24, fontSize: 14 }}
              >
                Please help us improve by telling us why you're deleting this
                ride.
              </Text>

              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    color: "white",
                    fontWeight: "600",
                    fontSize: 16,
                    marginBottom: 12,
                  }}
                >
                  Select a reason for deletion:
                </Text>

                {deletionReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setDeletionReason(reason)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 12,
                      backgroundColor:
                        deletionReason === reason ? "#2a2a2a" : "#252525",
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor:
                          deletionReason === reason ? "#ff5555" : "#666",
                        backgroundColor:
                          deletionReason === reason ? "#ff5555" : "transparent",
                        marginRight: 12,
                      }}
                    />
                    <Text style={{ color: "white", flex: 1, fontSize: 16 }}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {deletionReason === "Other" && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      color: "white",
                      fontWeight: "600",
                      fontSize: 16,
                      marginBottom: 8,
                    }}
                  >
                    Please specify:
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: "#252525",
                      borderColor: "#333",
                      borderWidth: 1,
                      borderRadius: 8,
                      color: "white",
                      padding: 12,
                      minHeight: 100,
                      textAlignVertical: "top",
                      fontSize: 16,
                    }}
                    placeholderTextColor="#666"
                    multiline
                    onChangeText={setCustomReason}
                    value={customReason}
                    placeholder="Enter your reason for deleting this ride..."
                  />
                </View>
              )}

              <View style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={handleSubmitDeletion}
                  disabled={deleting || !deletionReason}
                  style={{
                    backgroundColor: "#ff5555",
                    padding: 16,
                    borderRadius: 8,
                    opacity: deleting || !deletionReason ? 0.6 : 1,
                  }}
                >
                  {deleting ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: "white",
                          borderTopColor: "transparent",
                        }}
                      />
                      <Text
                        style={{
                          color: "white",
                          marginLeft: 8,
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        Deleting...
                      </Text>
                    </View>
                  ) : (
                    <Text
                      style={{
                        color: "white",
                        textAlign: "center",
                        fontSize: 16,
                        fontWeight: "600",
                      }}
                    >
                      Delete Ride
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (!deleting) {
                      setShowDeleteModal(false);
                      setDeletionReason("");
                      setCustomReason("");
                    }
                  }}
                  disabled={deleting}
                  style={{
                    backgroundColor: "transparent",
                    padding: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#666",
                  }}
                >
                  <Text
                    style={{
                      color: "#a0a0a0",
                      textAlign: "center",
                      fontSize: 16,
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      {/* iOS Date Picker Modal - Centered */}
      {Platform.OS === "ios" && showDatePicker && (
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
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 20,
                      width: "100%",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(false)}
                      style={{ padding: 8 }}
                    >
                      <Text style={{ color: ACCENT, fontSize: 16 }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 18,
                        fontWeight: "600",
                      }}
                    >
                      Select Date
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(false)}
                      style={{ padding: 8 }}
                    >
                      <Text
                        style={{
                          color: ACCENT,
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        Done
                      </Text>
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
                    style={{
                      backgroundColor: "#1e1e1e",
                      width: "100%",
                      height: 200,
                    }}
                  />
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* iOS Time Picker Modal - Centered */}
      {Platform.OS === "ios" && showTimePicker && (
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
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 20,
                      width: "100%",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setShowTimePicker(false)}
                      style={{ padding: 8 }}
                    >
                      <Text style={{ color: ACCENT, fontSize: 16 }}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 18,
                        fontWeight: "600",
                      }}
                    >
                      Select Time
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowTimePicker(false)}
                      style={{ padding: 8 }}
                    >
                      <Text
                        style={{
                          color: ACCENT,
                          fontSize: 16,
                          fontWeight: "600",
                        }}
                      >
                        Done
                      </Text>
                    </TouchableOpacity>
                  </View>

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
                      height: 200,
                    }}
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
