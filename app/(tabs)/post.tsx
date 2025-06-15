import { db } from "@/services/firebaseConfig";
import { Timestamp, addDoc, collection } from "firebase/firestore";
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [seats, setSeats] = useState("1");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!from || !to || !date || !time || !seats) {
Alert.alert("Error", "Please fill out all required fields");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "rides"), {
        from,
        to,
        date,
        time,
        seats: Number(seats),
        notes,
        createdAt: Timestamp.now(),
      });

Alert.alert("Success", "Ride posted successfully!");
      
      // Reset form
      setFrom("");
      setTo("");
      setDate("");
      setTime("");
      setSeats("1");
      setNotes("");
    } catch (error) {
      console.error(error);
Alert.alert("Error", "Please fill out all required fields");
    } finally {
      setLoading(false);
    }
  };

  const getSafeSeats = () => {
    const parsed = parseInt(seats);
    return isNaN(parsed) ? 1 : parsed;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#121212" }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20
        }}
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

          {/* From */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              From
            </Text>
            <TextInput
              value={from}
              placeholder="e.g. Berkeley – Unit 1"
              placeholderTextColor="#666"
              onChangeText={setFrom}
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
              onChangeText={setTo}
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

          {/* Date */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Date
            </Text>
            <TextInput
              value={date}
              placeholder="e.g. June 20"
              placeholderTextColor="#666"
              onChangeText={setDate}
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

          {/* Time */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Time
            </Text>
            <TextInput
              value={time}
              placeholder="e.g. 4:00–6:00 PM"
              placeholderTextColor="#666"
              onChangeText={setTime}
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

          {/* Seats */}
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

          {/* Notes */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Additional Notes
            </Text>
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

          {/* Submit Button */}
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