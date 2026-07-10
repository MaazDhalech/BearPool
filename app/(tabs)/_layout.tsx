import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/services/firebaseConfig";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";
import { useRouter, withLayoutContext } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect } from "react";

// Bridge the native bottom-tabs navigator into expo-router's file-based routing.
const BottomTabNavigator = createNativeBottomTabNavigator().Navigator;
const Tabs = withLayoutContext(BottomTabNavigator);

export default function TabLayout() {
  const { isSignedIn, isLoaded, userId } = useFirebaseAuth();
  const router = useRouter();

  // Redirect to login if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/(auth)/Login");
    }
  }, [isLoaded, isSignedIn]);

  // Profile-completeness gate: a signed-in user whose profile doc is missing or
  // empty (an orphan / half-created account) is sent to CompleteProfile to
  // self-heal, instead of into a broken tabs experience. Runs in the background
  // so it doesn't delay the app for the vast majority with complete profiles.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", userId));
        const data = snap.data();
        const complete = snap.exists() && !!data?.first_name && !!data?.email;
        if (!cancelled && !complete) {
          router.replace("/(auth)/CompleteProfile" as any);
        }
      } catch {
        // Don't block the app on a transient read failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

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
