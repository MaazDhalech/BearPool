import { db } from "@/services/firebaseConfig";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import React from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

const isBerkeleyEmail = (email: string) => {
  return email.toLowerCase().endsWith("@berkeley.edu");
};

const BLANK_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function Signup() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");

  const isFormValid = () =>
    isBerkeleyEmail(emailAddress) &&
    username.trim().length > 0 &&
    password.length > 0 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0;

  const onSignUpPress = async () => {
    if (!isLoaded) return;

    if (!isBerkeleyEmail(emailAddress)) {
      Alert.alert(
        "Invalid Email",
        "Please use a valid @berkeley.edu email address."
      );
      return;
    }
    if (username.trim().length === 0) {
      Alert.alert("Invalid Username", "Please enter a username.");
      return;
    }
    if (firstName.trim().length === 0) {
      Alert.alert("Invalid First Name", "Please enter your first name.");
      return;
    }
    if (lastName.trim().length === 0) {
      Alert.alert("Invalid Last Name", "Please enter your last name.");
      return;
    }
    if (password.length === 0) {
      Alert.alert("Invalid Password", "Please enter a password.");
      return;
    }

    try {
      const signUpAttempt = await signUp.create({
        emailAddress,
        password,
        username,
        firstName,
        lastName,
      });

      await signUpAttempt.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      Alert.prompt(
        "Verification Code",
        "Enter the code sent to your email",
        async (code) => {
          try {
            const completeSignUp =
              await signUpAttempt.attemptEmailAddressVerification({ code });

            if (completeSignUp.status === "complete") {
              await setActive({ session: completeSignUp.createdSessionId });

              const userId = uuidv4();
              await setDoc(doc(db, "users", userId), {
                id: userId,
                avatar: BLANK_AVATAR,
                username: username.trim(),
                email: emailAddress.toLowerCase(),
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                pref: "N",
                createdAt: new Date(),
              });

              router.replace("/");
            } else {
              Alert.alert(
                "Verification Failed",
                "Could not complete verification. Try again."
              );
            }
          } catch (err) {
            console.error("Verification Error:", err);
            Alert.alert(
              "Verification Error",
              "Invalid code. Please try again."
            );
          }
        }
      );
    } catch (err) {
      console.error("Sign Up Error:", err);
      Alert.alert("Sign Up Error", "Something went wrong. Please try again.");
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ color: "white", fontSize: 24, marginBottom: 20 }}>
        Sign up
      </Text>

      <TextInput
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Enter email"
        placeholderTextColor="#aaa"
        onChangeText={setEmailAddress}
        style={{
          backgroundColor: "#222",
          color: "white",
          padding: 12,
          borderRadius: 6,
          marginBottom: 12,
        }}
        keyboardType="email-address"
      />

      <TextInput
        autoCapitalize="none"
        value={username}
        placeholder="Enter username"
        placeholderTextColor="#aaa"
        onChangeText={setUsername}
        style={{
          backgroundColor: "#222",
          color: "white",
          padding: 12,
          borderRadius: 6,
          marginBottom: 12,
        }}
      />

      <TextInput
        autoCapitalize="words"
        value={firstName}
        placeholder="Enter first name"
        placeholderTextColor="#aaa"
        onChangeText={setFirstName}
        style={{
          backgroundColor: "#222",
          color: "white",
          padding: 12,
          borderRadius: 6,
          marginBottom: 12,
        }}
      />

      <TextInput
        autoCapitalize="words"
        value={lastName}
        placeholder="Enter last name"
        placeholderTextColor="#aaa"
        onChangeText={setLastName}
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
        onPress={onSignUpPress}
        disabled={!isFormValid()}
        style={{
          backgroundColor: "#007AFF",
          padding: 15,
          borderRadius: 6,
          opacity: isFormValid() ? 1 : 0.5,
        }}
      >
        <Text
          style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
        >
          Continue
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
        <Text style={{ color: "white" }}>Already have an account?</Text>
        <Link href="/(auth)/Login" style={{ color: "#0af" }}>
          <Text style={{ color: "#0af" }}>Sign in</Text>
        </Link>
      </View>
    </View>
  );
}
