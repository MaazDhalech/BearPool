import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";
import { useRouter, withLayoutContext } from "expo-router";
import React, { useEffect } from "react";

// Bridge the native bottom-tabs navigator into expo-router's file-based routing.
const BottomTabNavigator = createNativeBottomTabNavigator().Navigator;
const Tabs = withLayoutContext(BottomTabNavigator);

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useFirebaseAuth();
  const router = useRouter();

  // Redirect to login if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/(auth)/Login");
    }
  }, [isLoaded, isSignedIn]);

  // Show nothing while loading auth state
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <Tabs
      tabBarActiveTintColor={ACCENT}
      tabBarInactiveTintColor={darkTheme.textMuted}
      barTintColor="#000000"
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: () => ({ sfSymbol: "house.fill" }) }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: () => ({ sfSymbol: "bubble.left.and.bubble.right.fill" }),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{ title: "Post", tabBarIcon: () => ({ sfSymbol: "plus.circle.fill" }) }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: () => ({ sfSymbol: "person.crop.circle.fill" }),
        }}
      />
    </Tabs>
  );
}
