import TOSOverlay from "@/components/TOSOverlay";
import { ACCENT } from "@/constants/Colors";
import { db } from "@/services/firebaseConfig";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, Stack, useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import * as filter from "leo-profanity";
import React from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import "react-native-get-random-values";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Optional: Add app-specific blocked words
filter.add(["yourappspecificslur", "berkeleyhateword"]);

const isBerkeleyEmail = (email: string) => {
  return email.toLowerCase().endsWith("@berkeley.edu");
};

// ─────────────────────────────────────────────
//  DESIGN TOKENS (Imported/Copied from Login)
// ─────────────────────────────────────────────
const palette = {
  bg: "#121212",
  surface: "#1e1e1e",
  rim: "#252525",
  accent: ACCENT,
  ink: "#ffffff",
  muted: "#a1a1a6",
  ghost: "#545456",
};

const SPACING = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
};

const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
};

// Global Scale Factor (90%)
const SCALE = 0.9;

// ─────────────────────────────────────────────
//  PRIMITIVES
// ─────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  return <Text style={p.label}>{children}</Text>;
}

const StyledInput = React.forwardRef<
  TextInput,
  TextInputProps & { isPassword?: boolean }
>(({ isPassword = false, ...props }, ref) => {
  const [focused, setFocused] = React.useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);

  return (
    <View style={[p.inputContainer, focused && p.inputFocused]}>
      <TextInput
        ref={ref}
        placeholderTextColor={palette.ghost}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        secureTextEntry={isPassword && !isPasswordVisible}
        style={[p.input, props.style]}
        {...props}
      />
      {isPassword && (
        <TouchableOpacity
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          style={p.visibilityToggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
            size={22 * SCALE}
            color={palette.muted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
});

StyledInput.displayName = "StyledInput";

// Explicitly importing MaterialCommunityIcons for StyledInput
import { MaterialCommunityIcons } from "@expo/vector-icons";

const FormField = React.forwardRef<
  TextInput,
  TextInputProps & { label: string; isPassword?: boolean }
>(({ label, isPassword, ...rest }, ref) => {
  return (
    <View style={p.fieldWrap}>
      <FieldLabel>{label}</FieldLabel>
      <StyledInput ref={ref} isPassword={isPassword} {...rest} />
    </View>
  );
});

FormField.displayName = "FormField";

const p = StyleSheet.create({
  label: {
    color: palette.muted,
    fontSize: 16 * SCALE,
    fontWeight: "600",
    marginBottom: 8 * SCALE,
    marginLeft: 2 * SCALE,
  },
  inputContainer: {
    backgroundColor: palette.surface,
    borderRadius: BORDER_RADIUS.md,
    height: 60 * SCALE,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 16 * SCALE,
  },
  inputFocused: {
    borderColor: palette.accent,
  },
  input: {
    color: palette.ink,
    fontSize: 18 * SCALE,
    flex: 1,
    height: "100%",
  },
  fieldWrap: {
    marginBottom: SPACING.md * SCALE,
  },
  visibilityToggle: {
    paddingLeft: 10 * SCALE,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────

const BLANK_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

type Gender = "M" | "F" | "NB";
type GenderOption = Gender | "PNTS";

export default function Signup() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");

  const [genderOption, setGenderOption] = React.useState<GenderOption | null>(
    null,
  );

  const [error, setError] = React.useState("");
  const [showVerification, setShowVerification] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState("");
  const [signUpAttempt, setSignUpAttempt] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [verifyError, setVerifyError] = React.useState("");
  const [resending, setResending] = React.useState(false);
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const passwordRef = React.useRef<TextInput>(null);
  const confirmPasswordRef = React.useRef<TextInput>(null);

  const [tosAccepted, setTosAccepted] = React.useState(false);
  const [showTOS, setShowTOS] = React.useState(false);

  const containsProfanity = (text: string): boolean => {
    return filter.check(text);
  };

  const cleanText = (text: string): string => {
    return filter.clean(text);
  };

  const onSignUpPress = async () => {
    if (!isLoaded || loading) return;
    setError("");
    setLoading(true);

    if (!tosAccepted) {
      setError("Please accept the Terms of Service to continue.");
      setLoading(false);
      return;
    }

    const trimmedEmail = emailAddress.trim();
    const trimmedUsername = username.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (
      !trimmedEmail ||
      !trimmedUsername ||
      !trimmedFirstName ||
      !trimmedLastName ||
      !password
    ) {
      setError("Please fill out all fields.");
      setLoading(false);
      return;
    }

    if (!isBerkeleyEmail(trimmedEmail)) {
      setError("Please use a valid @berkeley.edu email.");
      setLoading(false);
      return;
    }

    if (
      containsProfanity(trimmedUsername) ||
      containsProfanity(trimmedFirstName) ||
      containsProfanity(trimmedLastName)
    ) {
      setError("Inappropriate language detected.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError(
        "Password must be 8+ chars, 1 uppercase, 1 lowercase, 1 number, and 1 special character.",
      );
      setLoading(false);
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
      setError(err?.errors?.[0]?.message || "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  const onVerifyPress = async () => {
    if (!verificationCode) {
      setVerifyError("Enter verification code.");
      return;
    }
    if (!signUpAttempt) {
      setVerifyError("Something went wrong.");
      return;
    }

    setVerifying(true);
    setVerifyError("");

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
          gender: genderValue,
          createdAt: new Date(),
          ridesJoined: 0,
          ridesHosted: 0,
          tosAcceptedAt: new Date(),
          tosVersion: "2025-11-15",
        });

        router.replace("/");
      } else {
        setVerifyError("Verification failed.");
      }
    } catch (err) {
      setVerifyError("Invalid code.");
    } finally {
      setVerifying(false);
    }
  };

  const onResendPress = async () => {
    if (!signUpAttempt || resending) return;
    setResending(true);
    setVerifyError("");
    try {
      await signUpAttempt.prepareEmailAddressVerification({
        strategy: "email_code",
      });
      setVerifyError("Code resent.");
    } catch (err) {
      setVerifyError("Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  const openTOS = (event: GestureResponderEvent) => {
    event.stopPropagation?.();
    setShowTOS(true);
  };

  return (
    <>
    <Stack.Screen options={{ gestureEnabled: !loading && !verifying }} />
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.root}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[s.mainContainer, { paddingTop: insets.top }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={palette.ink} />
          </TouchableOpacity>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.header}>
              <Text style={s.brandTitle}>Create Account</Text>
            </View>

            {error ? (
              <View style={s.errorContainer}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={s.formArea}>
              <FormField
                label="Berkeley Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={emailAddress}
                placeholder="you@berkeley.edu"
                onChangeText={setEmailAddress}
              />

              <FormField
                label="Username"
                autoCapitalize="none"
                value={username}
                placeholder="Choose a username"
                onChangeText={setUsername}
              />

              <View style={s.nameRow}>
                <View style={s.nameField}>
                  <FormField
                    label="First Name"
                    autoCapitalize="words"
                    value={firstName}
                    placeholder="First"
                    onChangeText={setFirstName}
                  />
                </View>
                <View style={s.nameField}>
                  <FormField
                    label="Last Name"
                    autoCapitalize="words"
                    value={lastName}
                    placeholder="Last"
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              {/* Gender Section */}
              <View style={s.fieldWrap}>
                <Text style={p.label}>Gender (optional)</Text>
                <View style={s.genderRow}>
                  {(["M", "F", "NB"] as GenderOption[]).map((option) => {
                    const isSelected = genderOption === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setGenderOption(option)}
                        activeOpacity={0.7}
                        style={[
                          s.genderButton,
                          isSelected && s.genderButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            s.genderText,
                            isSelected && s.genderTextSelected,
                          ]}
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
                <TouchableOpacity
                  onPress={() => setGenderOption("PNTS")}
                  activeOpacity={0.7}
                  style={[
                    s.genderButton,
                    s.genderOptionFull,
                    genderOption === "PNTS" && s.genderButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      s.genderText,
                      genderOption === "PNTS" && s.genderTextSelected,
                    ]}
                  >
                    Prefer not to say
                  </Text>
                </TouchableOpacity>
              </View>

              <FormField
                label="Password"
                ref={passwordRef}
                isPassword
                value={password}
                placeholder="••••••••"
                onChangeText={setPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />

              <FormField
                label="Confirm Password"
                ref={confirmPasswordRef}
                isPassword
                value={confirmPassword}
                placeholder="••••••••"
                onChangeText={setConfirmPassword}
                returnKeyType="done"
                onSubmitEditing={onSignUpPress}
              />

              {/* TOS Checkbox */}
              <TouchableOpacity
                onPress={() => setTosAccepted(!tosAccepted)}
                activeOpacity={0.7}
                style={s.tosContainer}
              >
                <View style={[s.checkbox, tosAccepted && s.checkboxChecked]}>
                  {tosAccepted && <Text style={s.checkboxText}>✓</Text>}
                </View>
                <Text style={s.tosText}>
                  I agree to the{" "}
                  <Text style={s.tosLink} onPress={openTOS}>
                    Terms of Service
                  </Text>
                  .
                </Text>
              </TouchableOpacity>

              {/* CTA Button */}
              <TouchableOpacity
                onPress={onSignUpPress}
                activeOpacity={0.7}
                disabled={!tosAccepted || loading}
                style={[s.cta, (!tosAccepted || loading) && s.ctaDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color={palette.bg} size="small" />
                ) : (
                  <Text style={s.ctaLabel}>Continue</Text>
                )}
              </TouchableOpacity>

              {/* Login link */}
              <View style={s.footer}>
                <Text style={s.footerText}>Already have an account?</Text>
                <Link href="/(auth)/Login" asChild>
                  <TouchableOpacity>
                    <Text style={s.linkText}>Sign in</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* --- TOS Overlay --- */}
      <TOSOverlay
        visible={showTOS}
        onClose={() => setShowTOS(false)}
        onAccept={() => {
          setTosAccepted(true);
          setShowTOS(false);
        }}
      />

      {/* --- Verification Modal --- */}
      <Modal visible={showVerification} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Verify Email</Text>
            <Text style={s.modalSubtitle}>
              Enter code sent to {emailAddress}
            </Text>
            <TextInput
              autoFocus
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="123456"
              style={s.modalInput}
              keyboardType="number-pad"
              maxLength={6}
            />
            {verifyError ? (
              <Text style={s.modalError}>{verifyError}</Text>
            ) : null}
            <TouchableOpacity onPress={onVerifyPress} style={s.cta}>
              <Text style={s.ctaLabel}>Verify</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onResendPress} style={s.resendButton}>
              <Text style={s.resendText}>Resend Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </>
  );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: SPACING.md * SCALE,
    alignSelf: "flex-start",
  },
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md * SCALE,
    paddingBottom: SPACING.lg * SCALE,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginTop: SPACING.xl * SCALE,
    marginBottom: SPACING.md * SCALE,
  },
  brandTitle: {
    color: palette.ink,
    fontSize: 32 * SCALE,
    fontWeight: "800",
  },
  errorContainer: {
    backgroundColor: "#2a0e0e",
    padding: SPACING.sm * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md * SCALE,
    borderWidth: 1,
    borderColor: "#4a1e1e",
  },
  errorText: {
    color: "#ff7d7d",
    textAlign: "center",
  },
  formArea: {
    width: "100%",
  },
  nameRow: {
    flexDirection: "row",
    gap: SPACING.sm * SCALE,
  },
  nameField: {
    flex: 1,
  },
  fieldWrap: {
    marginBottom: SPACING.md * SCALE,
  },
  genderRow: {
    flexDirection: "row",
    gap: SPACING.xs * SCALE,
    marginBottom: SPACING.xs * SCALE,
  },
  genderButton: {
    flex: 1,
    paddingVertical: SPACING.sm * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: palette.rim,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50 * SCALE,
  },
  genderButtonSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  genderText: {
    color: palette.muted,
    fontSize: 14 * SCALE,
    fontWeight: "500",
  },
  genderTextSelected: {
    color: palette.bg,
    fontWeight: "600",
  },
  genderOptionFull: {
    marginTop: 0,
  },
  tosContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.lg * SCALE,
  },
  checkbox: {
    width: 24 * SCALE,
    height: 24 * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 2,
    borderColor: palette.ghost,
    marginRight: SPACING.sm * SCALE,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  checkboxText: {
    color: palette.bg,
    fontSize: 16 * SCALE,
    fontWeight: "800",
  },
  tosText: {
    color: palette.muted,
    fontSize: 14 * SCALE,
    flex: 1,
  },
  tosLink: {
    color: palette.accent,
    textDecorationLine: "underline",
  },
  cta: {
    backgroundColor: palette.accent,
    height: 60 * SCALE,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md * SCALE,
  },
  ctaDisabled: {
    opacity: 0.5,
    backgroundColor: palette.surface,
    borderColor: palette.rim,
  },
  ctaLabel: {
    color: palette.bg,
    fontSize: 18 * SCALE,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: SPACING.md * SCALE,
  },
  footerText: {
    color: palette.muted,
    fontSize: 16 * SCALE,
    marginRight: SPACING.xs * SCALE,
  },
  linkText: {
    color: palette.accent,
    fontWeight: "600",
    fontSize: 16 * SCALE,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: SPACING.md * SCALE,
  },
  modalContent: {
    backgroundColor: palette.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg * SCALE,
    borderWidth: 1,
    borderColor: palette.rim,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 24 * SCALE,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: SPACING.sm * SCALE,
  },
  modalSubtitle: {
    color: palette.muted,
    textAlign: "center",
    marginBottom: SPACING.lg * SCALE,
  },
  modalInput: {
    backgroundColor: palette.bg,
    color: palette.ink,
    padding: SPACING.md * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    fontSize: 18 * SCALE,
    textAlign: "center",
    marginBottom: SPACING.sm * SCALE,
    borderWidth: 1,
    borderColor: palette.rim,
  },
  modalError: {
    color: "#ff7d7d",
    textAlign: "center",
    marginBottom: SPACING.sm * SCALE,
  },
  resendButton: {
    padding: SPACING.sm * SCALE,
  },
  resendText: {
    color: palette.accent,
    textAlign: "center",
  },
});
