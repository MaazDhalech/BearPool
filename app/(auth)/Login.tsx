import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import React from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

import { db } from "@/services/firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";

const isBerkeleyEmail = (email: string) => {
  return email.toLowerCase().endsWith("@berkeley.edu");
};

export default function Login() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function resolveEmail(input: string): Promise<string | null> {
    input = input.trim().toLowerCase();
    if (isBerkeleyEmail(input)) {
      return input;
    }

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", input));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data();
        if (userDoc.email && isBerkeleyEmail(userDoc.email)) {
          return userDoc.email.toLowerCase();
        }
      }
    } catch (e) {
      console.error("Error fetching user by username:", e);
    }

    return null;
  }

  const onSignInPress = async () => {
    if (!isLoaded) return;

    setLoading(true);

    try {
      const signInAttempt = await signIn.create({
        identifier, // directly pass whatever user entered
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2));
        Alert.alert("Sign In Error", "Unable to complete sign in.");
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
      Alert.alert("Sign In Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: "#121212", justifyContent: "center" }}>
      <Text style={{ color: "#ffffff", fontSize: 28, fontWeight: "600", marginBottom: 30, textAlign: "center" }}>
        Welcome Back
      </Text>

      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
          Email or Username
        </Text>
        <TextInput
          autoCapitalize="none"
          value={identifier}
          placeholder="Enter Berkeley email or username"
          placeholderTextColor="#666"
          onChangeText={setIdentifier}
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

      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
          Password
        </Text>
        <TextInput
          value={password}
          placeholder="Enter password"
          placeholderTextColor="#666"
          secureTextEntry={true}
          onChangeText={setPassword}
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
        onPress={onSignInPress}
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
          {loading ? "Signing in..." : "Continue"}
        </Text>
      </TouchableOpacity>

      <View
        style={{
          flexDirection: "row",
          marginTop: 24,
          justifyContent: "center",
          gap: 5,
        }}
      >
        <Text style={{ color: "#a0a0a0" }}>Don't have an account?</Text>
        <Link href="/(auth)/Signup" asChild>
          <TouchableOpacity>
            <Text style={{ color: "#3a7bd5", fontWeight: "500" }}>Sign up</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}