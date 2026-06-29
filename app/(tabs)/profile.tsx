import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { TYPE } from "@/constants/Typography";
import { SPACE } from "@/constants/Spacing";
import { NavHeader } from "@/components/ui/NavHeader";
import { ActionButton } from "@/components/ui/ActionButton";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
  Avatar,
  AvatarImage,
  Box,
  ScrollView,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function ProfileScreen() {
  const { isLoaded, userId } = useFirebaseAuth();

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // === Load profile data ===
  const fetchUserData = useCallback(async () => {
    if (!userId) return;
    try {
      const userDocRef = doc(db, "users", userId);
      const userSnap = await getDoc(userDocRef);

      const firebaseData = userSnap.exists()
        ? {
            ...userSnap.data(),
            avatar:
              typeof userSnap.data().avatar === "string"
                ? userSnap.data().avatar
                : DEFAULT_AVATAR,
            blockedUsers: userSnap.data().blockedUsers || [],
          }
        : {
            avatar: DEFAULT_AVATAR,
            username: "",
            ridesJoined: 0,
            ridesHosted: 0,
            createdAt: new Date(),
            gender: null,
            blockedUsers: [],
          };

      setProfileData({ firebaseData });
    } catch (error) {
      console.error("Error fetching profile:", error);
      setProfileData({
        firebaseData: {
          avatar: DEFAULT_AVATAR,
          username: "",
          first_name: "",
          last_name: "",
          email: "",
          ridesJoined: 0,
          ridesHosted: 0,
          gender: null,
          blockedUsers: [],
        },
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Re-fetch whenever the screen regains focus (e.g. after the edit sheet saves)
  useFocusEffect(
    useCallback(() => {
      if (isLoaded && userId) fetchUserData();
    }, [isLoaded, userId, fetchUserData]),
  );

  if (!isLoaded || loading) {
    return (
      <Box flex={1} bg={darkTheme.bg} justifyContent="center" alignItems="center">
        <Text color={darkTheme.textSecondary}>Loading profile...</Text>
      </Box>
    );
  }

  const display = {
    firstName: profileData.firebaseData.first_name || "",
    lastName: profileData.firebaseData.last_name || "",
    username: profileData.firebaseData.username || "",
    email: profileData.firebaseData.email || "",
    gender: profileData.firebaseData.gender,
    avatar: profileData.firebaseData.avatar,
    ridesJoined: profileData.firebaseData.ridesJoined,
    ridesHosted: profileData.firebaseData.ridesHosted,
    blockedUsers: profileData.firebaseData.blockedUsers || [],
  };

  const initials =
    (display.firstName?.[0] || "") + (display.lastName?.[0] || "") || "U";

  return (
    <Box flex={1} bg={darkTheme.bg}>
      <LinearGradient
        colors={["rgba(255, 190, 92, 0.28)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }}
        pointerEvents="none"
      />
      <NavHeader
        title="Profile"
        showBack={false}
        rightIcon="settings"
        rightLabel="Open settings"
        onRightPress={() => router.push("/(stack)/settings/settings")}
      />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.lg }}>
          <VStack space="lg" alignItems="center">
            {/* Avatar */}
            <View style={{ alignItems: "center" }}>
              <Avatar size="2xl" bg={darkTheme.surface} borderRadius="$full">
                {display.avatar ? (
                  <AvatarImage source={{ uri: display.avatar }} alt="Avatar" />
                ) : (
                  <Avatar.FallbackText color={darkTheme.textPrimary}>{initials}</Avatar.FallbackText>
                )}
              </Avatar>
            </View>

            {/* Name + username */}
            <VStack alignItems="center" space="xs" style={{ marginBottom: SPACE.sm }}>
              <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold, textAlign: "center" }}>
                {display.firstName} {display.lastName}
              </Text>
              {display.username ? (
                <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.body }}>
                  @{display.username}
                </Text>
              ) : null}
            </VStack>

            {/* Stats card */}
            <GlassSurface fallbackColor={darkTheme.surface} style={{ flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: darkTheme.border, overflow: "hidden", width: "100%" }}>
              <View style={{ flex: 1, alignItems: "center", paddingVertical: SPACE.lg, borderRightWidth: 1, borderRightColor: darkTheme.border }}>
                <Text style={{ color: ACCENT, fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold }}>{display.ridesJoined ?? 0}</Text>
                <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, marginTop: 2 }}>Joined</Text>
              </View>
              <View style={{ flex: 1, alignItems: "center", paddingVertical: SPACE.lg }}>
                <Text style={{ color: ACCENT, fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold }}>{display.ridesHosted ?? 0}</Text>
                <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, marginTop: 2 }}>Hosted</Text>
              </View>
            </GlassSurface>

            {/* Details */}
            <VStack space="sm" w="100%" style={{ marginTop: SPACE.lg }}>
              <View style={{ backgroundColor: darkTheme.surface, borderRadius: 12, borderWidth: 1, borderColor: darkTheme.border, overflow: "hidden" }}>
                {[
                  { label: "Email", value: display.email },
                  {
                    label: "Gender",
                    value: display.gender === "M" ? "Male"
                      : display.gender === "F" ? "Female"
                      : display.gender === "NB" ? "Non-binary"
                      : "Not specified",
                  },
                ].map((row, i) => (
                  <View key={row.label} style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: darkTheme.raised }}>
                    <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, marginBottom: 2 }}>{row.label}</Text>
                    <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.body, fontWeight: TYPE.weight.medium }}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </VStack>

            {/* Edit button */}
            <VStack space="md" style={{ marginTop: SPACE["2xl"], width: "100%", paddingBottom: SPACE["2xl"] }}>
              <ActionButton
                label="Edit Profile"
                variant="secondary"
                onPress={() => router.push("/edit-profile")}
              />
            </VStack>
          </VStack>
        </View>
      </ScrollView>
    </Box>
  );
}
