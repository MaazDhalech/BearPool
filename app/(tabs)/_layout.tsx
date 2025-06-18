import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform } from "react-native";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  // Redirect to login if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/(auth)/Login");
    }
  }, [isLoaded, isSignedIn]);

  // Show nothing (for now) while loading auth state
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#888888',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopColor: '#000000',
          ...Platform.select({
            ios: {
              position: "absolute",
            },
            default: {},
          }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => 
            Platform.OS === 'ios' ? (
              <IconSymbol
                size={28}
                name="bubble.left.and.bubble.right.fill"
                color={color}
              />
            ) : (
              <Ionicons name="chatbubbles" size={28} color={color} />
            )
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: "Post",
          tabBarIcon: ({ color }) => 
            Platform.OS === 'ios' ? (
              <IconSymbol size={28} name="plus.circle.fill" color={color} />
            ) : (
              <Ionicons name="add-circle" size={28} color={color} />
            )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => 
            Platform.OS === 'ios' ? (
              <IconSymbol size={28} name="person.crop.circle" color={color} />
            ) : (
              <Ionicons name="person-circle" size={28} color={color} />
            )
        }}
      />
    </Tabs>
  );
}