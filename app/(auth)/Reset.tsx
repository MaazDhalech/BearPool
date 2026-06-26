import { ACCENT } from "@/constants/Colors";
import { auth } from "@/services/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import React from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─────────────────────────────────────────────
//  DESIGN TOKENS
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

const SPACING = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48 };
const BORDER_RADIUS = { sm: 8, md: 12, lg: 16 };
const SCALE = 0.9;

// ─────────────────────────────────────────────
//  PRIMITIVES
// ─────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  return <Text style={p.label}>{children}</Text>;
}

const StyledInput = React.forwardRef<TextInput, TextInputProps>(
  (props, ref) => {
    const [focused, setFocused] = React.useState(false);
    return (
      <View style={[p.inputContainer, focused && p.inputFocused]}>
        <TextInput
          ref={ref}
          placeholderTextColor={palette.ghost}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[p.input, props.style]}
          {...props}
        />
      </View>
    );
  },
);

StyledInput.displayName = "StyledInput";

const FormField = React.forwardRef<
  TextInput,
  TextInputProps & { label: string }
>(({ label, ...rest }, ref) => (
  <View style={p.fieldWrap}>
    <FieldLabel>{label}</FieldLabel>
    <StyledInput ref={ref} {...rest} />
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
});

// ─────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────

export default function ResetPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSendReset = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        // Don't reveal whether email exists - show generic success
        setSent(true);
      } else if (code === "auth/too-many-requests") {
        setError("Too many requests. Please try again later.");
      } else {
        setError(err?.message || "Failed to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !loading }} />
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

            <View style={s.centerContent}>
              <View style={s.header}>
                <Text style={s.brandTitle}>Reset Password</Text>
                <Text style={s.subtitle}>
                  {sent
                    ? `Check your inbox at ${email}`
                    : "Enter your Berkeley email to receive a reset link"}
                </Text>
              </View>

              <View style={s.formArea}>
                {error ? (
                  <View style={s.errorContainer}>
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                ) : null}

                {sent ? (
                  <View style={s.successContainer}>
                    <Text style={s.successText}>
                      Password reset email sent! Click the link in your email to set a new password.{"\n\n"}
                      Can't find it? Check your spam folder.
                    </Text>
                  </View>
                ) : (
                  <>
                    <FormField
                      label="Email Address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      value={email}
                      placeholder="johndoe@berkeley.edu"
                      onChangeText={setEmail}
                      onSubmitEditing={handleSendReset}
                    />

                    <TouchableOpacity
                      onPress={handleSendReset}
                      activeOpacity={0.7}
                      disabled={loading || !email}
                      style={[s.cta, (loading || !email) && s.ctaDisabled]}
                    >
                      {loading ? (
                        <ActivityIndicator color={palette.bg} size="small" />
                      ) : (
                        <Text style={s.ctaLabel}>Send Reset Link</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                <TouchableOpacity
                  onPress={() => router.replace("/(auth)/Login")}
                  style={s.footerButton}
                  activeOpacity={0.7}
                >
                  <Text style={s.footerText}>Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  mainContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md * SCALE,
    paddingBottom: SPACING.md * SCALE,
  },
  backButton: { paddingVertical: 8, paddingHorizontal: 4, alignSelf: "flex-start" },
  centerContent: { flex: 1, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: SPACING.xl * SCALE },
  brandTitle: {
    color: palette.ink,
    fontSize: 42 * SCALE,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 18 * SCALE,
    marginTop: 6 * SCALE,
    textAlign: "center",
    lineHeight: 24,
  },
  formArea: { width: "100%" },
  errorContainer: {
    backgroundColor: "#2a0e0e",
    padding: SPACING.sm * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md * SCALE,
    borderWidth: 1,
    borderColor: "#4a1e1e",
  },
  errorText: { color: "#ff7d7d", textAlign: "center" },
  successContainer: {
    backgroundColor: "#0e2a1a",
    padding: SPACING.md * SCALE,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg * SCALE,
    borderWidth: 1,
    borderColor: "#1a4a2e",
  },
  successText: { color: "#4caf50", textAlign: "center", lineHeight: 22, fontSize: 15 * SCALE },
  cta: {
    backgroundColor: palette.accent,
    height: 60 * SCALE,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg * SCALE,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaLabel: { color: palette.bg, fontSize: 20 * SCALE, fontWeight: "700" },
  footerButton: { alignItems: "center", marginTop: -SPACING.sm * SCALE, marginBottom: SPACING.lg * SCALE },
  footerText: { color: palette.accent, fontSize: 16 * SCALE, fontWeight: "500" },
});
