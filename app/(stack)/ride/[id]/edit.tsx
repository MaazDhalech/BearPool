import { db } from "@/services/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { format, isValid, parse } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const MAX_NOTES_LENGTH = 200;

export default function EditRideScreen() {
  const { userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState("1");
  const [notes, setNotes] = useState("");
  const [genderPref, setGenderPref] = useState("N");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const getSafeSeats = () => {
    const parsed = parseInt(seats, 10);
    return isNaN(parsed) ? 1 : parsed;
  };

  function validateAndFormatDate(dateStr: string): string | null {
    const cleanedDateStr = dateStr
      .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
      .replace(/,?\s+(\d{4})$/, " $1")
      .trim();

    const formatsWithYear = [
      "MMMM d, yyyy",
      "MMM d, yyyy",
      "MMMM d yyyy",
      "MMM d yyyy",
    ];

    for (const fmt of formatsWithYear) {
      const parsedDate = parse(cleanedDateStr, fmt, new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, "MMMM d");
      }
    }

    const formatsWithoutYear = ["MMMM d", "MMM d"];

    for (const fmt of formatsWithoutYear) {
      const parsedDate = parse(cleanedDateStr, fmt, new Date());
      if (isValid(parsedDate)) {
        return format(parsedDate, "MMMM d");
      }
    }

    return null;
  }

  function validateAndFormatTime(timeStr: string): string | null {
    const parts = timeStr.split(/[-–]/).map((p) => p.trim());

    const parseTime = (str: string) => {
      let norm = str.toLowerCase().replace(/\s+/g, "");
      if (!norm.match(/:\d{2}/)) {
        norm = norm.replace(/(\d+)(am|pm)/, "$1:00$2");
      }
      const parsed = parse(norm, "h:mma", new Date());
      return isValid(parsed) ? format(parsed, "h:mm a") : null;
    };

    if (parts.length === 1) {
      return parseTime(parts[0]);
    } else if (parts.length === 2) {
      const start = parseTime(parts[0]);
      const end = parseTime(parts[1]);
      if (start && end) return `${start} - ${end}`;
    }

    return null;
  }

  // Load existing ride data
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

        // Check if current user is the host
        if (rideData.hostId !== userId) {
          Alert.alert("Error", "You can only edit your own rides");
          router.back();
          return;
        }

        // Pre-fill the form with existing data
        setFrom(rideData.from || "");
        setTo(rideData.to || "");
        setDate(rideData.date || "");
        setTime(rideData.time || "");
        setSeats(String(rideData.seats || 1));
        setNotes(rideData.notes || "");
        setGenderPref(rideData.genderPref || "N");
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

  const handleSaveChanges = async () => {
    if (!from || !to || !date || !time || !seats) {
      Alert.alert("Error", "Please fill out all required fields");
      return;
    }

    const formattedDate = validateAndFormatDate(date);
    if (!formattedDate) {
      Alert.alert(
        "Invalid Date",
        "Please enter a valid date like 'June 20th, 2025' or 'Jun 20 2025'."
      );
      return;
    }

    const formattedTime = validateAndFormatTime(time);
    if (!formattedTime) {
      Alert.alert(
        "Invalid Time",
        "Please enter a valid time like '4:00 PM' or time range like '4:00–6:00 PM'."
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

      await updateDoc(rideRef, {
        from,
        to,
        date: formattedDate,
        time: formattedTime,
        seats: Number(getSafeSeats()),
        notes,
        genderPref,
      });

      Alert.alert("Success", "Ride updated successfully!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error("Error updating ride:", error);
      Alert.alert("Error", "Failed to update ride. Please try again.");
    } finally {
      setLoading(false);
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
        <ActivityIndicator size="large" color="#3a7bd5" />
        <Text style={{ color: "#ffffff", marginTop: 16 }}>
          Loading ride details...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#121212" }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginTop: 60, marginBottom: 20 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 28,
              fontWeight: "600",
              marginBottom: 30,
              textAlign: "left",
            }}
          >
            Edit Ride
          </Text>

          {[
            {
              label: "From",
              value: from,
              setter: setFrom,
              placeholder: "e.g. Berkeley – Unit 1",
            },
            {
              label: "To",
              value: to,
              setter: setTo,
              placeholder: "e.g. SFO Terminal 2",
            },
            {
              label: "Date",
              value: date,
              setter: setDate,
              placeholder: "e.g. June 20",
            },
            {
              label: "Time",
              value: time,
              setter: setTime,
              placeholder: "e.g. 4:00–6:00 PM",
            },
          ].map(({ label, value, setter, placeholder }) => (
            <View key={label} style={{ marginBottom: 16 }}>
              <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
                {label}
              </Text>
              <TextInput
                value={value}
                placeholder={placeholder}
                placeholderTextColor="#666"
                onChangeText={setter}
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
          ))}

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              How many people do you want in the car?
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
                  backgroundColor: getSafeSeats() <= 1 ? "#333" : "#3a7bd5",
                  padding: 12,
                  borderRadius: 8,
                  marginRight: 16,
                }}
              >
                <Text style={{ color: "white", fontSize: 18 }}>-</Text>
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
                } // max 5 now
                disabled={getSafeSeats() >= 5} // disable if 5 or more
                style={{
                  backgroundColor: getSafeSeats() >= 5 ? "#333" : "#3a7bd5",
                  padding: 12,
                  borderRadius: 8,
                  marginLeft: 16,
                }}
              >
                <Text style={{ color: "white", fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Gender Preference
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              {[
                { value: "N", label: "No Preference" },
                { value: "M", label: "Male" },
                { value: "F", label: "Female" },
                { value: "NB", label: "Non-binary" },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setGenderPref(option.value)}
                  style={{
                    backgroundColor:
                      genderPref === option.value ? "#3a7bd5" : "#1e1e1e",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor:
                      genderPref === option.value ? "#3a7bd5" : "#333",
                    marginBottom: 8,
                    width: "48%",
                  }}
                >
                  <Text
                    style={{
                      color: genderPref === option.value ? "white" : "#a0a0a0",
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

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Additional Notes
            </Text>
            <TextInput
              value={notes}
              placeholder="Optional"
              placeholderTextColor="#666"
              onChangeText={(text) => {
                if (text.length <= MAX_NOTES_LENGTH) {
                  setNotes(text);
                }
              }}
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

          <TouchableOpacity
            onPress={handleSaveChanges}
            activeOpacity={0.8}
            disabled={loading}
            style={{
              backgroundColor: "#3a7bd5",
              padding: 16,
              borderRadius: 8,
              opacity: loading ? 0.7 : 1,
              shadowColor: "#3a7bd5",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text
              style={{
                color: "white",
                textAlign: "center",
                fontWeight: "600",
                fontSize: 16,
              }}
            >
              {loading ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
