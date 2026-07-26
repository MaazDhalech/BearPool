import "dotenv/config";

// Only set for the "e2e" EAS build profile (eas.json). Bakes the CI Metro
// URL directly into the dev-client build so it connects on cold launch with
// no deep link needed — repeated attempts at connecting via a runtime
// `expo-development-client://` deep link (xcrun simctl openurl / device.openUrl)
// proved unreliable: expo-dev-launcher's iOS source only honors that link
// when the app isn't already running, and even sequenced correctly, Metro's
// own log never showed a single incoming bundle request across several CI
// runs. defaultLaunchURL is resolved at build time, so this can't affect
// regular dev-client builds (development/preview profiles) used locally.
const plugins = [
  "expo-router",
  "react-native-bottom-tabs",
  ["expo-apple-authentication"],
  [
    "expo-splash-screen",
    {
      image: "./assets/images/icon.png",
      imageWidth: 200,
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
  ],
  "expo-secure-store",
  "expo-notifications",
  "expo-font",
  "expo-localization",
  "expo-web-browser",
  [
    "@react-native-google-signin/google-signin",
    {
      iosUrlScheme: "com.googleusercontent.apps.888067452420-h931i412b9d244e27q24at0ehmie2mvr",
    },
  ],
];

if (process.env.E2E_METRO_URL) {
  plugins.push(["expo-dev-client", { defaultLaunchURL: process.env.E2E_METRO_URL }]);
}

export default {
  expo: {
    name: "BearPool",
    slug: "BearPool",
    version: "2.0.0",
    runtimeVersion: "2.0.0",
    updates: {
      url: "https://u.expo.dev/e469f4b5-1dbf-4a1d-aa5e-0417dee7cf2c",
    },
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "bearpool",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.rebu.bearpool",
      buildNumber: "9",
      supportsTablet: true,
      entitlements: {
        "com.apple.developer.applesignin": ["Default"],
      },
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        NSUserTrackingUsageDescription: "This identifier will be used to deliver personalized notifications.",
        NSPhotoLibraryUsageDescription: "BearPool uses your photo library to let you select and upload a profile picture that other riders will see when viewing your profile or ride details.",
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "com.googleusercontent.apps.888067452420-h931i412b9d244e27q24at0ehmie2mvr"
            ]
          }
        ]
      }
    },
    android: {
      package: "com.rebu.bearpool",
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins,
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
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      web3formsApiKey: process.env.WEB3FORMS_API_KEY,

      eas: {
        projectId: "e469f4b5-1dbf-4a1d-aa5e-0417dee7cf2c",
      },
    },
  },
};
