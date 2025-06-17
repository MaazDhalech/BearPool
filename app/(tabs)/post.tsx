import { db } from "@/services/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Timestamp, addDoc, collection, doc, getDoc, increment, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
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
  const [loading, setLoading] = useState(false);

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

const handleSubmit = async () => {
  if (!from || !to || !date || !time || !seats) {
    Alert.alert("Error", "Please fill out all required fields");
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
        ridesHosted: 1, // Initialize with 1 since this is their first ride
      });
    } else {
      // Increment ridesHosted by 1 if user already exists
      await setDoc(userDocRef, {
        ridesHosted: increment(1)
      }, { merge: true });
    }

    const chatId = `ride_${Date.now()}_${userId}`;
    await addDoc(collection(db, "rides"), {
      from,
      to,
      date,
      time,
      seats: Number(getSafeSeats()),
      notes,
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
          <Text style={{
            color: "#ffffff",
            fontSize: 28,
            fontWeight: "600",
            marginBottom: 30,
            textAlign: "left"
          }}>
            Post a Ride
          </Text>

          {[
            { label: "From", value: from, setter: setFrom, placeholder: "e.g. Berkeley – Unit 1" },
            { label: "To", value: to, setter: setTo, placeholder: "e.g. SFO Terminal 2" },
            { label: "Date", value: date, setter: setDate, placeholder: "e.g. June 20" },
            { label: "Time", value: time, setter: setTime, placeholder: "e.g. 4:00–6:00 PM" },
          ].map(({ label, value, setter, placeholder }) => (
            <View key={label} style={{ marginBottom: 16 }}>
              <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>{label}</Text>
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
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 8
            }}>
              <TouchableOpacity
                onPress={() => setSeats(String(Math.max(1, getSafeSeats() - 1)))}
                disabled={getSafeSeats() <= 1}
                style={{
                  backgroundColor: getSafeSeats() <= 1 ? "#333" : "#3a7bd5",
                  padding: 12,
                  borderRadius: 8,
                  marginRight: 16
                }}
              >
                <Text style={{ color: "white", fontSize: 18 }}>-</Text>
              </TouchableOpacity>

              <Text style={{ color: "white", fontSize: 18, minWidth: 30, textAlign: "center" }}>
                {seats}
              </Text>

              <TouchableOpacity
                onPress={() => setSeats(String(Math.min(6, getSafeSeats() + 1)))}
                disabled={getSafeSeats() >= 6}
                style={{
                  backgroundColor: getSafeSeats() >= 6 ? "#333" : "#3a7bd5",
                  padding: 12,
                  borderRadius: 8,
                  marginLeft: 16
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
            <View style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              marginTop: 8
            }}>
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
                    backgroundColor: genderPref === option.value ? "#3a7bd5" : "#1e1e1e",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: genderPref === option.value ? "#3a7bd5" : "#333",
                    marginBottom: 8,
                    width: "48%",
                  }}
                >
                  <Text style={{
                    color: genderPref === option.value ? "white" : "#a0a0a0",
                    textAlign: "center",
                    fontSize: 14,
                  }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>Additional Notes</Text>
            <TextInput
              value={notes}
              placeholder="Optional"
              placeholderTextColor="#666"
              onChangeText={setNotes}
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
            <Text style={{
              color: "white",
              textAlign: "center",
              fontWeight: "600",
              fontSize: 16,
            }}>
              {loading ? "Posting..." : "Post Ride"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
