import { ACCENT } from "@/constants/Colors";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { db } from "@/services/firebaseConfig";
import { createNativeBottomTabNavigator } from "@bottom-tabs/react-navigation";
import { useRouter, withLayoutContext } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { Image, View, type ImageSourcePropType } from "react-native";
import { captureRef } from "react-native-view-shot";

// Bridge the native bottom-tabs navigator into expo-router's file-based routing.
const BottomTabNavigator = createNativeBottomTabNavigator().Navigator;
const Tabs = withLayoutContext(BottomTabNavigator);

type TabIcon = ImageSourcePropType | { sfSymbol: string };

const AVATAR_PX = 64;

export default function TabLayout() {
  const { isSignedIn, isLoaded, userId } = useFirebaseAuth();
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [circularAvatar, setCircularAvatar] = useState<string | null>(null);
  const avatarViewRef = useRef<View>(null);

  // Redirect to login if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/(auth)/Login");
    }
  }, [isLoaded, isSignedIn]);

  // Load the user's avatar so the Profile tab can show their photo
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

  // Re-bake when the avatar changes
  useEffect(() => {
    setCircularAvatar(null);
  }, [avatar]);

  // The native tab bar can't clip an icon to a circle, so we render the avatar
  // inside a round, clipped frame off-screen and snapshot it to a PNG (with
  // transparent corners). That circular PNG becomes the Profile tab icon.
  const bakeCircularAvatar = async () => {
    try {
      const uri = await captureRef(avatarViewRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
        width: AVATAR_PX,
        height: AVATAR_PX,
      });
      setCircularAvatar(uri);
    } catch {
      // fall back to the raw (square) avatar / SF Symbol
    }
  };

  // Show nothing while loading auth state
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  const profileIcon = (): TabIcon =>
    circularAvatar
      ? { uri: circularAvatar }
      : avatar
      ? { uri: avatar }
      : { sfSymbol: "person.crop.circle" };

  return (
    <>
      {/* Off-screen circular-avatar baker (snapshotted into the tab icon). */}
      {avatar && !circularAvatar ? (
        <View
          ref={avatarViewRef}
          collapsable={false}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -1000,
            top: 0,
            width: AVATAR_PX,
            height: AVATAR_PX,
            borderRadius: AVATAR_PX / 2,
            overflow: "hidden",
            backgroundColor: "#1e1e1e",
          }}
        >
          <Image
            source={{ uri: avatar }}
            style={{ width: AVATAR_PX, height: AVATAR_PX }}
            onLoad={bakeCircularAvatar}
          />
        </View>
      ) : null}

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
    </>
  );
}
