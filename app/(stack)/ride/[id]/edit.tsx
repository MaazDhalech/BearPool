import { db } from "@/services/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
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
    View
} from "react-native";

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
    const parsed = parseInt(seats);
    return isNaN(parsed) ? 1 : parsed;
  };

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
        date,
        time,
        seats: Number(seats),
        notes,
        genderPref,
        // Optionally add an updatedAt timestamp
        // updatedAt: Timestamp.now(),
      });

      Alert.alert("Success", "Ride updated successfully!", [
        {
          text: "OK",
          onPress: () => router.back()
        }
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
      <View style={{ 
        flex: 1, 
        backgroundColor: "#121212", 
        justifyContent: "center", 
        alignItems: "center" 
      }}>
        <ActivityIndicator size="large" color="#3a7bd5" />
        <Text style={{ color: "#ffffff", marginTop: 16 }}>Loading ride details...</Text>
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
        contentContainerStyle={{ flexGrow: 1, padding: 20 }}
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
            Edit Ride
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

          {/* Seat Picker */}
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

          {/* Gender Preference */}
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

          {/* Notes */}
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

          {/* Save Changes Button */}
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
            <Text style={{
              color: "white",
              textAlign: "center",
              fontWeight: "600",
              fontSize: 16,
            }}>
              {loading ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}