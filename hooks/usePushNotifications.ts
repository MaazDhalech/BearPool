import { db } from "@/services/firebaseConfig";
import { useAuth } from "@clerk/clerk-expo";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export interface PushNotificationState {
  expoPushToken?: Notifications.ExpoPushToken;
  notification?: Notifications.Notification;
  registerForPush?: () => Promise<string | undefined>;
}

type Options = {
  autoRegister?: boolean;
};

export const usePushNotifications = (options: Options = {}): PushNotificationState => {
  const { autoRegister = false } = options;
  const [expoPushToken, setExpoPushToken] = useState<
    Notifications.ExpoPushToken | undefined
  >();
  const [notification, setNotification] = useState<
    Notifications.Notification | undefined
  >();

  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  const { userId } = useAuth();

  const registerForPushNotificationsAsync = useCallback(async () => {
    if (!Device.isDevice) {
      console.warn("Must use physical device for Push Notifications");
      return undefined;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("Push permission not granted");
      return undefined;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("Expo projectId is missing — push token may not register properly.");
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId ?? undefined,
    });

    console.log("Expo Push Token:", token.data);

    // ✅ Save token to Firestore if different from current, merge pushTokens map
    if (userId) {
      const userRef = doc(db, "users", userId);
      const userSnap = await getDoc(userRef);
      const existing = userSnap.data() || {};

      const deviceKey =
        Device.osInternalBuildId ||
        Device.osBuildFingerprint ||
        Device.modelId ||
        Device.modelName ||
        "unknown-device";

      const alreadySame =
        existing.expoPushToken === token.data ||
        (existing.pushTokens &&
          typeof existing.pushTokens === "object" &&
          Object.values(existing.pushTokens).includes(token.data));

      if (!alreadySame) {
        await setDoc(
          userRef,
          {
            expoPushToken: token.data,
            pushTokens: { [deviceKey]: token.data },
          },
          { merge: true }
        );
        console.log("✅ Push token saved to Firestore");
      }
    } else {
      console.warn("No userId available to save push token.");
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    setExpoPushToken(token);
    return token.data;
  }, [userId]);

  useEffect(() => {
    if (autoRegister) {
      registerForPushNotificationsAsync();
    }

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        setNotification(notification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("Notification response:", response);
      }
    );

    return () => {
      notificationListener.current?.remove();  // ✅ modern cleanup
      responseListener.current?.remove();      // ✅ modern cleanup
    };
  }, [autoRegister, registerForPushNotificationsAsync]);

  return {
    expoPushToken,
    notification,
    registerForPush: registerForPushNotificationsAsync,
  };
};
