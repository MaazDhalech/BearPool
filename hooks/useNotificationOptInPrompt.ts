import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback } from "react";

import { db } from "@/services/firebaseConfig";

type PermissionStatus = "granted" | "denied" | "undetermined";

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type PrefCacheEntry = {
  dismissedAt?: number;
  enabled?: boolean;
  permissionStatus?: PermissionStatus;
};

const prefCache: Record<string, PrefCacheEntry> = {};

const getProjectId = () =>
  Constants.expoConfig?.extra?.eas?.projectId ??
  Constants.expoConfig?.extra?.projectId ??
  undefined;

export const useNotificationOptInPrompt = (userId?: string | null) => {
  const storageKey = userId ? `notifPromptDismissed:${userId}` : null;

  const persistPrefs = useCallback(
    async (payload: Record<string, any>) => {
      if (!userId) return;
      try {
        await setDoc(
          doc(db, "users", userId),
          { notifPrefs: payload },
          { merge: true }
        );
      } catch (error) {
        console.warn("Failed to persist notif prefs", error);
      }
    },
    [userId]
  );

  const shouldPrompt = useCallback(async () => {
    if (!userId) return { shouldShow: false, permissionStatus: "undetermined" as PermissionStatus };

    const perm = await Notifications.getPermissionsAsync();
    const status: PermissionStatus =
      perm.status === "granted"
        ? "granted"
        : perm.status === "denied"
        ? "denied"
        : "undetermined";

    if (status === "granted") {
      await persistPrefs({ enabled: true, permissionStatus: "granted" });
      return { shouldShow: false, permissionStatus: "granted" as PermissionStatus };
    }

    const now = Date.now();

    const cached = prefCache[userId];
    if (cached) {
      if (cached.enabled) {
        return { shouldShow: false, permissionStatus: cached.permissionStatus || status };
      }
      if (cached.dismissedAt && now - cached.dismissedAt < COOLDOWN_MS) {
        return {
          shouldShow: false,
          permissionStatus: cached.permissionStatus || status,
        };
      }
    }

    if (storageKey) {
      const localDismiss = await AsyncStorage.getItem(storageKey);
      if (localDismiss) {
        const ts = Number(localDismiss);
        if (!Number.isNaN(ts) && now - ts < COOLDOWN_MS) {
          return { shouldShow: false, permissionStatus: status };
        }
      }
    }

    let userPrefStatus: PermissionStatus | undefined;
    let dismissedAt: number | undefined;
    try {
      const snap = await getDoc(doc(db, "users", userId));
      const prefs = snap.data()?.notifPrefs;
      if (prefs?.enabled) {
        prefCache[userId] = {
          enabled: true,
          permissionStatus: prefs.permissionStatus || status || "granted",
        };
        return { shouldShow: false, permissionStatus: "granted" as PermissionStatus };
      }
      if (prefs?.promptDismissedAt?.toMillis) {
        dismissedAt = prefs.promptDismissedAt.toMillis();
      }
      if (prefs?.permissionStatus) {
        userPrefStatus = prefs.permissionStatus as PermissionStatus;
      }
    } catch (error) {
      console.warn("Failed to read notif prefs", error);
    }

    if (dismissedAt && now - dismissedAt < COOLDOWN_MS) {
      prefCache[userId] = {
        dismissedAt,
        permissionStatus: userPrefStatus || status,
      };
      return { shouldShow: false, permissionStatus: status };
    }

    const effectiveStatus = userPrefStatus || status || "undetermined";
    prefCache[userId] = { permissionStatus: effectiveStatus };
    return { shouldShow: true, permissionStatus: effectiveStatus };
  }, [persistPrefs, storageKey, userId]);

  const markDismissed = useCallback(async () => {
    if (storageKey) {
      await AsyncStorage.setItem(storageKey, String(Date.now()));
    }
    if (userId) {
      prefCache[userId] = {
        ...(prefCache[userId] || {}),
        dismissedAt: Date.now(),
        permissionStatus: prefCache[userId]?.permissionStatus || "undetermined",
      };
    }
    await persistPrefs({
      permissionStatus: "undetermined",
      promptDismissedAt: serverTimestamp(),
    });
  }, [persistPrefs, storageKey]);

  const registerToken = useCallback(
    async (permissionStatus: PermissionStatus) => {
      if (!userId || permissionStatus !== "granted") return null;

      if (!Device.isDevice) {
        console.warn("Push notifications require a physical device.");
        return null;
      }

      const projectId = getProjectId();
      const token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );

      const deviceKey =
        Device.osInternalBuildId ||
        Device.osBuildFingerprint ||
        Device.modelId ||
        Device.modelName ||
        "unknown-device";

      try {
        await setDoc(
          doc(db, "users", userId),
          {
            expoPushToken: token.data,
            pushTokens: { [deviceKey]: token.data },
            notifPrefs: { enabled: true, permissionStatus: "granted" },
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Failed to save push token", error);
      }

      return token.data;
    },
    [userId]
  );

  const requestPermission = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    const normalized: PermissionStatus =
      status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";

    if (userId) {
      prefCache[userId] = {
        ...(prefCache[userId] || {}),
        permissionStatus: normalized,
        enabled: normalized === "granted",
      };
    }

    await persistPrefs({ permissionStatus: normalized, enabled: normalized === "granted" });
    if (normalized === "granted") {
      await registerToken(normalized);
    }

    return normalized;
  }, [persistPrefs, registerToken]);

  const openSettings = useCallback(async () => {
    try {
      // Linking.openSettings is the simplest cross-platform option
      await Linking.openSettings();
    } catch (error) {
      console.error("Failed to open settings", error);
    }
  }, []);

  return {
    shouldPrompt,
    requestPermission,
    openSettings,
    markDismissed,
  };
};
