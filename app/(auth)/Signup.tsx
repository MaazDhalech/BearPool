import { db } from "@/services/firebaseConfig";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import "react-native-get-random-values";

const isBerkeleyEmail = (email: string) => {
  return email.toLowerCase().endsWith("@berkeley.edu");
};

const BLANK_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

type Gender = "M" | "F" | "NB";

export default function Signup() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [gender, setGender] = React.useState<Gender | null>(null);
  const [error, setError] = React.useState("");
  const [showVerification, setShowVerification] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState("");
  const [signUpAttempt, setSignUpAttempt] = React.useState<any>(null);

  const isFormValid = () =>
    isBerkeleyEmail(emailAddress) &&
    username.trim().length > 0 &&
    password.length > 0 &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    gender !== null;

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    setError("");

    if (gender === null) {
      setError("Please select your gender");
      return;
    }

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

        const clerkId = completeSignUp.createdUserId;
        await setDoc(doc(db, "users", clerkId), {
          clerkId,
          avatar: BLANK_AVATAR,
          username: username.trim(),
          email: emailAddress.toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          gender: gender, // Storing the selected gender
          pref: "N", // Default preference
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#121212" }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 20
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              color: "#ffffff",
              fontSize: 28,
              fontWeight: "600",
              marginBottom: 30,
              textAlign: "center",
            }}
          >
            Create Account
          </Text>

          {error ? (
            <View
              style={{
                backgroundColor: "#2a0e0e",
                padding: 14,
                borderRadius: 8,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: "#4a1e1e",
              }}
            >
              <Text style={{ color: "#ff7d7d", textAlign: "center" }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Berkeley Email
            </Text>
            <TextInput
              autoCapitalize="none"
              value={emailAddress}
              placeholder="you@berkeley.edu"
              placeholderTextColor="#666"
              onChangeText={setEmailAddress}
              style={inputStyle}
              keyboardType="email-address"
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Username
            </Text>
            <TextInput
              autoCapitalize="none"
              value={username}
              placeholder="Choose a username"
              placeholderTextColor="#666"
              onChangeText={setUsername}
              style={inputStyle}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
                First Name
              </Text>
              <TextInput
                autoCapitalize="words"
                value={firstName}
                placeholder="First"
                placeholderTextColor="#666"
                onChangeText={setFirstName}
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
                Last Name
              </Text>
              <TextInput
                autoCapitalize="words"
                value={lastName}
                placeholder="Last"
                placeholderTextColor="#666"
                onChangeText={setLastName}
                style={inputStyle}
              />
            </View>
          </View>

<View style={{ marginBottom: 16 }}>
  <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
    Gender (Required)
  </Text>
  <View style={{ flexDirection: "row", gap: 8 }}>
    {(["M", "F", "NB"] as Gender[]).map((option) => (
      <TouchableOpacity
        key={option}
        onPress={() => setGender(option)}
        style={{
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: gender === option ? "#3a7bd5" : "#333",
          backgroundColor: gender === option ? "#1a3a7b" : "#1e1e1e",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 50,
        }}
      >
        <Text 
          style={{ 
            color: gender === option ? "#ffffff" : "#a0a0a0",
            fontSize: 14,
            fontWeight: gender === option ? "600" : "400",
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          {option === "M" ? "Male" : 
           option === "F" ? "Female" : 
           "Non-binary"}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
</View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}>
              Password
            </Text>
            <TextInput
              value={password}
              placeholder="Create a password"
              placeholderTextColor="#666"
              secureTextEntry
              onChangeText={setPassword}
              style={inputStyle}
            />
          </View>

          <TouchableOpacity
            onPress={onSignUpPress}
            disabled={!isFormValid()}
            style={{
              backgroundColor: "#3a7bd5",
              padding: 16,
              borderRadius: 8,
              opacity: isFormValid() ? 1 : 0.5,
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
              Continue
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
            <Text style={{ color: "#a0a0a0" }}>Already have an account?</Text>
            <Link href="/(auth)/Login" asChild>
              <TouchableOpacity>
                <Text style={{ color: "#3a7bd5", fontWeight: "500" }}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>

      {/* Verification Modal */}
      {showVerification && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.95)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#1e1e1e",
              borderRadius: 10,
              padding: 24,
              borderWidth: 1,
              borderColor: "#333",
            }}
          >
            <Text
              style={{
                color: "white",
                fontSize: 20,
                fontWeight: "600",
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Verify Your Email
            </Text>

            <Text
              style={{
                color: "#a0a0a0",
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              We sent a verification code to{"\n"}
              <Text style={{ fontWeight: "500" }}>{emailAddress}</Text>
            </Text>

            <TextInput
              autoFocus
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="Enter 6-digit code"
              placeholderTextColor="#666"
              style={{
                backgroundColor: "#2a2a2a",
                color: "white",
                padding: 16,
                borderRadius: 8,
                marginBottom: 24,
                fontSize: 18,
                textAlign: "center",
                borderWidth: 1,
                borderColor: "#333",
              }}
              keyboardType="number-pad"
              maxLength={6}
            />

            <TouchableOpacity
              onPress={onVerifyPress}
              style={{
                backgroundColor: "#3a7bd5",
                padding: 16,
                borderRadius: 8,
                marginBottom: 16,
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
                Verify Email
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowVerification(false)}
              style={{
                padding: 12,
              }}
            >
              <Text
                style={{
                  color: "#3a7bd5",
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
  backgroundColor: "#1e1e1e",
  color: "#ffffff",
  padding: 14,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "#333",
  fontSize: 16,
};