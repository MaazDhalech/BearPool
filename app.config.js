import "dotenv/config";

export default {
  expo: {
    name: "BearPool",
    slug: "BearPool",
    version: "1.2.0",
    runtimeVersion: "1.2.0",
    updates: {
      url: "https://u.expo.dev/e469f4b5-1dbf-4a1d-aa5e-0417dee7cf2c",
    },
    orientation: "portrait",
    icon: "./assets/images/newicon.png",
    scheme: "bearpool",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      bundleIdentifier: "com.rebu.bearpool",
      buildNumber: "5",
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
        "expo-apple-authentication",
      ],
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
      "expo-notifications",
      "expo-font",
      "expo-localization",
      "expo-web-browser",
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.888067452420-h931i412b9d244e27q24at0ehmie2mvr"
        }
      ],
      [
        "react-native-google-mobile-ads",
        {
          // iOS-only release. androidAppId is Google's sample/test app ID as a
          // placeholder until a separate Android AdMob app is created.
          iosAppId: "ca-app-pub-3671007839721369~8407264748",
          androidAppId: "ca-app-pub-3940256099942544~3347511713",
          userTrackingUsageDescription:
            "This identifier will be used to deliver more relevant ads to you.",
        }
      ]
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
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
      web3formsApiKey: process.env.WEB3FORMS_API_KEY,

      eas: {
        projectId: "e469f4b5-1dbf-4a1d-aa5e-0417dee7cf2c",
      },
    },
  },
};
