import { ACCENT } from "@/constants/Colors";
import { db } from "@/services/firebaseConfig";
import { useAuth } from "@clerk/clerk-expo";
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  ButtonText,
  CloseIcon,
  HStack,
  Heading,
  Icon,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ScrollView,
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
import {
  Bell,
  ChevronLeft,
  FileText,
  HelpCircle,
  LogOut,
  Shield,
  Trash2,
  UserX,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal as RNModal,
  Platform,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View as RNView,
} from "react-native";

// Default avatar image
const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl;

interface BlockedUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string;
}

interface SettingsItemProps {
  icon: any;
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
    style={{
      backgroundColor: "#1e1e1e",
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#333",
    }}
  >
    <HStack space="md" alignItems="center">
      <Box bg="#2a2a2a" p="$3" borderRadius="$md">
        <Icon as={icon} size="lg" color={color} />
      </Box>
      <VStack flex={1}>
        <HStack justifyContent="space-between" alignItems="center">
          <Text color="white" fontSize="$lg" fontWeight="$semibold">
            {title}
          </Text>
          {badge && (
            <Box bg="#ff6b6b" px="$2" py="$1" borderRadius="$full">
              <Text color="white" fontSize="$xs" fontWeight="$bold">
                {badge}
              </Text>
            </Box>
          )}
        </HStack>
        {subtitle && (
          <Text color="#a0a0a0" fontSize="$sm" mt="$1">
            {subtitle}
          </Text>
        )}
      </VStack>
      <Icon
        as={ChevronLeft}
        size="md"
        color="#a0a0a0"
        style={{ transform: [{ rotate: "180deg" }] }}
      />
    </HStack>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const { userId: clerkUserId, signOut, isLoaded } = useAuth();
  const router = useRouter();

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Notification settings
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermissionStatus, setNotifPermissionStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [savingNotif, setSavingNotif] = useState(false);

  // Fetch user data
  useEffect(() => {
    if (!clerkUserId) return;

    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, "users", clerkUserId);
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
  }, [clerkUserId]);

  // Fetch blocked users data
  const fetchBlockedUsers = async () => {
    if (!clerkUserId || !profileData?.blockedUsers) return;

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
      Alert.alert("Error", "Failed to load blocked users.");
    } finally {
      setLoadingBlockedUsers(false);
    }
  };

  // Unblock a user
  const handleUnblockUser = async (userId: string, username: string) => {
    if (!clerkUserId) return;

    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock ${username}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: async () => {
            try {
              // Remove user from blockedUsers array
              await updateDoc(doc(db, "users", clerkUserId), {
                blockedUsers: arrayRemove(userId),
              });

              // Update local state
              setBlockedUsers((prev) =>
                prev.filter((user) => user.id !== userId)
              );
              setProfileData((prev: any) => ({
                ...prev,
                blockedUsers:
                  prev.blockedUsers?.filter((id: string) => id !== userId) ||
                  [],
              }));

              Alert.alert("Success", `${username} has been unblocked.`);
            } catch (error) {
              console.error("Error unblocking user:", error);
              Alert.alert("Error", "Failed to unblock user. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (!clerkUserId) return;

    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Second confirmation
            Alert.alert(
              "Final Confirmation",
              "This will permanently delete your account and all associated data. Are you absolutely sure?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete My Account",
                  style: "destructive",
                  onPress: performAccountDeletion,
                },
              ]
            );
          },
        },
      ]
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
        // No other members — delete the ride entirely
        await deleteDoc(rideDoc.ref);
      }
    } else {
      // Regular member — remove and free up a seat
      await updateDoc(rideDoc.ref, {
        memberIds: arrayRemove(userId),
        seats: increment(1),
      });
    }
  }));
};

