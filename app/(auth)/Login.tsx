import { darkTheme } from "@/constants/theme";
// ─────────────────────────────────────────────
//  Login.tsx  ·  Firebase Auth
// ─────────────────────────────────────────────

import { ACCENT } from "@/constants/Colors";
import { auth, db } from "@/services/firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { Link, Stack, useRouter } from "expo-router";
import {
  GoogleAuthProvider,
  OAuthProvider,
  deleteUser,
  linkWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSheet, type AppSheetRef } from "@/components/ui/AppSheet";

// ─────────────────────────────────────────────
//  DESIGN TOKENS
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

// Configure Google Sign-In (called once at module level)
GoogleSignin.configure({
  webClientId: Constants.expoConfig?.extra?.googleWebClientId ?? "",
  iosClientId: Constants.expoConfig?.extra?.googleIosClientId ?? "",
  scopes: ["email", "profile"],
});

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
//  HELPERS
// ─────────────────────────────────────────────

const isBerkeleyEmail = (email: string) =>
  email.toLowerCase().endsWith("@berkeley.edu");

// ─────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [bugEmail, setBugEmail] = React.useState("");
  const [bugDescription, setBugDescription] = React.useState("");
  const [bugSubmitting, setBugSubmitting] = React.useState(false);

  const passwordRef = React.useRef<TextInput>(null);
  const bugSheetRef = React.useRef<AppSheetRef>(null);

  // ── Bug report submit ──
  const onSubmitBugReport = async () => {
    if (!bugEmail.trim() || !bugDescription.trim()) {
      Alert.alert("Missing Info", "Please enter your email and describe the issue.");
      return;
    }
    setBugSubmitting(true);
    try {
      const web3formsApiKey = Constants.expoConfig?.extra?.web3formsApiKey;
      if (web3formsApiKey) {
        const formData = new FormData();
        formData.append("access_key", web3formsApiKey);
        formData.append("name", bugEmail);
        formData.append("email", bugEmail);
        formData.append("subject", "BearPool Login Bug Report");
        formData.append("message", bugDescription);
        formData.append("from_name", "BearPool Bug Report (Pre-login)");
        formData.append("replyto", bugEmail);
        await fetch("https://api.web3forms.com/submit", { method: "POST", body: formData });
      }
      await addDoc(collection(db, "bugReports"), {
        email: bugEmail.trim(),
        description: bugDescription.trim(),
        source: "login-screen",
        createdAt: serverTimestamp(),
      });
      Alert.alert("Report Sent", "Thanks, we'll look into it shortly.", [
        { text: "OK", onPress: () => { bugSheetRef.current?.dismiss(); setBugEmail(""); setBugDescription(""); } },
      ]);
    } catch (err) {
      console.error("Bug report failed:", err);
      Alert.alert("Error", "Could not send your report. Please try again.");
    } finally {
      setBugSubmitting(false);
    }
  };

  // ── Email/password sign-in ──
  const onSignInPress = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/");
    } catch (err: any) {
      const code = err?.code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        Alert.alert(
          "Sign In Failed",
          "Incorrect email or password. If you're an existing user, you may need to reset your password.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Reset Password", onPress: () => router.push("/(auth)/Reset") },
          ],
        );
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait or reset your password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Google Sign-In ──
  const onGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();
      if (!idToken) throw new Error("No ID token from Google");

      // Enforce @berkeley.edu restriction
      const googleUser = await GoogleSignin.getCurrentUser();
      const googleEmail = googleUser?.user?.email ?? "";
      if (!isBerkeleyEmail(googleEmail)) {
        await GoogleSignin.signOut();
        setError("Only @berkeley.edu Google accounts are allowed.");
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);

      const userDoc = await getDoc(doc(db, "users", result.user.uid));
      if (!userDoc.exists()) {
        router.replace("/(auth)/CompleteProfile" as any);
      } else {
        router.replace("/");
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled - no error shown
      } else if (err.code === statusCodes.IN_PROGRESS) {
        // already in progress - ignore
      } else if (err.code === "auth/account-exists-with-different-credential") {
        // User already has an email/password account - offer to link Google to it
        const pendingCredential = GoogleAuthProvider.credentialFromError(err);
        Alert.alert(
          "Account Already Exists",
          "You already have an account with this email. Enter your password to link Google Sign-In to your account.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Link Account",
              onPress: () => {
                Alert.prompt(
                  "Enter Password",
                  "Your current BearPool password:",
                  async (password) => {
                    if (!password) return;
                    try {
                      const emailUser = await GoogleSignin.getCurrentUser();
                      const email = emailUser?.user?.email ?? "";
                      const userCred = await signInWithEmailAndPassword(auth, email, password);
                      if (pendingCredential) {
                        await linkWithCredential(userCred.user, pendingCredential);
                      }
                      router.replace("/");
                    } catch (linkErr: any) {
                      setError(linkErr?.message || "Failed to link accounts.");
                    }
                  },
                  "secure-text"
                );
              },
            },
          ]
        );
      } else {
        setError("Google sign-in failed. Please try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Apple Sign-In (iOS only) ──
  const onAppleSignIn = async () => {
    setError("");
    setAppleLoading(true);
    try {
      const nonce = Math.random().toString(36).substring(2, 18);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) throw new Error("No identity token from Apple");

      const provider = new OAuthProvider("apple.com");
      const firebaseCredential = provider.credential({
        idToken: credential.identityToken,
        rawNonce: nonce,
      });

      const result = await signInWithCredential(auth, firebaseCredential);

      // Enforce @berkeley.edu - delete the created account and reject if not berkeley
      const appleEmail = result.user.email;
      if (!appleEmail || !isBerkeleyEmail(appleEmail)) {
        await deleteUser(result.user);
        setError("Only @berkeley.edu Apple accounts are allowed.");
        return;
      }

      const userDoc = await getDoc(doc(db, "users", result.user.uid));
      if (!userDoc.exists()) {
        router.replace("/(auth)/CompleteProfile" as any);
      } else {
        router.replace("/");
      }
    } catch (err: any) {
      if (err.code === "ERR_REQUEST_CANCELED") {
        // user cancelled
      } else {
        setError("Apple sign-in failed. Please try again.");
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const openWebsite = () => Linking.openURL("https://bearpool.net");
  const isAnyLoading = loading || googleLoading || appleLoading;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
        style={s.root}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[s.mainContainer, { paddingTop: insets.top }]}>
            <ScrollView
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            {/* ── Header ── */}
            <View style={s.header}>
              <Image
                source={require("../../assets/images/newicon.png")}
                resizeMode="contain"
                style={{ ...s.logo, marginTop: 25 * SCALE, borderRadius: 20 * SCALE }}
              />
              <Text style={s.brandTitle}>BearPool</Text>
              <Text style={s.subtitle}>The biggest ride-share board for Cal students.</Text>
            </View>

            {/* ── Social Sign-In ── */}
            <View style={s.socialRow}>
              <TouchableOpacity
                onPress={onGoogleSignIn}
                disabled={isAnyLoading}
                style={s.googleBtn}
                activeOpacity={0.8}
              >
                {googleLoading ? (
                  <ActivityIndicator size="small" color={darkTheme.border} />
                ) : (
                  <>
                    <Text style={s.googleIcon}>G</Text>
                    <Text style={s.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {Platform.OS === "ios" && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={BORDER_RADIUS.md}
                  style={s.appleBtn}
                  onPress={() => { if (!appleLoading) onAppleSignIn(); }}
                />
              )}
            </View>

            {/* ── Divider ── */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>or sign in with email</Text>
              <View style={s.dividerLine} />
            </View>

            {/* ── Form ── */}
            <View style={s.formArea}>
              {error ? (
                <View style={s.errorContainer}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}

              <FormField
                label="Email"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                value={email}
                placeholder="johndoe@berkeley.edu"
                onChangeText={setEmail}
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />

              {email.includes("@") && !isBerkeleyEmail(email.trim()) ? (
                <Text style={s.inlineHint}>Use your @berkeley.edu email.</Text>
              ) : null}

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
                disabled={isAnyLoading || !email || !password}
                style={[s.cta, (isAnyLoading || !email || !password) && s.ctaDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color={palette.bg} size="small" />
                ) : (
                  <Text style={s.ctaLabel}>Sign in</Text>
                )}
              </TouchableOpacity>

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
              <View style={s.dot} />
              <TouchableOpacity
                onPress={() => bugSheetRef.current?.present()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={s.legalLink}>Report a bug</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* ── Bug Report Sheet ── */}
      <AppSheet ref={bugSheetRef} detents={["auto"]} dismissible={!bugSubmitting}>
        <View style={s.sheetContent}>
          <Text style={s.modalTitle}>Report a Bug</Text>
          <Text style={s.modalSubtitle}>
            Having trouble logging in? Let us know and we&apos;ll fix it.
          </Text>

          <Text style={s.modalLabel}>Your email</Text>
          <TextInput
            style={s.modalInput}
            placeholder="johndoe@berkeley.edu"
            placeholderTextColor={palette.ghost}
            value={bugEmail}
            onChangeText={setBugEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!bugSubmitting}
          />

          <Text style={s.modalLabel}>What&apos;s happening?</Text>
          <TextInput
            style={[s.modalInput, s.modalTextarea]}
            placeholder="Describe the issue..."
            placeholderTextColor={palette.ghost}
            value={bugDescription}
            onChangeText={setBugDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            editable={!bugSubmitting}
          />

          <TouchableOpacity
            onPress={onSubmitBugReport}
            activeOpacity={0.8}
            disabled={bugSubmitting}
            style={[s.modalSubmit, bugSubmitting && { opacity: 0.7 }]}
          >
            {bugSubmitting ? (
              <ActivityIndicator color={palette.bg} size="small" />
            ) : (
              <Text style={s.modalSubmitText}>Submit Report</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { if (!bugSubmitting) { bugSheetRef.current?.dismiss(); setBugEmail(""); setBugDescription(""); } }}
            activeOpacity={0.7}
            style={s.modalCancel}
          >
            <Text style={s.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </AppSheet>
    </>
  );
}

// ─────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  mainContainer: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.md * SCALE,
    paddingTop: SPACING.xl * SCALE,
    paddingBottom: SPACING.lg * SCALE,
  },
  header: { alignItems: "center", marginBottom: SPACING.lg * SCALE },
  logo: { width: 90 * SCALE, height: 90 * SCALE, marginBottom: SPACING.sm * SCALE },
  brandTitle: { color: palette.ink, fontSize: 42 * SCALE, fontWeight: "800" },
  subtitle: { color: palette.muted, fontSize: 20 * SCALE, marginTop: 6 * SCALE },
  socialRow: { gap: 12 * SCALE, marginBottom: SPACING.md * SCALE },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: darkTheme.textPrimary,
    borderRadius: BORDER_RADIUS.md,
    height: 54 * SCALE,
    gap: 10 * SCALE,
  },
  googleIcon: { fontSize: 18 * SCALE, fontWeight: "700", color: "#4285F4" },
  googleBtnText: { color: darkTheme.border, fontSize: 16 * SCALE, fontWeight: "600" },
  appleBtn: { height: 54 * SCALE, width: "100%" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md * SCALE,
    gap: 10 * SCALE,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: darkTheme.border },
  dividerText: { color: palette.ghost, fontSize: 13 * SCALE },
  formArea: { width: "100%" },
  errorContainer: {
    backgroundColor: darkTheme.errorBg,
    padding: SPACING.sm * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md * SCALE,
    borderWidth: 1,
    borderColor: darkTheme.errorBorder,
  },
  errorText: { color: darkTheme.errorText, textAlign: "center" },
  inlineHint: {
    color: darkTheme.errorText,
    fontSize: 13 * SCALE,
    marginTop: -SPACING.sm * SCALE,
    marginBottom: SPACING.sm * SCALE,
    marginLeft: 2 * SCALE,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: SPACING.lg * SCALE,
    marginTop: -8 * SCALE,
  },
  forgotText: { color: palette.accent, fontSize: 16 * SCALE, fontWeight: "500" },
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
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: SPACING.lg * SCALE,
  },
  footerText: { color: palette.muted, fontSize: 18 * SCALE, marginRight: 6 * SCALE },
  signupText: { color: palette.ink, fontWeight: "700", fontSize: 18 * SCALE },
  legal: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.6,
    marginTop: SPACING.lg * SCALE,
    paddingBottom: SPACING.sm * SCALE,
  },
  dot: {
    width: 5 * SCALE,
    height: 5 * SCALE,
    borderRadius: 2.5 * SCALE,
    backgroundColor: palette.muted,
    marginHorizontal: SPACING.xs * SCALE,
  },
  legalLink: { color: palette.muted, fontSize: 14 * SCALE },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modalSheet: {
    backgroundColor: darkTheme.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.md,
    paddingBottom: SPACING.lg + SPACING.md,
  },
  sheetContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg + SPACING.md,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 20 * SCALE,
    fontWeight: "700",
    marginBottom: 6 * SCALE,
  },
  modalSubtitle: {
    color: palette.muted,
    fontSize: 14 * SCALE,
    marginBottom: SPACING.md * SCALE,
    lineHeight: 20 * SCALE,
  },
  modalLabel: {
    color: palette.muted,
    fontSize: 13 * SCALE,
    fontWeight: "600",
    marginBottom: 6 * SCALE,
  },
  modalInput: {
    backgroundColor: darkTheme.raised,
    borderRadius: BORDER_RADIUS.sm,
    color: palette.ink,
    fontSize: 15 * SCALE,
    paddingHorizontal: 14 * SCALE,
    paddingVertical: 12 * SCALE,
    borderWidth: 1,
    borderColor: darkTheme.border,
    marginBottom: SPACING.sm * SCALE,
  },
  modalTextarea: {
    height: 110 * SCALE,
    textAlignVertical: "top",
  },
  modalSubmit: {
    backgroundColor: palette.accent,
    height: 52 * SCALE,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs * SCALE,
    marginBottom: SPACING.sm * SCALE,
  },
  modalSubmitText: {
    color: palette.bg,
    fontSize: 16 * SCALE,
    fontWeight: "700",
  },
  modalCancel: {
    alignItems: "center",
    paddingVertical: SPACING.xs * SCALE,
  },
  modalCancelText: {
    color: palette.muted,
    fontSize: 15 * SCALE,
  },
});
