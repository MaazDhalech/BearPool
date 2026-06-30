import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { db, auth } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { NavHeader } from "@/components/ui/NavHeader";
import { Sheet } from "@/components/ui/Sheet";
import { confirm, toast } from "@/components/ui/Dialog";
import { deleteUser, EmailAuthProvider, GoogleAuthProvider, OAuthProvider, reauthenticateWithCredential, signOut as firebaseSignOut } from "firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  ButtonText,
  HStack,
  ScrollView,
  Spinner,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
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
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View as RNView,
} from "react-native";

// Default avatar image
const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";


interface BlockedUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string;
}

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
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);

  // Notification settings
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermissionStatus, setNotifPermissionStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [savingNotif, setSavingNotif] = useState(false);

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
          setNotifEnabled(userData.notifPrefs?.enabled === true);
          setNotifPermissionStatus(userData.notifPrefs?.permissionStatus || "undetermined");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  // Fetch blocked users data
  const fetchBlockedUsers = async () => {
    if (!userId || !profileData?.blockedUsers) return;

    setLoadingBlockedUsers(true);
    try {
      const blockedUserIds = profileData.blockedUsers;
      if (blockedUserIds.length === 0) {
        setBlockedUsers([]);
        return;
      }

      // Fetch blocked users data in batches (Firestore 'in' query limit is 10)
      const blockedUsersData: BlockedUser[] = [];
      const batchSize = 10;

      for (let i = 0; i < blockedUserIds.length; i += batchSize) {
        const batch = blockedUserIds.slice(i, i + batchSize);
        const q = query(
          collection(db, "users"),
          where("__name__", "in", batch)
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          blockedUsersData.push({
            id: doc.id,
            username: data.username || "Unknown",
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            avatar: data.avatar || DEFAULT_AVATAR,
          });
        });
      }

      setBlockedUsers(blockedUsersData);
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      toast("Failed to load blocked users.", { type: "error" });
    } finally {
      setLoadingBlockedUsers(false);
    }
  };

  // Unblock a user
  const handleUnblockUser = async (blockedUserId: string, username: string) => {
    if (!userId) return;

    const ok = await confirm({
      title: "Unblock User",
      message: `Are you sure you want to unblock ${username}?`,
      confirmText: "Unblock",
      destructive: true,
    });
    if (!ok) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        blockedUsers: arrayRemove(blockedUserId),
      });

      setBlockedUsers((prev) =>
        prev.filter((user) => user.id !== blockedUserId)
      );
      setProfileData((prev: any) => ({
        ...prev,
        blockedUsers:
          prev.blockedUsers?.filter((id: string) => id !== blockedUserId) ||
          [],
      }));

      toast(`${username} has been unblocked.`, { type: "success" });
    } catch (error) {
      console.error("Error unblocking user:", error);
      toast("Failed to unblock user. Please try again.", { type: "error" });
    }
  };

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (!userId) return;

    const first = await confirm({
      title: "Delete Account",
      message:
        "Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted.",
      confirmText: "Delete",
      destructive: true,
    });
    if (!first) return;

    const second = await confirm({
      title: "Final Confirmation",
      message:
        "This will permanently delete your account and all associated data. Are you absolutely sure?",
      confirmText: "Yes, Delete My Account",
      destructive: true,
    });
    if (second) performAccountDeletion();
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

    router.replace("/(auth)/Login");
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

  // Fetch blocked users when modal opens
  useEffect(() => {
    if (showBlockedUsers && profileData) {
      fetchBlockedUsers();
    }
  }, [showBlockedUsers, profileData]);

  const handleGoBack = () => {
    router.back();
  };

  const handleLogout = async () => {
    if (!isLoaded) return;

    const ok = await confirm({
      title: "Log Out",
      message: "Are you sure you want to log out?",
      confirmText: "Log Out",
      destructive: true,
    });
    if (!ok) return;

    try {
      await firebaseSignOut(auth);
      router.replace("/(auth)/Login");
    } catch (err) {
      console.error("Error signing out:", err);
      toast("Failed to sign out. Please try again.", { type: "error" });
    }
  };

  const handlePrivacySettings = () => {
    router.push("/(stack)/settings/privacy-policy");
  };

  const handleNotificationSettings = async () => {
    // Sync live permission status before showing the modal
    const { status } = await Notifications.getPermissionsAsync();
    const normalized = status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
    setNotifPermissionStatus(normalized);
    // If permission is gone (revoked in system settings), reflect that
    if (normalized !== "granted" && notifEnabled) {
      setNotifEnabled(false);
    }
    setShowNotifSettings(true);
  };

  const handleNotifToggle = async (value: boolean) => {
    if (!userId) return;
    setSavingNotif(true);

    try {
      if (value) {
        // Enabling - check/request permission
        const { status } = await Notifications.getPermissionsAsync();

        if (status === "denied") {
          // Can't request again; send user to system settings
          if (
            await confirm({
              title: "Notifications Blocked",
              message:
                "You've previously denied notifications. Please enable them in your device Settings.",
              confirmText: "Open Settings",
            })
          ) {
            Linking.openSettings();
          }
          return;
        }

        let finalStatus = status;
        if (status !== "granted") {
          const { status: newStatus } = await Notifications.requestPermissionsAsync();
          finalStatus = newStatus;
        }

        if (finalStatus !== "granted") {
          setSavingNotif(false);
          return;
        }

        // Register token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const token = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );

        const deviceKey =
          Device.osInternalBuildId ||
          Device.osBuildFingerprint ||
          Device.modelId ||
          Device.modelName ||
          "unknown-device";

        await setDoc(
          doc(db, "users", userId),
          {
            expoPushToken: token.data,
            pushTokens: { [deviceKey]: token.data },
            notifPrefs: { enabled: true, permissionStatus: "granted" },
          },
          { merge: true }
        );

        setNotifEnabled(true);
        setNotifPermissionStatus("granted");
      } else {
        // Disabling
        await setDoc(
          doc(db, "users", userId),
          { notifPrefs: { enabled: false } },
          { merge: true }
        );
        setNotifEnabled(false);
      }
    } catch (error) {
      console.error("Failed to update notification preference", error);
      toast("Failed to update notification settings.", { type: "error" });
    } finally {
      setSavingNotif(false);
    }
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
                onPress={() => setShowBlockedUsers(true)}
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
                onPress={handleNotificationSettings}
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
                  <Spinner size="small" color={ACCENT} />
                  <Text color={darkTheme.danger} textAlign="center">
                    Deleting account... Please wait.
                  </Text>
                </HStack>
              </Box>
            )}
          </Box>
        </ScrollView>

        {/* Blocked Users - bottom sheet */}
        <Sheet
          visible={showBlockedUsers}
          onClose={() => setShowBlockedUsers(false)}
          title="Blocked Users"
        >
          <RNView style={{ paddingHorizontal: 24, maxHeight: 400 }}>
            {loadingBlockedUsers ? (
              <Box py="$4" alignItems="center">
                <Text color={darkTheme.textSecondary}>Loading blocked users...</Text>
              </Box>
            ) : blockedUsers.length === 0 ? (
              <Box py="$4" alignItems="center">
                <Text color={darkTheme.textSecondary}>No blocked users</Text>
              </Box>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <VStack space="md" py="$2">
                  {blockedUsers.map((blockedUser) => (
                    <HStack
                      key={blockedUser.id}
                      space="md"
                      alignItems="center"
                      bg={darkTheme.raised}
                      p="$3"
                      borderRadius="$md"
                    >
                      <Avatar size="md" bg={darkTheme.border}>
                        {blockedUser.avatar ? (
                          <AvatarImage
                            source={{ uri: blockedUser.avatar }}
                            alt="Avatar"
                          />
                        ) : (
                          <Avatar.FallbackText color={darkTheme.textPrimary}>
                            {(blockedUser.first_name?.[0] || "") +
                              (blockedUser.last_name?.[0] || "") || "U"}
                          </Avatar.FallbackText>
                        )}
                      </Avatar>

                      <VStack flex={1}>
                        <Text color={darkTheme.textPrimary} fontWeight="$semibold">
                          {blockedUser.username}
                        </Text>
                        <Text color={darkTheme.textSecondary} fontSize="$sm">
                          {blockedUser.first_name} {blockedUser.last_name}
                        </Text>
                      </VStack>

                      <Button
                        size="sm"
                        bg={darkTheme.danger}
                        onPress={() =>
                          handleUnblockUser(blockedUser.id, blockedUser.username)
                        }
                      >
                        <ButtonText color={darkTheme.textPrimary} fontSize="$sm">
                          Unblock
                        </ButtonText>
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              </ScrollView>
            )}
          </RNView>
        </Sheet>

        {/* Notification Settings - bottom sheet */}
        <Sheet
          visible={showNotifSettings}
          onClose={() => setShowNotifSettings(false)}
          title="Notifications"
        >
          <RNView style={{ paddingHorizontal: 24 }}>
            <RNView style={styles.notifRow}>
              <RNView style={{ flex: 1, marginRight: 16 }}>
                <Text color={darkTheme.textPrimary} fontWeight="$semibold" fontSize="$md">Push Notifications</Text>
                <Text color={darkTheme.textSecondary} fontSize="$sm" mt="$1">
                  Ride updates, chat messages, member activity
                </Text>
              </RNView>
              <Switch
                value={notifEnabled}
                onValueChange={handleNotifToggle}
                disabled={savingNotif}
                trackColor={{ false: darkTheme.borderStrong, true: ACCENT }}
                thumbColor={darkTheme.textPrimary}
              />
            </RNView>

            {notifPermissionStatus === "denied" && !notifEnabled && (
              <RNView style={styles.notifWarning}>
                <Text color="#ffcc00" fontSize="$sm" mb="$3">
                  Notifications are blocked in your device settings.
                </Text>
                <Button size="sm" bg={ACCENT} onPress={() => Linking.openSettings()}>
                  <ButtonText color={darkTheme.bg}>Open Device Settings</ButtonText>
                </Button>
              </RNView>
            )}
          </RNView>
        </Sheet>

        {/* Re-auth modal for account deletion */}
        <RNModal
          visible={showReauthModal}
          transparent
          animationType="fade"
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
  notifBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  notifSheet: {
    backgroundColor: darkTheme.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  notifHandle: {
    width: 36,
    height: 4,
    backgroundColor: darkTheme.textGhost,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: darkTheme.raised,
    borderRadius: 12,
    padding: 16,
  },
  notifWarning: {
    backgroundColor: darkTheme.raised,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
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