import { db } from "@/services/firebaseConfig";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
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
  const [error, setError] = React.useState("");
  const [showVerification, setShowVerification] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState("");
  const [signUpAttempt, setSignUpAttempt] = React.useState<any>(null);

  const isFormValid = () =>
    isBerkeleyEmail(emailAddress) &&
    username.trim().length > 0 &&
    password.length > 0 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0;

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    setError("");

    // Password validation
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError(
        "Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character."
      );
      return;
    }

    try {
      const attempt = await signUp.create({
        emailAddress,
        password,
        username,
        firstName,
        lastName,
      });

      await attempt.prepareEmailAddressVerification({ strategy: "email_code" });
      setSignUpAttempt(attempt);
      setShowVerification(true);
    } catch (err: any) {
      console.error("Sign Up Error:", err);
      setError(err?.errors?.[0]?.message || "Signup failed. Try again.");
    }
  };

  const onVerifyPress = async () => {
    if (!verificationCode || !signUpAttempt) {
      setError("Verification code is required.");
      return;
    }

    try {
      const completeSignUp =
        await signUpAttempt.attemptEmailAddressVerification({
          code: verificationCode,
        });

      if (completeSignUp.status === "complete") {
        if (setActive) {
          await setActive({ session: completeSignUp.createdSessionId });
        }

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
          ridesJoined: 0,
          ridesHosted: 0,
        });

        router.replace("/");
      } else {
        setError("Verification failed. Please check the code.");
      }
    } catch (err) {
      console.error("Verification Error:", err);
      setError("Invalid code. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 20,
        backgroundColor: "#000",
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "bold",
          marginBottom: 20,
        }}
      >
        Sign up
      </Text>

      {error ? (
        <View
          style={{
            backgroundColor: "#440000",
            padding: 10,
            borderRadius: 6,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: "#ffcccc", textAlign: "center" }}>{error}</Text>
        </View>
      ) : null}

      <TextInput
        autoCapitalize="none"
        value={emailAddress}
        placeholder="Berkeley Email"
        placeholderTextColor="#aaa"
        onChangeText={setEmailAddress}
        style={inputStyle}
        keyboardType="email-address"
      />
      <TextInput
        autoCapitalize="none"
        value={username}
        placeholder="Username"
        placeholderTextColor="#aaa"
        onChangeText={setUsername}
        style={inputStyle}
      />
      <TextInput
        autoCapitalize="words"
        value={firstName}
        placeholder="First Name"
        placeholderTextColor="#aaa"
        onChangeText={setFirstName}
        style={inputStyle}
      />
      <TextInput
        autoCapitalize="words"
        value={lastName}
        placeholder="Last Name"
        placeholderTextColor="#aaa"
        onChangeText={setLastName}
        style={inputStyle}
      />
      <TextInput
        value={password}
        placeholder="Password"
        placeholderTextColor="#aaa"
        secureTextEntry
        onChangeText={setPassword}
        style={inputStyle}
      />

      <TouchableOpacity
        onPress={onSignUpPress}
        disabled={!isFormValid()}
        style={{
          backgroundColor: "#007AFF",
          padding: 15,
          borderRadius: 6,
          opacity: isFormValid() ? 1 : 0.5,
          marginTop: 10,
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
          marginTop: 20,
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white" }}>Already have an account?</Text>
        <Link href="/(auth)/Login" style={{ marginLeft: 5 }}>
          <Text style={{ color: "#0af" }}>Sign in</Text>
        </Link>
      </View>

      {showVerification && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#222",
              borderRadius: 10,
              padding: 20,
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 15,
                textAlign: "center",
              }}
            >
              Verify Your Email
            </Text>

            <Text
              style={{
                color: "#ccc",
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              We sent a verification code to {emailAddress}
            </Text>

            <TextInput
              autoFocus
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="Enter verification code"
              placeholderTextColor="#888"
              style={{
                backgroundColor: "#333",
                color: "white",
                padding: 15,
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 16,
                textAlign: "center",
              }}
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity
              onPress={onVerifyPress}
              style={{
                backgroundColor: "#007AFF",
                padding: 15,
                borderRadius: 8,
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: "white",
                  textAlign: "center",
                  fontWeight: "bold",
                  fontSize: 16,
                }}
              >
                Verify
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowVerification(false)}
              style={{
                padding: 10,
              }}
            >
              <Text
                style={{
                  color: "#0af",
                  textAlign: "center",
                  fontSize: 14,
                }}
              >
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: "#222",
  color: "white",
  padding: 12,
  borderRadius: 6,
  marginBottom: 12,
};
