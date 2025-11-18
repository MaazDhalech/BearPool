import TOSOverlay from "@/components/TOSOverlay";
import { db } from "@/services/firebaseConfig";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import React from "react";
import {
  GestureResponderEvent,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import "react-native-get-random-values";

import * as filter from "leo-profanity";

// Optional: Add app-specific blocked words
filter.add(["yourappspecificslur", "berkeleyhateword"]);
// Optional: Remove false positives
// filter.remove("innocentword");

const isBerkeleyEmail = (email: string) => {
  return email.toLowerCase().endsWith("@berkeley.edu");
};

const PRIMARY_BLUE = "#3a7bd5";
const DARK_BG = "#1e1e1e";
const GREY_TEXT = "#a0a0a0";

const BLANK_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

type Gender = "M" | "F" | "NB"; // what we store in Firestore
type GenderOption = Gender | "PNTS"; // UI options, includes Prefer Not To Say

export default function Signup() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");

  // UI selection state
  const [genderOption, setGenderOption] =
    React.useState<GenderOption | null>(null);

  const [error, setError] = React.useState("");
  const [showVerification, setShowVerification] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState("");
  const [signUpAttempt, setSignUpAttempt] = React.useState<any>(null);

  // --- TOS Agreement ---
  const [tosAccepted, setTosAccepted] = React.useState(false);
  const [showTOS, setShowTOS] = React.useState(false);

  const containsProfanity = (text: string): boolean => {
    return filter.check(text);
  };

  const cleanText = (text: string): string => {
    return filter.clean(text);
  };

  const onSignUpPress = async () => {
    if (!isLoaded) return;
    setError("");

    // TOS must be accepted
    if (!tosAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }

    const trimmedEmail = emailAddress.trim();
    const trimmedUsername = username.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    // Basic required field checks
    if (
      !trimmedEmail ||
      !trimmedUsername ||
      !trimmedFirstName ||
      !trimmedLastName ||
      !password
    ) {
      setError("Please fill out all fields before continuing.");
      return;
    }

    // Berkeley email check
    if (!isBerkeleyEmail(trimmedEmail)) {
      setError("Please use a valid @berkeley.edu email to sign up.");
      return;
    }

    // Profanity checks
    if (containsProfanity(trimmedUsername)) {
      setError(
        "Username contains inappropriate language. Please choose a different one."
      );
      return;
    }

    if (containsProfanity(trimmedFirstName)) {
      setError(
        "First name contains inappropriate language. Please enter a valid name."
      );
      return;
    }

    if (containsProfanity(trimmedLastName)) {
      setError(
        "Last name contains inappropriate language. Please enter a valid name."
      );
      return;
    }

    // Password rules
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
        emailAddress: trimmedEmail,
        password,
        username: trimmedUsername,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      });

      await attempt.prepareEmailAddressVerification({
        strategy: "email_code",
      });
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

        // Map UI gender option -> stored gender value
        const genderValue: Gender | null =
          genderOption === null || genderOption === "PNTS"
            ? null
            : genderOption;

        await setDoc(doc(db, "users", clerkId), {
          clerkId,
          avatar: BLANK_AVATAR,
          username: cleanText(username.trim()),
          email: emailAddress.toLowerCase(),
          first_name: cleanText(firstName.trim()),
          last_name: cleanText(lastName.trim()),
          gender: genderValue, // stored as "M" | "F" | "NB" | null
          createdAt: new Date(),
          ridesJoined: 0,
          ridesHosted: 0,
          tosAcceptedAt: new Date(),
          tosVersion: "2025-11-15",
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

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    if (text.trim() && containsProfanity(text)) {
      setError("Username contains inappropriate language.");
    } else if (error.includes("Username contains inappropriate language")) {
      setError("");
    }
  };

  const handleFirstNameChange = (text: string) => {
    setFirstName(text);
    if (text.trim() && containsProfanity(text)) {
      setError("First name contains inappropriate language.");
    } else if (error.includes("First name contains inappropriate language")) {
      setError("");
    }
  };

  const handleLastNameChange = (text: string) => {
    setLastName(text);
    if (text.trim() && containsProfanity(text)) {
      setError("Last name contains inappropriate language.");
    } else if (error.includes("Last name contains inappropriate language")) {
      setError("");
    }
  };

  const handleTOSAccept = () => {
    setTosAccepted(true);
    setShowTOS(false);
  };

  const toggleTosAccepted = () => {
    setTosAccepted((prev) => !prev);
  };

  const openTOS = (event: GestureResponderEvent) => {
    event.stopPropagation?.();
    setShowTOS(true);
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
          padding: 20,
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
              marginTop: 50,
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
              <Text style={{ color: "#ff7d7d", textAlign: "center" }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}
            >
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

          {/* Username */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}
            >
              Username
            </Text>
            <TextInput
              autoCapitalize="none"
              value={username}
              placeholder="Choose a username"
              placeholderTextColor="#666"
              onChangeText={handleUsernameChange}
              style={inputStyle}
            />
          </View>

          {/* Name row */}
          <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}
              >
                First Name
              </Text>
              <TextInput
                autoCapitalize="words"
                value={firstName}
                placeholder="First"
                placeholderTextColor="#666"
                onChangeText={handleFirstNameChange}
                style={inputStyle}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}
              >
                Last Name
              </Text>
              <TextInput
                autoCapitalize="words"
                value={lastName}
                placeholder="Last"
                placeholderTextColor="#666"
                onChangeText={handleLastNameChange}
                style={inputStyle}
              />
            </View>
          </View>

          {/* --- Gender --- */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{ color: "#a0a0a0", marginBottom: 4, fontSize: 14 }}
            >
              Gender (optional — helps us keep riders safe)
            </Text>
            <Text style={{ color: "#666", marginBottom: 8, fontSize: 12 }}>
              Share it only if you want to. We request it for community safety
              checks and never use it anywhere else. You can ignore this today
              and add it later.
            </Text>

            {/* MAIN GENDER OPTIONS */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["M", "F", "NB"] as GenderOption[]).map((option) => {
                const isSelected = genderOption === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setGenderOption(option)}
                    activeOpacity={0.95}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isSelected ? PRIMARY_BLUE : "#333",
                      backgroundColor: isSelected ? PRIMARY_BLUE : DARK_BG,
                      opacity: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 50,
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? "#ffffff" : GREY_TEXT,
                        fontSize: 14,
                        fontWeight: isSelected ? "600" : "500",
                        textAlign: "center",
                        lineHeight: 20,
                      }}
                    >
                      {option === "M"
                        ? "Male"
                        : option === "F"
                        ? "Female"
                        : "Non-binary"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* PREFER NOT TO SAY */}
            <TouchableOpacity
              onPress={() => setGenderOption("PNTS")}
              activeOpacity={0.95}
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: genderOption === "PNTS" ? PRIMARY_BLUE : "#333",
                backgroundColor: genderOption === "PNTS" ? PRIMARY_BLUE : DARK_BG,
                opacity: 1,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: genderOption === "PNTS" ? "#ffffff" : GREY_TEXT,
                  fontSize: 14,
                  fontWeight: genderOption === "PNTS" ? "600" : "400",
                }}
              >
                Prefer not to say
              </Text>
            </TouchableOpacity>
          </View>

          {/* Password */}
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{ color: "#a0a0a0", marginBottom: 8, fontSize: 14 }}
            >
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

          {/* --- TOS Checkbox --- */}
          <View
            style={{
              marginBottom: 24,
              flexDirection: "row",
              alignItems: "flex-start",
            }}
          >
            <TouchableOpacity
              onPress={toggleTosAccepted}
              activeOpacity={1}
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: tosAccepted ? PRIMARY_BLUE : "#666",
                backgroundColor: tosAccepted
                  ? PRIMARY_BLUE
                  : "transparent",
                marginRight: 12,
                justifyContent: "center",
                alignItems: "center",
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: tosAccepted }}
            >
              {tosAccepted && (
                <Text
                  style={{
                    color: "#ffffff",
                    fontSize: 18,
                    lineHeight: 18,
                    fontWeight: "800",
                  }}
                >
                  ✓
                </Text>
              )}
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#a0a0a0",
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                I have read and agree to the{" "}
                <Text
                  style={{
                    color: PRIMARY_BLUE,
                    textDecorationLine: "underline",
                  }}
                  onPress={openTOS}
                >
                  Terms of Service
                </Text>
                .
              </Text>
            </View>
          </View>

          {/* --- Continue Button --- */}
          <TouchableOpacity
            onPress={onSignUpPress}
            disabled={!tosAccepted}
            style={{
              backgroundColor: tosAccepted ? PRIMARY_BLUE : "#1e1e1e",
              padding: 16,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: tosAccepted ? PRIMARY_BLUE : "#333",
              shadowColor: tosAccepted ? PRIMARY_BLUE : "transparent",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: tosAccepted ? 0.3 : 0,
              shadowRadius: tosAccepted ? 4 : 0,
              elevation: tosAccepted ? 3 : 0,
            }}
          >
            <Text
              style={{
                color: tosAccepted ? "white" : "#777",
                textAlign: "center",
                fontWeight: "600",
                fontSize: 16,
              }}
            >
              Continue
            </Text>
          </TouchableOpacity>

          {/* Login link */}
          <View
            style={{
              flexDirection: "row",
              marginTop: 24,
              justifyContent: "center",
              gap: 5,
            }}
          >
            <Text style={{ color: "#a0a0a0" }}>
              Already have an account?
            </Text>
            <Link href="/(auth)/Login" asChild>
              <TouchableOpacity>
                <Text
                  style={{ color: PRIMARY_BLUE, fontWeight: "500" }}
                >
                  Sign in
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>

      {/* --- TOS Overlay --- */}
      <TOSOverlay
        visible={showTOS}
        onClose={() => setShowTOS(false)}
        onAccept={handleTOSAccept}
      />

      {/* --- Verification Modal --- */}
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
              <Text style={{ fontWeight: "500" }}>
                {emailAddress}
              </Text>
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
                backgroundColor: PRIMARY_BLUE,
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
                  color: PRIMARY_BLUE,
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
