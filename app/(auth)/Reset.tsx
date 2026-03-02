import { ACCENT } from "@/constants/Colors";
import { useSignIn } from "@clerk/clerk-expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
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
//  PRIMITIVES (Copied from Login.tsx)
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

export default function ResetPassword() {
  const { signIn } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState<
    "request" | "verify" | "reset"
  >("request");

  const handleRequestReset = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }
    setLoading(true);
    try {
      await signIn?.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setActiveStep("verify");
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.errors?.[0]?.message || "Failed to send reset code",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }
    setLoading(true);
    try {
      const attempt = await signIn?.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
      });

      if (attempt?.status === "needs_new_password") {
        setActiveStep("reset");
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.errors?.[0]?.message || "Invalid verification code",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword) {
      Alert.alert("Error", "Please enter a new password");
      return;
    }
    setLoading(true);
    try {
      await signIn?.resetPassword({
        password: newPassword,
      });
      Alert.alert("Success", "Password reset successfully!");
      router.replace("/(auth)/Login");
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.errors?.[0]?.message || "Failed to reset password",
      );
    } finally {
      setLoading(false);
    }
  };

  // Helper to get subtitle based on step
  const getSubtitle = () => {
    switch (activeStep) {
      case "request":
        return "Enter your email to receive a reset code";
      case "verify":
        return `Enter code sent to ${email}`;
      case "reset":
        return "Create a new password";
      default:
        return "";
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.root}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[s.mainContainer, { paddingTop: insets.top }]}>
          {/* ── Header Area (No Image) ── */}
          <View style={s.header}>
            <Text style={s.brandTitle}>Reset Password</Text>
            <Text style={s.subtitle}>{getSubtitle()}</Text>
          </View>

          {/* ── Form Area ── */}
          <View style={s.formArea}>
            {activeStep === "request" && (
              <FormField
                label="Email Address"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                placeholder="johndoe@berkeley.edu"
                onChangeText={setEmail}
                onSubmitEditing={handleRequestReset}
              />
            )}

            {activeStep === "verify" && (
              <FormField
                label="Verification Code"
                keyboardType="number-pad"
                value={code}
                placeholder="123456"
                onChangeText={setCode}
                onSubmitEditing={handleVerifyCode}
              />
            )}

            {activeStep === "reset" && (
              <FormField
                label="New Password"
                isPassword
                value={newPassword}
                placeholder="••••••••"
                onChangeText={setNewPassword}
                onSubmitEditing={handleResetPassword}
              />
            )}

            {/* CTA Button */}
            <TouchableOpacity
              onPress={
                activeStep === "request"
                  ? handleRequestReset
                  : activeStep === "verify"
                    ? handleVerifyCode
                    : handleResetPassword
              }
              activeOpacity={0.7}
              disabled={loading}
              style={[s.cta, loading && s.ctaDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={palette.bg} size="small" />
              ) : (
                <Text style={s.ctaLabel}>
                  {activeStep === "request" && "Send Reset Code"}
                  {activeStep === "verify" && "Verify Code"}
                  {activeStep === "reset" && "Reset Password"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity
              onPress={() => router.replace("/(auth)/Login")}
              style={s.footerButton}
              activeOpacity={0.7}
            >
              <Text style={s.footerText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
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
  mainContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md * SCALE,
    paddingBottom: SPACING.md * SCALE,
    // Header padding removed to allow vertical centering
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: SPACING.xl * SCALE,
  },
  brandTitle: {
    color: palette.ink,
    fontSize: 42 * SCALE,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: palette.muted,
    fontSize: 20 * SCALE,
    marginTop: 6 * SCALE,
    textAlign: "center",
  },
  formArea: {
    width: "100%",
  },
  cta: {
    backgroundColor: palette.accent,
    height: 60 * SCALE,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg * SCALE,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaLabel: {
    color: palette.bg,
    fontSize: 20 * SCALE,
    fontWeight: "700",
  },
  footerButton: {
    alignItems: "center",
    marginTop: -SPACING.sm * SCALE,
    marginBottom: SPACING.lg * SCALE,
  },
  footerText: {
    color: palette.accent,
    fontSize: 16 * SCALE,
    fontWeight: "500",
  },
});