const performAccountDeletion = async () => {
  if (!clerkUserId) return;
  setDeletingAccount(true);

  try {
    await cleanupUserRides(clerkUserId);

    const response = await fetch(`${BACKEND_URL}/api/delete-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: clerkUserId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete account");
    }

    await signOut();
    router.replace("/(auth)/Login");
    Alert.alert("Deleted", "Your account is gone forever.");
  } catch (error: any) {
    Alert.alert("Error", error.message || "Something went wrong");
  } finally {
    setDeletingAccount(false);
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

    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/(auth)/Login");
          } catch (err) {
            console.error("Error signing out:", err);
            Alert.alert("Error", "Failed to sign out. Please try again.");
          }
        },
      },
    ]);
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
    if (!clerkUserId) return;
    setSavingNotif(true);

    try {
      if (value) {
        // Enabling — check/request permission
        const { status } = await Notifications.getPermissionsAsync();

        if (status === "denied") {
          // Can't request again; send user to system settings
          Alert.alert(
            "Notifications Blocked",
            "You've previously denied notifications. Please enable them in your device Settings.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
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
          doc(db, "users", clerkUserId),
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
          doc(db, "users", clerkUserId),
          { notifPrefs: { enabled: false } },
          { merge: true }
        );
        setNotifEnabled(false);
      }
    } catch (error) {
      console.error("Failed to update notification preference", error);
      Alert.alert("Error", "Failed to update notification settings.");
    } finally {
      setSavingNotif(false);
    }
  };

  const handleHelpSupport = () => {
    router.push("/(stack)/settings/contact-support");
  };

  if (loading) {
    return (
      <Box flex={1} bg="#121212" justifyContent="center" alignItems="center">
        <Text color="#a0a0a0">Loading settings...</Text>
      </Box>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Box flex={1} bg="#121212">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Box px="$4" py="$6">
            {/* Header */}
            <HStack alignItems="center" mb="$6" mt="$8">
              <TouchableOpacity onPress={handleGoBack}>
                <Icon as={ChevronLeft} size="xl" color="white" />
              </TouchableOpacity>
              <Heading size="xl" color="white" ml="$3">
                Settings
              </Heading>
            </HStack>

            {/* Settings Items */}
            <VStack space="sm">
              <SettingsItem
                icon={UserX}
                title="Blocked Users"
                subtitle="Manage users you've blocked"
                onPress={() => setShowBlockedUsers(true)}
                color="#ff6b6b"
                badge={
                  profileData?.blockedUsers?.length > 0
                    ? profileData.blockedUsers.length.toString()
                    : undefined
                }
              />

              <SettingsItem
                icon={Shield}
                title="Privacy Policy"
                subtitle="View our privacy policy"
                onPress={handlePrivacySettings}
                color="#4CAF50"
              />

              <SettingsItem
                icon={FileText}
                title="Terms of Service"
                subtitle="Read our terms of service"
                onPress={() => router.push("/(stack)/settings/terms-of-service")}
                color="#2196F3"
              />

              <SettingsItem
                icon={Bell}
                title="Notifications"
                subtitle="Manage your notification preferences"
                onPress={handleNotificationSettings}
                color="#FF9800"
              />

              <SettingsItem
                icon={HelpCircle}
                title="Help & Support"
                subtitle="Get help or contact our support team"
                onPress={handleHelpSupport}
                color="#9C27B0"
              />

              <SettingsItem
                icon={LogOut}
                title="Log Out"
                subtitle="Sign out of your account"
                onPress={handleLogout}
                color="#ff6b6b"
              />

              <SettingsItem
                icon={Trash2}
                title="Delete Account"
                subtitle="Permanently delete your account and all data"
                onPress={handleDeleteAccount}
                color="#ff0000"
              />
            </VStack>

            {deletingAccount && (
              <Box mt="$4" p="$4" bg="#2a2a2a" borderRadius="$md">
                <Text color="#ff6b6b" textAlign="center">
                  Deleting account... Please wait.
                </Text>
              </Box>
            )}
          </Box>
        </ScrollView>

        {/* Blocked Users Modal */}
        <Modal
          isOpen={showBlockedUsers}
          onClose={() => setShowBlockedUsers(false)}
          finalFocusRef={undefined}
        >
          <ModalBackdrop />
          <ModalContent bg="#1e1e1e" maxWidth="$96" maxHeight="$3/4">
            <ModalHeader>
              <Heading size="lg" color="white">
                Blocked Users
              </Heading>
              <ModalCloseButton>
                <Icon as={CloseIcon} color="white" />
              </ModalCloseButton>
            </ModalHeader>
            <ModalBody>
              {loadingBlockedUsers ? (
                <Box py="$4" alignItems="center">
                  <Text color="#a0a0a0">Loading blocked users...</Text>
                </Box>
              ) : blockedUsers.length === 0 ? (
                <Box py="$4" alignItems="center">
                  <Text color="#a0a0a0">No blocked users</Text>
                </Box>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <VStack space="md" py="$2">
                    {blockedUsers.map((blockedUser) => (
                      <HStack
                        key={blockedUser.id}
                        space="md"
                        alignItems="center"
                        bg="#2a2a2a"
                        p="$3"
                        borderRadius="$md"
                      >
                        <Avatar size="md" bg="#333">
                          {blockedUser.avatar ? (
                            <AvatarImage
                              source={{ uri: blockedUser.avatar }}
                              alt="Avatar"
                            />
                          ) : (
                            <Avatar.FallbackText color="white">
                              {(blockedUser.first_name?.[0] || "") +
                                (blockedUser.last_name?.[0] || "") || "U"}
                            </Avatar.FallbackText>
                          )}
                        </Avatar>

                        <VStack flex={1}>
                          <Text color="white" fontWeight="$semibold">
                            {blockedUser.username}
                          </Text>
                          <Text color="#a0a0a0" fontSize="$sm">
                            {blockedUser.first_name} {blockedUser.last_name}
                          </Text>
                        </VStack>

                        <Button
                          size="sm"
                          bg="#ff6b6b"
                          onPress={() =>
                            handleUnblockUser(
                              blockedUser.id,
                              blockedUser.username
                            )
                          }
                        >
                          <ButtonText color="white" fontSize="$sm">
                            Unblock
                          </ButtonText>
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                </ScrollView>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Notification Settings — native bottom sheet */}
        <RNModal
          visible={showNotifSettings}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNotifSettings(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowNotifSettings(false)}>
            <RNView style={styles.notifBackdrop} />
          </TouchableWithoutFeedback>
          <RNView style={styles.notifSheet}>
            <RNView style={styles.notifHandle} />
            <HStack justifyContent="space-between" alignItems="center" mb="$5">
              <Heading size="lg" color="white">Notifications</Heading>
              <TouchableOpacity onPress={() => setShowNotifSettings(false)}>
                <Icon as={CloseIcon} color="#a0a0a0" size="lg" />
              </TouchableOpacity>
            </HStack>

            <RNView style={styles.notifRow}>
              <RNView style={{ flex: 1, marginRight: 16 }}>
                <Text color="white" fontWeight="$semibold" fontSize="$md">Push Notifications</Text>
                <Text color="#a0a0a0" fontSize="$sm" mt="$1">
                  Ride updates, chat messages, member activity
                </Text>
              </RNView>
              <Switch
                value={notifEnabled}
                onValueChange={handleNotifToggle}
                disabled={savingNotif}
                trackColor={{ false: "#444", true: ACCENT }}
                thumbColor="#ffffff"
              />
            </RNView>

            {notifPermissionStatus === "denied" && !notifEnabled && (
              <RNView style={styles.notifWarning}>
                <Text color="#ff9800" fontSize="$sm" mb="$3">
                  Notifications are blocked in your device settings.
                </Text>
                <Button size="sm" bg={ACCENT} onPress={() => Linking.openSettings()}>
                  <ButtonText color="#121212">Open Device Settings</ButtonText>
                </Button>
              </RNView>
            )}
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
    backgroundColor: "#1e1e1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  notifHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#555",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
  },
  notifWarning: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
});