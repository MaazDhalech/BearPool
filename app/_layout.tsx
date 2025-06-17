import "@/global.css";
import { config } from "@/gluestack-ui.config";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ClerkProvider } from "@clerk/clerk-expo";
import { GluestackUIProvider } from "@gluestack-ui/themed";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Platform, StatusBar, View } from "react-native";
import "react-native-reanimated";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || "";

const tokenCache = {
  getToken: (key: string) => SecureStore.getItemAsync(key),
  saveToken: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value),
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  if (!loaded) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <GluestackUIProvider config={config}>
        {/* Always use the dark theme for navigation */}
        <ThemeProvider value={DarkTheme}>
          {/* Instagram-style status bar */}
          <ExpoStatusBar
            style="light"
            translucent
            backgroundColor="transparent"
          />

          {/* Main container with dynamic padding */}
          <View
            style={{
              flex: 1,
              backgroundColor: colorScheme === "dark" ? "#000000" : "#ffffff",
              paddingTop:
                Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
            }}
          >
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: "#000000",
                },
                headerTintColor: "#ffffff",
                headerTitleStyle: {
                  fontWeight: "bold",
                },
                headerShadowVisible: false, // Remove header bottom border
                contentStyle: {
                  backgroundColor: "#000000",
                },
              }}
            >
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen name="+not-found" />
            </Stack>
          </View>
        </ThemeProvider>
      </GluestackUIProvider>
    </ClerkProvider>
  );
}
