import { ACCENT } from "@/constants/Colors";
import { auth } from "@/services/firebaseConfig";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { reload, sendEmailVerification } from "firebase/auth";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
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
//  SCREEN
// ─────────────────────────────────────────────

export default function VerifyEmail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [checking, setChecking] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleCheckVerified = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Session expired. Please sign in again.");
      return;
    }
    setChecking(true);
    setError("");
    try {
      await reload(currentUser);
      if (auth.currentUser?.emailVerified) {
        router.replace("/(auth)/Welcome");
      } else {
        setError("Email not verified yet. Check your inbox and click the link.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to check verification. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Session expired. Please sign in again.");
      return;
    }
    setResending(true);
    setError("");
    try {
      await sendEmailVerification(currentUser);
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch (err: any) {
      const code = err?.code;
      if (code === "auth/too-many-requests") {
        setError("Too many requests. Please wait a moment before resending.");
      } else {
        setError(err?.message || "Failed to resend. Please try again.");
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.centerContent}>
          <View style={s.iconWrap}>
            <MaterialCommunityIcons name="email-check-outline" size={64} color={palette.accent} />
          </View>

          <View style={s.header}>
            <Text style={s.title}>Check Your Email</Text>
            <Text style={s.subtitle}>
              We sent a verification link to{"\n"}
              <Text style={s.emailHighlight}>{email ?? "your email"}</Text>
            </Text>
            <Text style={s.hint}>
              Click the link in the email, then tap the button below.{"\n"}
              Can't find it? Check your spam folder.
            </Text>
          </View>

          {error ? (
            <View style={s.errorContainer}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {resent ? (
            <View style={s.successContainer}>
              <Text style={s.successText}>Verification email resent!</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleCheckVerified}
            activeOpacity={0.7}
            disabled={checking}
            style={[s.cta, checking && s.ctaDisabled]}
          >
            {checking ? (
              <ActivityIndicator color={palette.bg} size="small" />
            ) : (
              <Text style={s.ctaLabel}>I've Verified My Email</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResend}
            activeOpacity={0.7}
            disabled={resending}
            style={s.resendButton}
          >
            {resending ? (
              <ActivityIndicator color={palette.accent} size="small" />
            ) : (
              <Text style={s.resendText}>Resend verification email</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/(auth)/Login")}
            style={s.footerButton}
            activeOpacity={0.7}
          >
            <Text style={s.footerText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    paddingHorizontal: SPACING.md * SCALE,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconWrap: {
    marginBottom: SPACING.md * SCALE,
  },
  header: {
    alignItems: "center",
    marginBottom: SPACING.xl * SCALE,
  },
  title: {
    color: palette.ink,
    fontSize: 42 * SCALE,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: SPACING.xs * SCALE,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 18 * SCALE,
    marginTop: 6 * SCALE,
    textAlign: "center",
    lineHeight: 26,
  },
  emailHighlight: {
    color: palette.ink,
    fontWeight: "600",
  },
  hint: {
    color: palette.ghost,
    fontSize: 15 * SCALE,
    marginTop: SPACING.sm * SCALE,
    textAlign: "center",
    lineHeight: 22,
  },
  errorContainer: {
    backgroundColor: "#2a0e0e",
    padding: SPACING.sm * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md * SCALE,
    borderWidth: 1,
    borderColor: "#4a1e1e",
    width: "100%",
  },
  errorText: { color: "#ff7d7d", textAlign: "center" },
  successContainer: {
    backgroundColor: "#0e2a1a",
    padding: SPACING.sm * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md * SCALE,
    borderWidth: 1,
    borderColor: "#1a4a2e",
    width: "100%",
  },
  successText: { color: "#4caf50", textAlign: "center" },
  cta: {
    backgroundColor: palette.accent,
    height: 60 * SCALE,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md * SCALE,
    width: "100%",
  },
  ctaDisabled: { opacity: 0.7 },
  ctaLabel: { color: palette.bg, fontSize: 20 * SCALE, fontWeight: "700" },
  resendButton: {
    paddingVertical: SPACING.xs * SCALE,
    marginBottom: SPACING.md * SCALE,
  },
  resendText: { color: palette.accent, fontSize: 16 * SCALE, fontWeight: "500" },
  footerButton: {
    paddingVertical: SPACING.xs * SCALE,
  },
  footerText: { color: palette.muted, fontSize: 15 * SCALE },
});
