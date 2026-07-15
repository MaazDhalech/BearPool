import TOSOverlay from "@/components/TOSOverlay";
import { ACCENT } from "@/constants/Colors";
import { darkTheme } from "@/constants/theme";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/services/firebaseConfig";
import { initialsAvatarUrl } from "@/utils/avatar";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import * as filter from "leo-profanity";
import React from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
//  CONSTANTS
// ─────────────────────────────────────────────

type Gender = "M" | "F" | "NB";
type GenderOption = Gender | "PNTS";

// ─────────────────────────────────────────────
//  SCREEN
// ─────────────────────────────────────────────

export default function CompleteProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { user: currentUser, userId } = useFirebaseAuth();

  // Pre-fill name from social provider if available
  const [displayFirst, displayLast] = React.useMemo(() => {
    const parts = (currentUser?.displayName ?? "").trim().split(" ");
    return [parts[0] ?? "", parts.slice(1).join(" ")];
  }, [currentUser?.displayName]);

  const [username, setUsername] = React.useState("");
  const [firstName, setFirstName] = React.useState(displayFirst);
  const [lastName, setLastName] = React.useState(displayLast);
  const [genderOption, setGenderOption] = React.useState<GenderOption | null>(null);
  const [tosAccepted, setTosAccepted] = React.useState(false);
  const [showTOS, setShowTOS] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const containsProfanity = (text: string) => filter.check(text);
  const cleanText = (text: string) => filter.clean(text);

  const onSubmit = async () => {
    if (loading) return;
    setError("");

    if (!tosAccepted) {
      setError("Please accept the Terms of Service to continue.");
      return;
    }

    const trimmedUsername = username.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedUsername || !trimmedFirstName || !trimmedLastName) {
      setError("Please fill out all fields.");
      return;
    }

    if (
      containsProfanity(trimmedUsername) ||
      containsProfanity(trimmedFirstName) ||
      containsProfanity(trimmedLastName)
    ) {
      setError("Inappropriate language detected.");
      return;
    }

    if (!userId || !currentUser) {
      setError("Session expired. Please sign in again.");
      return;
    }

    setLoading(true);
    try {
      const genderValue: Gender | null =
        genderOption === null || genderOption === "PNTS" ? null : genderOption;

      await setDoc(doc(db, "users", userId), {
        avatar: currentUser.photoURL || initialsAvatarUrl(trimmedFirstName, trimmedLastName),
        username: cleanText(trimmedUsername),
        email: currentUser.email?.toLowerCase() ?? "",
        first_name: cleanText(trimmedFirstName),
        last_name: cleanText(trimmedLastName),
        gender: genderValue,
        createdAt: new Date(),
        ridesJoined: 0,
        ridesHosted: 0,
        tosAcceptedAt: new Date(),
        tosVersion: "2025-11-15",
      });

      router.replace("/(auth)/Welcome");
    } catch (err: any) {
      setError(err?.message || "Failed to save profile. Please try again.");
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
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.root}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[s.mainContainer, { paddingTop: insets.top }]}>
            <ScrollView
              contentContainerStyle={s.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.header}>
                <Text style={s.brandTitle}>Complete Profile</Text>
                <Text style={s.subtitle}>Just a few more details to get started</Text>
              </View>

              {error ? (
                <View style={s.errorContainer}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}

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

              {/* TOS Checkbox */}
              <TouchableOpacity
                onPress={() => setTosAccepted(!tosAccepted)}
                activeOpacity={0.7}
                style={s.tosContainer}
              >
                <View style={[s.checkbox, tosAccepted && s.checkboxChecked]}>
                  {tosAccepted && (
                    <Ionicons name="checkmark" size={14} color={palette.bg} />
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
                onPress={onSubmit}
                activeOpacity={0.7}
                disabled={!tosAccepted || loading}
                style={[s.cta, (!tosAccepted || loading) && s.ctaDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color={palette.bg} size="small" />
                ) : (
                  <Text style={s.ctaLabel}>Get Started</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>

        <TOSOverlay
          visible={showTOS}
          onClose={() => setShowTOS(false)}
          onAccept={() => { setTosAccepted(true); setShowTOS(false); }}
        />
      </KeyboardAvoidingView>
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
    paddingBottom: SPACING.lg * SCALE,
    paddingTop: SPACING.lg * SCALE,
  },
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
  },
  errorContainer: {
    backgroundColor: darkTheme.errorBg,
    padding: SPACING.sm * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md * SCALE,
    borderWidth: 1,
    borderColor: darkTheme.errorBorder,
  },
  errorText: { color: darkTheme.errorText, textAlign: "center" },
  nameRow: {
    flexDirection: "row",
    gap: SPACING.sm * SCALE,
  },
  nameField: { flex: 1 },
  fieldWrap: { marginBottom: SPACING.md * SCALE },
  genderRow: {
    flexDirection: "row",
    gap: SPACING.xs * SCALE,
    marginBottom: SPACING.xs * SCALE,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 10 * SCALE,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: palette.rim,
    backgroundColor: palette.surface,
    alignItems: "center",
  },
  genderOptionFull: { flex: 0, paddingHorizontal: SPACING.sm * SCALE },
  genderButtonSelected: { borderColor: palette.accent, backgroundColor: "#1a2a3a" },
  genderText: { color: palette.muted, fontSize: 14 * SCALE, fontWeight: "500" },
  genderTextSelected: { color: palette.accent, fontWeight: "600" },
  tosContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md * SCALE,
    gap: SPACING.xs * SCALE,
  },
  checkbox: {
    width: 22 * SCALE,
    height: 22 * SCALE,
    borderRadius: 4 * SCALE,
    borderWidth: 1.5,
    borderColor: palette.ghost,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: palette.accent, borderColor: palette.accent },
  tosText: { color: palette.muted, fontSize: 14 * SCALE, flex: 1 },
  tosLink: { color: palette.accent, fontWeight: "600" },
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
});
