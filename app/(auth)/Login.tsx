// ─────────────────────────────────────────────
//  Login.tsx  ·  Bearpool Redesign (Floating Layout)
//  UI: Minimalist, floating elements on dark bg
// ─────────────────────────────────────────────

import { ACCENT } from "@/constants/Colors";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, Stack, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
// Import Icons from Expo
import { MaterialCommunityIcons } from "@expo/vector-icons";

// ─────────────────────────────────────────────
//  DESIGN TOKENS (Colors Kept)
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

// ─────────────────────────────────────────────
//  DESIGN TOKENS (Spacing & Metrics)
// ─────────────────────────────────────────────
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
  // State to manage password visibility
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
        // Toggle secureTextEntry based on visibility state
        secureTextEntry={isPassword && !isPasswordVisible}
        style={[p.input, props.style]}
        {...props}
      />
      {/* Visibility toggle button - icon color is static muted */}
      {isPassword && (
        <TouchableOpacity
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          style={p.visibilityToggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
            // Scaled icon size
            size={22 * SCALE}
            color={palette.muted} // Static color
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
    // Scaled font size
    fontSize: 16 * SCALE,
    fontWeight: "600",
    marginBottom: 8 * SCALE,
    marginLeft: 2 * SCALE,
  },
  inputContainer: {
    backgroundColor: palette.surface,
    borderRadius: BORDER_RADIUS.md,
    // Scaled height
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
    // Scaled font size
    fontSize: 18 * SCALE,
    flex: 1,
    height: "100%",
  },
  fieldWrap: {
    marginBottom: SPACING.md * SCALE,
  },
  // Styles for the visibility toggle
  visibilityToggle: {
    paddingLeft: 10 * SCALE,
    justifyContent: "center",
    alignItems: "center",
  },
});

// ─────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────

export default function Login() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const passwordRef = React.useRef<TextInput>(null);

  const onSignInPress = async () => {
    if (!isLoaded) return;
    setLoading(true);
    try {
      const signInAttempt = await signIn.create({ identifier, password });
      if (signInAttempt.status === "complete") {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace("/");
      } else {
        Alert.alert("Error", "Login did not complete.");
      }
    } catch (err: any) {
      let errorMessage = "Something went wrong. Please try again.";
      if (err.errors && err.errors.length > 0) {
        errorMessage = err.errors[0].message;
      }
      Alert.alert("Login Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openWebsite = () => {
    Linking.openURL("https://bearpool.net");
  };

  return (
    <>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={s.root}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[s.mainContainer, { paddingTop: insets.top }]}>
          {/* ── Header Area ── */}
          <View style={s.header}>
            <Image
              source={require("../../assets/images/newicon.png")}
              resizeMode="contain"
              // Scaled logo
              style={{
                ...s.logo,
                marginTop: 25 * SCALE,
                borderRadius: 20 * SCALE,
              }}
            />
            <Text style={s.brandTitle}>BearPool</Text>
            <Text style={s.subtitle}>The biggest ride-share board for Cal students.</Text>
          </View>

          {/* ── Form Area ── */}
          <View style={s.formArea}>
            <FormField
              label="Email or username"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              value={identifier}
              placeholder="johndoe@berkeley.edu"
              onChangeText={setIdentifier}
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />

            <FormField
              label="Password"
              ref={passwordRef}
              value={password}
              placeholder="••••••••"
              isPassword
              returnKeyType="done"
              onChangeText={setPassword}
              onSubmitEditing={onSignInPress}
            />

            <TouchableOpacity
              onPress={() => router.push("/(auth)/Reset")}
              style={s.forgotButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onSignInPress}
              activeOpacity={0.7}
              disabled={loading}
              style={[s.cta, loading && s.ctaDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={palette.bg} size="small" />
              ) : (
                <Text style={s.ctaLabel}>Sign in</Text>
              )}
            </TouchableOpacity>

            {/* ── Footer ── */}
            <View style={s.footer}>
              <Text style={s.footerText}>New here?</Text>
              <Link href="/(auth)/Signup" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={s.signupText}>Create account</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          {/* ── Legal ── */}
          <View style={s.legal}>
            <TouchableOpacity
              onPress={() => router.push("/(stack)/settings/terms-of-service")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.legalLink}>Terms</Text>
            </TouchableOpacity>
            <View style={s.dot} />
            <TouchableOpacity
              onPress={() => router.push("/(stack)/settings/privacy-policy")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.legalLink}>Privacy</Text>
            </TouchableOpacity>
            <View style={s.dot} />
            <TouchableOpacity
              onPress={openWebsite}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={s.legalLink}>bearpool.net</Text>
            </TouchableOpacity>
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
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md * SCALE,
    paddingBottom: SPACING.md * SCALE,
    paddingTop: SPACING.xl * 1.5 * SCALE,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: SPACING.xl * SCALE,
  },
  logo: {
    // Scaled logo dimensions
    width: 90 * SCALE,
    height: 90 * SCALE,
    marginBottom: SPACING.sm * SCALE,
  },
  brandTitle: {
    color: palette.ink,
    // Scaled font size
    fontSize: 42 * SCALE,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.muted,
    // Scaled font size
    fontSize: 20 * SCALE,
    marginTop: 6 * SCALE,
  },
  formArea: {
    width: "100%",
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: SPACING.lg * SCALE,
    marginTop: -8 * SCALE,
  },
  forgotText: {
    color: palette.accent,
    // Scaled font size
    fontSize: 16 * SCALE,
    fontWeight: "500",
  },
  cta: {
    backgroundColor: palette.accent,
    // Scaled height
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
    color: palette.bg, // Dark text for contrast on gold
    // Scaled font size
    fontSize: 20 * SCALE,
    fontWeight: "700",
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: SPACING.lg * SCALE,
  },
  footerText: {
    color: palette.muted,
    // Scaled font size
    fontSize: 18 * SCALE,
    marginRight: 6 * SCALE,
  },
  signupText: {
    color: palette.ink,
    fontWeight: "700",
    // Scaled font size
    fontSize: 18 * SCALE,
  },
  legal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.6,
    marginTop: "auto",
    paddingTop: SPACING.md * SCALE,
    paddingBottom: SPACING.sm * SCALE,
  },
  dot: {
    // Scaled dimensions
    width: 5 * SCALE,
    height: 5 * SCALE,
    borderRadius: 2.5 * SCALE,
    backgroundColor: palette.muted,
    marginHorizontal: SPACING.xs * SCALE,
  },
  legalLink: {
    color: palette.muted,
    // Scaled font size
    fontSize: 14 * SCALE,
  },
});
