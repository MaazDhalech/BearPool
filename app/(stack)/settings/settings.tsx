import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { db, auth } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { NavHeader } from "@/components/ui/NavHeader";
import { toast } from "@/components/ui/Dialog";
import { deleteUser, EmailAuthProvider, GoogleAuthProvider, OAuthProvider, reauthenticateWithCredential, signOut as firebaseSignOut } from "firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  Box,
  HStack,
  ScrollView,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { useRouter } from "expo-router";
import {
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View as RNView,
} from "react-native";

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  color?: string;
  badge?: string;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  color = "white",
  badge,
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={{
      backgroundColor: darkTheme.surface,
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: darkTheme.border,
    }}
  >
    <HStack space="md" alignItems="center">
      <Box bg={darkTheme.raised} p="$3" borderRadius="$md">
        <Ionicons name={icon} size={24} color={color} />
      </Box>
      <VStack flex={1}>
        <HStack justifyContent="space-between" alignItems="center">
          <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="$semibold">
            {title}
          </Text>
          {badge && (
            <Box bg={darkTheme.danger} px="$2" py="$1" borderRadius="$full">
              <Text color={darkTheme.textPrimary} fontSize="$xs" fontWeight="$bold">
                {badge}
              </Text>
            </Box>
          )}
        </HStack>
        {subtitle && (
          <Text color={darkTheme.textSecondary} fontSize="$sm" mt="$1">
            {subtitle}
          </Text>
        )}
      </VStack>
      <Ionicons name="chevron-forward" size={20} color={darkTheme.textSecondary} />
    </HStack>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const { userId, isLoaded } = useFirebaseAuth();
  const router = useRouter();
  const currentProvider = auth.currentUser?.providerData[0]?.providerId ?? "password";

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);

  // Fetch user data
  useEffect(() => {
    if (!userId) return;

    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, "users", userId);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setProfileData({
            ...userData,
            blockedUsers: userData.blockedUsers || [],
          });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // Delete account handler
  const handleDeleteAccount = () => {
    if (!userId) return;

    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Final Confirmation",
              "This will permanently delete your account and all associated data. Are you absolutely sure?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete My Account",
                  style: "destructive",
                  onPress: () => performAccountDeletion(),
                },
              ],
              { cancelable: true }
            );
          },
        },
      ],
      { cancelable: true }
    );
  };

const cleanupUserRides = async (userId: string) => {
  const snapshot = await getDocs(
    query(collection(db, "rides"), where("memberIds", "array-contains", userId))
  );

  await Promise.all(snapshot.docs.map(async (rideDoc) => {
    const ride = rideDoc.data();
    const otherMembers = (ride.memberIds as string[]).filter((id: string) => id !== userId);

    if (ride.hostId === userId) {
      if (otherMembers.length > 0) {
        // Promote first remaining member to host
        await updateDoc(rideDoc.ref, {
          hostId: otherMembers[0],
          memberIds: arrayRemove(userId),
        });
      } else {
        // No other members - delete the ride entirely
        await deleteDoc(rideDoc.ref);
      }
    } else {
      // Regular member - remove and free up a seat
      await updateDoc(rideDoc.ref, {
        memberIds: arrayRemove(userId),
        seats: increment(1),
      });
    }
  }));
};

const performAccountDeletion = async () => {
  if (!userId) return;
  setDeletingAccount(true);

  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast("Session expired. Please sign in again.", { type: "error" });
      setDeletingAccount(false);
      return;
    }

    await cleanupUserRides(userId);
    await deleteDoc(doc(db, "users", userId));
    await deleteUser(currentUser);

    router.replace("/(auth)/Welcome");
    toast("Your account has been deleted.", { type: "info" });
  } catch (error: any) {
    if (error?.code === "auth/requires-recent-login") {
      setShowReauthModal(true);
    } else {
      toast(error.message || "Something went wrong", { type: "error" });
    }
  } finally {
    setDeletingAccount(false);
  }
};

