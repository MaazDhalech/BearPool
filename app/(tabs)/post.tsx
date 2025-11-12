import { db } from "@/services/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Filter } from "bad-words";
import { format, isValid, parse } from "date-fns";
import { useRouter } from "expo-router";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  setDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
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

export default function PostScreen() {
  const { userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState("1");
  const [notes, setNotes] = useState("");
  const [genderPref, setGenderPref] = useState("N");
  const [userGender, setUserGender] = useState<"M" | "F" | "NB" | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize content filter
  const filter = new Filter();

  const getSafeSeats = () => {
    const parsed = parseInt(seats, 10);
    return isNaN(parsed) ? 1 : parsed;
  };

  const clearForm = () => {
    setFrom("");
    setTo("");
    setDate("");
    setTime("");
    setSeats("1");
    setNotes("");
    setGenderPref("N");
  };

  // Content filtering function
  const validateContent = (text: string, fieldName: string): boolean => {
    if (filter.isProfane(text)) {
      Alert.alert(
        "Inappropriate Content",
        `Please remove inappropriate language from the ${fieldName} field.`
      );
      return false;
    }
    return true;
  };

  // Clean content function (alternative approach)
  const cleanContent = (text: string): string => {
    return filter.clean(text);
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

  const allowedGenderPrefOptions = useMemo(() => {
    const options = [{ label: "No preference", value: "N" as const }];
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

  const handleSubmit = async () => {
    if (!from || !to || !date || !time || !seats) {
      Alert.alert("Error", "Please fill out all required fields");
      return;
    }

    // Validate content for inappropriate language
    if (!validateContent(from, "From")) return;
    if (!validateContent(to, "To")) return;
    if (!validateContent(notes, "Additional Notes")) return;

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

    setLoading(true);
    try {
      if (!userId) throw new Error("User not authenticated");
      const userDocRef = doc(db, "users", userId);
      const existingUser = await getDoc(userDocRef);

      if (!existingUser.exists()) {
        await setDoc(userDocRef, {
          name: user?.fullName || "Unknown",
          email: user?.primaryEmailAddress?.emailAddress || "Unknown",
          profileImage: user?.imageUrl || "",
          createdAt: Timestamp.now(),
          ridesHosted: 1,
        });
      } else {
        await setDoc(
          userDocRef,
          {
            ridesHosted: increment(1),
          },
          { merge: true }
        );
      }

      const chatId = `ride_${Date.now()}_${userId}`;
      
      // Clean content before saving (optional: use either validation or cleaning)
      const cleanedFrom = cleanContent(from);
      const cleanedTo = cleanContent(to);
      const cleanedNotes = cleanContent(notes);

      await addDoc(collection(db, "rides"), {
        from: cleanedFrom,
        to: cleanedTo,
        date: formattedDate,
        time: formattedTime,
        seats: Number(getSafeSeats()),
        notes: cleanedNotes,
        createdAt: Timestamp.now(),
        hostId: userId,
        memberIds: [userId],
        chatId,
        rideFull: false,
        isActive: true,
        genderPref,
      });

      clearForm();
      router.replace("/");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to post ride. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handler for real-time content filtering in text inputs
  const handleTextChange = (text: string, setter: (value: string) => void, maxLength?: number) => {
    if (maxLength && text.length > maxLength) {
      return;
    }
    
    // Option 1: Block inappropriate content immediately
    if (filter.isProfane(text)) {
      Alert.alert(
        "Inappropriate Content",
        "Please avoid using inappropriate language."
      );
      return;
    }
    
    // Option 2: Auto-clean content (comment out the above if using this)
    // const cleanedText = filter.clean(text);
    // setter(cleanedText);
    
    setter(text);
  };

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
            Post a Ride
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
                onChangeText={(text) => handleTextChange(text, setter)}
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
                }
                disabled={getSafeSeats() >= 5}
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
            <Text style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
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
                    width:
                      allowedGenderPrefOptions.length > 1 ? "48%" : "100%",
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
              onChangeText={(text) => handleTextChange(text, setNotes, MAX_NOTES_LENGTH)}
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
            onPress={handleSubmit}
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
              {loading ? "Posting..." : "Post Ride"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
