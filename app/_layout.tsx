import "@/global.css";
import { config } from "@/gluestack-ui.config";
import { ClerkProvider } from "@clerk/clerk-expo";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Platform, StatusBar, View } from "react-native";
import "react-native-reanimated";

// ✅ Fixed: Full notification behavior for newer Expo SDKs
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

const tokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value),
};

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  if (!loaded) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GluestackUIProvider config={config}>
        <ThemeProvider value={DarkTheme}>
          <ExpoStatusBar style="light" translucent backgroundColor="transparent" />
          <View
            style={{
              flex: 1,
              backgroundColor: "#000000",
              paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
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