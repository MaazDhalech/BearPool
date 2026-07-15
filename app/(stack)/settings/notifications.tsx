import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { NavHeader } from "@/components/ui/NavHeader";
import { confirm, toast } from "@/components/ui/Dialog";
import { Box, Button, ButtonText, ScrollView, Text } from "@gluestack-ui/themed";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

export default function NotificationsScreen() {
  const { userId } = useFirebaseAuth();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermissionStatus, setNotifPermissionStatus] = useState<
    "granted" | "denied" | "undetermined"
  >("undetermined");
  const [savingNotif, setSavingNotif] = useState(false);

  // Sync stored preference + live permission status on mount
  useEffect(() => {
    if (!userId) return;

    const sync = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", userId));
        const notifPrefs = userSnap.exists() ? userSnap.data().notifPrefs : undefined;
        let enabled = notifPrefs?.enabled === true;

        const { status } = await Notifications.getPermissionsAsync();
        const normalized = status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
        setNotifPermissionStatus(normalized);

        // If permission is gone (revoked in system settings), reflect that
        if (normalized !== "granted" && enabled) {
          enabled = false;
        }
        setNotifEnabled(enabled);
      } catch (error) {
        console.error("Error syncing notification settings:", error);
      }
    };

    sync();
  }, [userId]);

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

        let finalStatus: Notifications.PermissionStatus = status;
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

  return (
    <Box flex={1} bg={darkTheme.bg}>
      <NavHeader title="Notifications" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Box px="$4" py="$6">
          <View style={styles.notifRow}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text color={darkTheme.textPrimary} fontWeight="$semibold" fontSize="$md">
                Push Notifications
              </Text>
              <Text color={darkTheme.textSecondary} fontSize="$sm" mt="$1">
                Ride updates, chat messages, member activity
              </Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={handleNotifToggle}
              disabled={savingNotif}
              trackColor={{ false: darkTheme.borderStrong, true: ACCENT }}
              thumbColor={darkTheme.textPrimary}
            />
          </View>

          {notifPermissionStatus === "denied" && !notifEnabled && (
            <View style={styles.notifWarning}>
              <Text color="#ffcc00" fontSize="$sm" mb="$3">
                Notifications are blocked in your device settings.
              </Text>
              <Button size="sm" bg={ACCENT} onPress={() => Linking.openSettings()}>
                <ButtonText color={darkTheme.bg}>Open Device Settings</ButtonText>
              </Button>
            </View>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}

const styles = StyleSheet.create({
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
});
