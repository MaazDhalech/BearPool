import { darkTheme } from "@/constants/theme";
import TOSOverlay from "@/components/TOSOverlay";
import { ACCENT } from "@/constants/Colors";
import { auth, db } from "@/services/firebaseConfig";
import { initialsAvatarUrl } from "@/utils/avatar";
import { Ionicons } from "@expo/vector-icons";
import { Link, Stack, useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import * as filter from "leo-profanity";
import React from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import "react-native-get-random-values";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const isBerkeleyEmail = (email: string) =>
  email.toLowerCase().endsWith("@berkeley.edu");

// ─────────────────────────────────────────────
//  DESIGN TOKENS (same as Login)
// ─────────────────────────────────────────────
const palette = {
  bg: darkTheme.bg,
  surface: darkTheme.surface,
  rim: darkTheme.surfaceAlt,
  accent: ACCENT,
  ink: darkTheme.textPrimary,
  muted: darkTheme.textSecondary,
  ghost: darkTheme.textGhost,
};

const SPACING = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48 };
const BORDER_RADIUS = { sm: 8, md: 12, lg: 16 };
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
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
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
          <Ionicons
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

const FormField = React.forwardRef<
  TextInput,
  TextInputProps & { label: string; isPassword?: boolean }
>(({ label, isPassword, ...rest }, ref) => (
  <View style={p.fieldWrap}>
    <FieldLabel>{label}</FieldLabel>
    <StyledInput ref={ref} isPassword={isPassword} {...rest} />
  </View>
));

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
  inputFocused: { borderColor: palette.accent },
  input: { color: palette.ink, fontSize: 18 * SCALE, flex: 1, height: "100%" },
  fieldWrap: { marginBottom: SPACING.md * SCALE },
  visibilityToggle: {
    paddingLeft: 10 * SCALE,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────

type Gender = "M" | "F" | "NB";
type GenderOption = Gender | "PNTS";

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [genderOption, setGenderOption] = React.useState<GenderOption | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [tosAccepted, setTosAccepted] = React.useState(false);
  const [showTOS, setShowTOS] = React.useState(false);

  const passwordRef = React.useRef<TextInput>(null);
  const confirmPasswordRef = React.useRef<TextInput>(null);

  const containsProfanity = (text: string) => filter.check(text);
  const cleanText = (text: string) => filter.clean(text);

  const onSignUpPress = async () => {
    if (loading) return;
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

    if (!trimmedEmail || !trimmedUsername || !trimmedFirstName || !trimmedLastName || !password) {
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

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError("Password must be 8+ chars, 1 uppercase, 1 lowercase, 1 number, and 1 special character.");
      setLoading(false);
      return;
    }

    try {
      const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, password);

      const genderValue: Gender | null =
        genderOption === null || genderOption === "PNTS" ? null : genderOption;

      // Write the Firestore profile FIRST. If it fails, roll back by deleting
      // the just-created Auth user so we never strand an orphan account (an Auth
      // user with no profile doc, which breaks the app and shows up as "broken").
      try {
        await setDoc(doc(db, "users", user.uid), {
          avatar: initialsAvatarUrl(trimmedFirstName, trimmedLastName),
          username: cleanText(trimmedUsername),
          email: trimmedEmail.toLowerCase(),
          first_name: cleanText(trimmedFirstName),
          last_name: cleanText(trimmedLastName),
          gender: genderValue,
          createdAt: new Date(),
          ridesJoined: 0,
          ridesHosted: 0,
          tosAcceptedAt: new Date(),
          tosVersion: "2025-11-15",
        });
      } catch (writeErr) {
        try {
          await deleteUser(user);
        } catch {
          // Best-effort cleanup; nothing more we can do client-side.
        }
        throw writeErr;
      }

      // Profile is safely written. Email verification is best-effort — the
      // VerifyEmail screen can resend if this fails.
      try {
        await sendEmailVerification(user);
      } catch {
        // ignore — do not block signup on a transient email-send failure
      }

      // Route to email verification screen
      router.replace({
        pathname: "/(auth)/VerifyEmail" as any,
        params: { email: trimmedEmail },
      });
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Try signing in.");
      } else if (code === "auth/invalid-email") {
        setError("Invalid email address.");
      } else if (code === "auth/weak-password") {
        setError("Password is too weak. Use at least 8 characters.");
      } else {
        setError(err?.message || "Signup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const openTOS = (event: GestureResponderEvent) => {
    event.stopPropagation?.();
    setShowTOS(true);
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !loading }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
        style={s.root}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[s.mainContainer, { paddingTop: insets.top }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={s.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={28} color={palette.ink} />
            </TouchableOpacity>
            <ScrollView
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.header}>
                <Image
                  source={require("../../assets/images/icon.png")}
                  resizeMode="contain"
                  style={{ ...s.logo, marginTop: 25 * SCALE, borderRadius: 20 * SCALE }}
                />
                <Text style={s.brandTitle}>BearPool</Text>
                <Text style={s.subtitle}>The biggest ride-share board for Cal students.</Text>
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
                  autoCorrect={false}
                  value={username}
                  placeholder="Choose a username"
                  onChangeText={(t) => setUsername(t.replace(/\s/g, ""))}
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
                          onPress={() => setGenderOption(isSelected ? null : option)}
                          activeOpacity={0.7}
                          style={[s.genderButton, isSelected && s.genderButtonSelected]}
                        >
                          <Text style={[s.genderText, isSelected && s.genderTextSelected]}>
                            {option === "M" ? "Male" : option === "F" ? "Female" : "Non-binary"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    onPress={() => setGenderOption(genderOption === "PNTS" ? null : "PNTS")}
                    activeOpacity={0.7}
                    style={[
                      s.genderButton,
                      s.genderOptionFull,
                      genderOption === "PNTS" && s.genderButtonSelected,
                    ]}
                  >
                    <Text style={[s.genderText, genderOption === "PNTS" && s.genderTextSelected]}>
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

                {password.length > 0 && (
                  <View style={s.passwordRules}>
                    {[
                      { label: "At least 8 characters", met: password.length >= 8 },
                      { label: "One uppercase letter", met: /[A-Z]/.test(password) },
                      { label: "One lowercase letter", met: /[a-z]/.test(password) },
                      { label: "One number", met: /\d/.test(password) },
                      { label: "One special character (!@#$%^&*)", met: /[!@#$%^&*]/.test(password) },
                    ].map(({ label, met }) => (
                      <View key={label} style={s.ruleRow}>
                        <Ionicons
                          name={met ? "checkmark-circle" : "ellipse-outline"}
                          size={14 * SCALE}
                          color={met ? darkTheme.success : palette.ghost}
                        />
                        <Text style={[s.ruleText, met && s.ruleMet]}>{label}</Text>
                      </View>
                    ))}
                  </View>
                )}

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

                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <Text style={s.passwordMismatch}>Passwords do not match.</Text>
                )}

                {/* TOS Checkbox */}
                <TouchableOpacity
                  onPress={() => setTosAccepted(!tosAccepted)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityLabel="I agree to the Terms of Service"
                  accessibilityState={{ checked: tosAccepted }}
                  style={s.tosContainer}
                >
                  <View style={[s.checkbox, tosAccepted && s.checkboxChecked]}>
                    {tosAccepted && (
                      <Ionicons name="checkmark" size={16 * SCALE} color={palette.bg} />
                    )}
                  </View>
                  <Text style={s.tosText}>
                    I agree to the{" "}
                    <Text style={s.tosLink} onPress={openTOS}>
                      Terms of Service
                    </Text>
                    .
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onSignUpPress}
                  activeOpacity={0.7}
                  disabled={!tosAccepted || loading}
                  style={[s.cta, (!tosAccepted || loading) && s.ctaDisabled]}
                >
                  {loading ? (
                    <ActivityIndicator color={palette.bg} size="small" />
                  ) : (
                    <Text style={s.ctaLabel}>Create Account</Text>
                  )}
                </TouchableOpacity>

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

        {/* TOS Overlay */}
        <TOSOverlay
          visible={showTOS}
          onClose={() => setShowTOS(false)}
          onAccept={() => { setTosAccepted(true); setShowTOS(false); }}
        />

        {/* Loading overlay */}
        {loading && (
          <View style={s.loadingOverlay}>
            <View style={s.loadingCard}>
              <ActivityIndicator color={palette.accent} size="large" />
              <Text style={s.loadingText}>Creating your account…</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  backButton: { paddingVertical: 8, paddingHorizontal: SPACING.md * SCALE, alignSelf: "flex-start" },
  mainContainer: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.md * SCALE,
    paddingBottom: SPACING.lg * SCALE,
    flexGrow: 1,
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: SPACING.lg * SCALE },
  logo: { width: 90 * SCALE, height: 90 * SCALE, marginBottom: SPACING.sm * SCALE },
  brandTitle: { color: palette.ink, fontSize: 42 * SCALE, fontWeight: "800" },
  subtitle: { color: palette.muted, fontSize: 20 * SCALE, marginTop: 6 * SCALE },
  errorContainer: {
    backgroundColor: darkTheme.errorBg,
    padding: SPACING.sm * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md * SCALE,
    borderWidth: 1,
    borderColor: darkTheme.errorBorder,
  },
  errorText: { color: darkTheme.errorText, textAlign: "center" },
  formArea: { width: "100%" },
  nameRow: { flexDirection: "row", gap: SPACING.sm * SCALE },
  nameField: { flex: 1 },
  fieldWrap: { marginBottom: SPACING.md * SCALE },
  genderRow: { flexDirection: "row", gap: SPACING.xs * SCALE, marginBottom: SPACING.xs * SCALE },
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
  genderButtonSelected: { borderColor: palette.accent, backgroundColor: "#2e2610" },
  genderText: { color: palette.muted, fontSize: 14 * SCALE, fontWeight: "500" },
  genderTextSelected: { color: palette.accent, fontWeight: "600" },
  genderOptionFull: { marginTop: 0 },
  tosContainer: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg * SCALE },
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
  checkboxChecked: { backgroundColor: palette.accent, borderColor: palette.accent },
  checkboxText: { color: palette.bg, fontSize: 16 * SCALE, fontWeight: "800" },
  tosText: { color: palette.muted, fontSize: 14 * SCALE, flex: 1 },
  tosLink: { color: palette.accent, textDecorationLine: "underline" },
  cta: {
    backgroundColor: palette.accent,
    height: 60 * SCALE,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md * SCALE,
  },
  ctaDisabled: { opacity: 0.5, backgroundColor: palette.surface, borderColor: palette.rim },
  ctaLabel: { color: palette.bg, fontSize: 18 * SCALE, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", marginBottom: SPACING.md * SCALE },
  footerText: { color: palette.muted, fontSize: 16 * SCALE, marginRight: SPACING.xs * SCALE },
  linkText: { color: palette.accent, fontWeight: "600", fontSize: 16 * SCALE },
  passwordRules: {
    marginTop: -SPACING.sm * SCALE,
    marginBottom: SPACING.md * SCALE,
    paddingHorizontal: 2 * SCALE,
  },
  ruleRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 * SCALE },
  ruleText: { color: palette.ghost, fontSize: 13 * SCALE, marginLeft: 6 * SCALE },
  ruleMet: { color: darkTheme.success },
  passwordMismatch: {
    color: darkTheme.errorText,
    fontSize: 13 * SCALE,
    marginTop: -SPACING.sm * SCALE,
    marginBottom: SPACING.md * SCALE,
    marginLeft: 2 * SCALE,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18,18,18,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99,
  },
  loadingCard: {
    backgroundColor: palette.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg * SCALE,
    paddingHorizontal: SPACING.xl * SCALE,
    alignItems: "center",
    gap: SPACING.sm * SCALE,
    borderWidth: 1,
    borderColor: palette.rim,
  },
  loadingText: {
    color: palette.muted,
    fontSize: 15 * SCALE,
    marginTop: 4 * SCALE,
  },
});
