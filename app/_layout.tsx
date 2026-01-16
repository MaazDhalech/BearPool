import "@/global.css";
import { config } from "@/gluestack-ui.config";
import { ClerkProvider } from "@clerk/clerk-expo";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StatusBar, View } from "react-native";

// ✅ Set full notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ✅ Access Clerk publishable key via correct env variable
const publishableKey =
  Constants.expoConfig?.extra?.expoPublicClerkPublishableKey || "";

const tokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value),
};

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const [isClerkReady, setIsClerkReady] = useState(false);

  useEffect(() => {
    // Give Clerk a moment to initialize
    const timer = setTimeout(() => setIsClerkReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded || !isClerkReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}
      >
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!publishableKey) {
    console.error("❌ Clerk publishable key is missing! App may crash.");
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GluestackUIProvider config={config}>
        <ThemeProvider value={DarkTheme}>
          <ExpoStatusBar
            style="light"
            translucent
            backgroundColor="transparent"
          />
          <View
            style={{
              flex: 1,
              backgroundColor: "#000000",
              paddingTop:
                Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
            }}
          >
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: "#000000",
                },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </View>
        </ThemeProvider>
      </GluestackUIProvider>
    </ClerkProvider>
  );
}
