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

    const resolvedEmail = await resolveEmail(identifier);
    if (!resolvedEmail) {
      setLoading(false);
      Alert.alert(
        "Invalid Identifier",
        "Please enter a valid @berkeley.edu email or a registered username."
      );
      return;
    }

    try {
      const signInAttempt = await signIn.create({
        identifier: resolvedEmail,
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
    <View style={{ padding: 20 }}>
      <Text style={{ color: "white", fontSize: 24, marginBottom: 20 }}>
        Sign in
      </Text>

      <TextInput
        autoCapitalize="none"
        value={identifier}
        placeholder="Enter Berkeley email or username"
        placeholderTextColor="#aaa"
        onChangeText={setIdentifier}
        style={{
          backgroundColor: "#222",
          color: "white",
          padding: 12,
          borderRadius: 6,
          marginBottom: 12,
        }}
      />
      <TextInput
        value={password}
        placeholder="Enter password"
        placeholderTextColor="#aaa"
        secureTextEntry={true}
        onChangeText={setPassword}
        style={{
          backgroundColor: "#222",
          color: "white",
          padding: 12,
          borderRadius: 6,
          marginBottom: 20,
        }}
      />

      <TouchableOpacity
        onPress={onSignInPress}
        activeOpacity={0.7}
        disabled={loading}
        style={{
          backgroundColor: "#007AFF",
          padding: 15,
          borderRadius: 6,
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          {loading ? "Signing in..." : "Continue"}
        </Text>
      </TouchableOpacity>

      <View
        style={{
          flexDirection: "row",
          marginTop: 15,
          justifyContent: "center",
          gap: 5,
        }}
      >
        <Text style={{ color: "white" }}>Don't have an account?</Text>
        <Link href="/(auth)/Signup" style={{ color: "#0af" }}>
          <Text style={{ color: "#0af" }}>Sign up</Text>
        </Link>
      </View>
    </View>
  );
}
