import { ACCENT } from "@/constants/Colors";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/services/firebaseConfig";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";
import { useRouter, withLayoutContext } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import type { ImageSourcePropType } from "react-native";

// Bridge the native bottom-tabs navigator into expo-router's file-based routing.
const BottomTabNavigator = createNativeBottomTabNavigator().Navigator;
const Tabs = withLayoutContext(BottomTabNavigator);

type TabIcon = ImageSourcePropType | { sfSymbol: string };

export default function TabLayout() {
  const { isSignedIn, isLoaded, userId } = useFirebaseAuth();
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | null>(null);

  // Redirect to login if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/(auth)/Login");
    }
  }, [isLoaded, isSignedIn]);

  // Load the user's avatar so the Profile tab shows their photo instead of an icon
  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      try {
        const snap = await getDoc(doc(db, "users", userId));
        if (active && snap.exists()) {
          const a = snap.data().avatar;
          if (typeof a === "string" && a.length > 0) setAvatar(a);
        }
      } catch {
        // non-fatal — fall back to the SF Symbol icon
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  // Show nothing (for now) while loading auth state
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  const profileIcon = (): TabIcon =>
    avatar ? { uri: avatar } : { sfSymbol: "person.crop.circle" };

  return (
    <Tabs
      tabBarActiveTintColor={ACCENT}
      tabBarInactiveTintColor="#666666"
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
        options={{ title: "Profile", tabBarIcon: () => profileIcon() }}
      />
    </Tabs>
  );
}