const handleReauthAndDelete = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const providerId = currentUser.providerData[0]?.providerId;

  if (providerId === "google.com") {
    // Re-authenticate with Google
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();
      if (!idToken) throw new Error("No ID token from Google");
      const credential = GoogleAuthProvider.credential(idToken);
      await reauthenticateWithCredential(currentUser, credential);
      setShowReauthModal(false);
      await performAccountDeletion();
    } catch (error: any) {
      if (error?.code !== "SIGN_IN_CANCELLED") {
        toast(error.message || "Google re-authentication failed.", { type: "error" });
      }
    }
    return;
  }

  if (providerId === "apple.com") {
    // Re-authenticate with Apple
    try {
      const nonce = Crypto.randomUUID().replace(/-/g, "");
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({
        idToken: appleCredential.identityToken!,
        rawNonce: nonce,
      });
      await reauthenticateWithCredential(currentUser, credential);
      setShowReauthModal(false);
      await performAccountDeletion();
    } catch (error: any) {
      if (error?.code !== "ERR_REQUEST_CANCELED") {
        toast(error.message || "Apple re-authentication failed.", { type: "error" });
      }
    }
    return;
  }

  // Email/password
  if (!reauthPassword) return;
  setReauthLoading(true);
  setReauthError("");
  try {
    const credential = EmailAuthProvider.credential(currentUser.email!, reauthPassword);
    await reauthenticateWithCredential(currentUser, credential);
    setShowReauthModal(false);
    setReauthPassword("");
    await performAccountDeletion();
  } catch (error: any) {
    const code = error?.code;
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      setReauthError("Incorrect password. Please try again.");
    } else {
      setReauthError(error.message || "Re-authentication failed.");
    }
  } finally {
    setReauthLoading(false);
  }
};

  const handleGoBack = () => {
    router.back();
  };

  const handleLogout = () => {
    if (!isLoaded) return;

    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              await firebaseSignOut(auth);
              router.replace("/(auth)/Welcome");
            } catch (err) {
              console.error("Error signing out:", err);
              toast("Failed to sign out. Please try again.", { type: "error" });
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handlePrivacySettings = () => {
    router.push("/(stack)/settings/privacy-policy");
  };

  const handleHelpSupport = () => {
    router.push("/(stack)/settings/contact-support");
  };

  if (loading) {
    return (
      <Box flex={1} bg={darkTheme.bg} justifyContent="center" alignItems="center">
        <Text color={darkTheme.textSecondary}>Loading settings...</Text>
      </Box>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Box flex={1} bg={darkTheme.bg}>
        <NavHeader title="Settings" />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Box px="$4" py="$6">

            {/* Settings Items */}
            <VStack space="sm">
              <SettingsItem
                icon="person-remove-outline"
                title="Blocked Users"
                subtitle="Manage users you've blocked"
                onPress={() => router.push("/(stack)/settings/blocked-users")}
                color={darkTheme.danger}
                badge={
                  profileData?.blockedUsers?.length > 0
                    ? profileData.blockedUsers.length.toString()
                    : undefined
                }
              />

              <SettingsItem
                icon="shield-checkmark-outline"
                title="Privacy Policy"
                subtitle="View our privacy policy"
                onPress={handlePrivacySettings}
                color={darkTheme.success}
              />

              <SettingsItem
                icon="document-text-outline"
                title="Terms of Service"
                subtitle="Read our terms of service"
                onPress={() => router.push("/(stack)/settings/terms-of-service")}
                color="#2196F3"
              />

              <SettingsItem
                icon="notifications-outline"
                title="Notifications"
                subtitle="Manage your notification preferences"
                onPress={() => router.push("/(stack)/settings/notifications")}
                color="#FF9800"
              />

              <SettingsItem
                icon="help-circle-outline"
                title="Help & Support"
                subtitle="Get help or contact our support team"
                onPress={handleHelpSupport}
                color={ACCENT}
              />

              <SettingsItem
                icon="log-out-outline"
                title="Log Out"
                subtitle="Sign out of your account"
                onPress={handleLogout}
                color={darkTheme.danger}
              />

              <SettingsItem
                icon="trash-outline"
                title="Delete Account"
                subtitle="Permanently delete your account and all data"
                onPress={handleDeleteAccount}
                color={darkTheme.danger}
              />
            </VStack>

            {deletingAccount && (
              <Box mt="$4" p="$4" bg={darkTheme.raised} borderRadius="$md">
                <HStack space="sm" justifyContent="center" alignItems="center">
                  <ActivityIndicator size="small" color={ACCENT} />
                  <Text color={darkTheme.danger} textAlign="center">
                    Deleting account... Please wait.
                  </Text>
                </HStack>
              </Box>
            )}
          </Box>
        </ScrollView>

        {/* Re-auth modal for account deletion */}
        <RNModal
          visible={showReauthModal}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={() => { setShowReauthModal(false); setReauthPassword(""); setReauthError(""); }}
        >
          <TouchableWithoutFeedback onPress={() => { setShowReauthModal(false); setReauthPassword(""); setReauthError(""); }}>
            <RNView style={styles.reauthBackdrop} />
          </TouchableWithoutFeedback>
          <RNView style={styles.reauthCentered} pointerEvents="box-none">
          <RNView style={styles.reauthSheet}>
            <Text style={styles.reauthTitle}>Confirm Your Identity</Text>
            <Text style={styles.reauthSubtitle}>
              {currentProvider === "google.com"
                ? "Re-sign in with Google to confirm account deletion."
                : currentProvider === "apple.com"
                ? "Re-sign in with Apple to confirm account deletion."
                : "For security, re-enter your password to delete your account."}
            </Text>
            {currentProvider === "password" && (
              <TextInput
                style={styles.reauthInput}
                placeholder="Your password"
                placeholderTextColor={darkTheme.textGhost}
                secureTextEntry
                value={reauthPassword}
                onChangeText={setReauthPassword}
                autoFocus
              />
            )}
            {reauthError ? <Text style={styles.reauthError}>{reauthError}</Text> : null}
            <TouchableOpacity
              onPress={handleReauthAndDelete}
              disabled={reauthLoading || (currentProvider === "password" && !reauthPassword)}
              style={[styles.reauthBtn, (reauthLoading || (currentProvider === "password" && !reauthPassword)) && styles.reauthBtnDisabled]}
            >
              <Text style={styles.reauthBtnText}>
                {reauthLoading
                  ? "Verifying…"
                  : currentProvider === "google.com"
                  ? "Continue with Google"
                  : currentProvider === "apple.com"
                  ? "Continue with Apple"
                  : "Delete My Account"}
              </Text>
            </TouchableOpacity>
          </RNView>
          </RNView>
        </RNModal>
      </Box>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  reauthBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  reauthCentered: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
  },
  reauthSheet: {
    backgroundColor: darkTheme.surface,
    borderRadius: 20,
    marginHorizontal: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
  },
  reauthTitle: {
    color: darkTheme.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  reauthSubtitle: {
    color: darkTheme.textSecondary,
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  reauthInput: {
    backgroundColor: darkTheme.raised,
    borderRadius: 10,
    height: 50,
    paddingHorizontal: 16,
    color: darkTheme.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: darkTheme.border,
    marginBottom: 12,
  },
  reauthError: {
    color: darkTheme.errorText,
    fontSize: 13,
    marginBottom: 12,
  },
  reauthBtn: {
    backgroundColor: darkTheme.danger,
    borderRadius: 10,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  reauthBtnDisabled: {
    opacity: 0.5,
  },
  reauthBtnText: {
    color: darkTheme.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
});