import "dotenv/config";

export default {
  expo: {
    name: "BearPool",
    slug: "BearPool",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/newicon.png",
    scheme: "bearpool",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.rebu.bearpool",
      supportsTablet: true,
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        NSUserTrackingUsageDescription: "This identifier will be used to deliver personalized notifications.",
        NSPhotoLibraryUsageDescription: "BearPool lets you choose photos from your library for your profile and ride chats so other riders can recognize you and coordinate safely."
      }
    },
    android: {
      package: "com.rebu.bearpool",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/newsplash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      "expo-secure-store",
      "expo-notifications"
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.FIREBASE_APP_ID,
      firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID,
      expoPublicClerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
      web3formsApiKey: process.env.WEB3FORMS_API_KEY,

      eas: {
        projectId: "e469f4b5-1dbf-4a1d-aa5e-0417dee7cf2c",
      },
    },
  },
};
