import { ACCENT } from "@/constants/Colors";
import { TYPE } from "@/constants/Typography";
import { SPACE } from "@/constants/Spacing";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  HStack,
  Heading,
  Icon,
  Input,
  InputField,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { Menu } from "lucide-react-native";
import { useEffect, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Alert, Platform, TouchableOpacity, View } from "react-native";

import * as filter from "leo-profanity";

// Optional: Customize
filter.add(["ridehate", "berkeleybully"]);
// filter.remove("assassin");

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function ProfileScreen() {
  const { isLoaded, userId } = useFirebaseAuth();
  const router = useRouter();

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  type Gender = "M" | "F" | "NB" | null;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    gender: null as Gender,
  });

  // === Single validation using leo-profanity ===
  const validateAndCleanText = (
    text: string,
    fieldName: string
  ): { isValid: boolean; cleanedText: string; error?: string } => {
    if (!text.trim()) {
      return { isValid: true, cleanedText: text };
    }

    if (filter.check(text)) {
      const cleanedText = filter.clean(text);
      return {
        isValid: false,
        cleanedText,
        error: `The ${fieldName} contains inappropriate content.`,
      };
    }

    return { isValid: true, cleanedText: text };
  };

  // === Real-time validation + error feedback ===
  const handleTextChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });

    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: "" });
    }

    if (value.trim()) {
      const validation = validateAndCleanText(value, field);
      if (!validation.isValid) {
        setFormErrors({
          ...formErrors,
          [field]:
            validation.error || `${field} contains inappropriate content`,
        });
      }
    }
  };

  // === Load profile data ===
  useEffect(() => {
    if (!isLoaded || !userId) return;

    const fetchUserData = async () => {
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

        setFormData({
          firstName: firebaseData.first_name || "",
          lastName: firebaseData.last_name || "",
          username: firebaseData.username || "",
          gender: firebaseData.gender || null,
        });
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
    };

    fetchUserData();
  }, [isLoaded, userId]);

  // === Save profile ===
  const handleUpdateProfile = async () => {
    if (!userId) return;

    const validations = {
      firstName: validateAndCleanText(formData.firstName, "first name"),
      lastName: validateAndCleanText(formData.lastName, "last name"),
      username: validateAndCleanText(formData.username, "username"),
    };

    const hasErrors = Object.values(validations).some((v) => !v.isValid);
    if (hasErrors) {
      const errorMessages = Object.entries(validations)
        .filter(([_, v]) => !v.isValid)
        .map(([field, v]) => `${field}: ${v.error}`)
        .join("\n");

      Alert.alert(
        "Content Issues Found",
        `Please fix the following:\n\n${errorMessages}`,
        [{ text: "Edit", style: "cancel" }]
      );
      return;
    }

    try {
      const cleanedData = {
        firstName: validations.firstName.cleanedText,
        lastName: validations.lastName.cleanedText,
        username: validations.username.cleanedText,
        gender: formData.gender,
      };

      const updatedData = {
        username: cleanedData.username,
        gender: cleanedData.gender,
        email: profileData.firebaseData.email || "",
        first_name: cleanedData.firstName,
        last_name: cleanedData.lastName,
        avatar: profileData.firebaseData.avatar,
        createdAt: profileData.firebaseData.createdAt,
        ridesJoined: profileData.firebaseData.ridesJoined,
        ridesHosted: profileData.firebaseData.ridesHosted,
        blockedUsers: profileData.firebaseData.blockedUsers || [],
      };

      await setDoc(doc(db, "users", userId), updatedData);

      setProfileData({ firebaseData: updatedData });

      setFormData(cleanedData);
      setFormErrors({});
      setIsEditing(false);

      Alert.alert("Success", "Profile updated successfully!", [{ text: "OK" }]);
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.", [
        { text: "OK" },
      ]);
    }
  };

  // === Change avatar ===
  const handleChangeAvatar = async () => {
    if (!userId || avatarUploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Camera Roll Access Needed",
        "We need access to your camera roll so you can choose a photo for your profile picture. Your photos are only used for your avatar and never shared without your permission."













      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 400 } }],
      { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!compressed.base64) {
      Alert.alert(
        "Image Processing Failed",
        "We couldn't process your image. This might happen if the file is corrupted or in an unsupported format. Please try selecting a different image or take a new photo."
      );
      return;
    }

    const base64 = `data:image/jpeg;base64,${compressed.base64}`;
    if (base64.length > 900000) {
      Alert.alert(
        "Image Too Large",
        "The selected image is too large to upload (max 900KB). Please choose a smaller image or try taking a new photo with your camera app set to a lower resolution."
      );
      return;
    }

    setAvatarUploading(true);
    try {
      await updateDoc(doc(db, "users", userId), { avatar: base64 });
      setProfileData((p: any) => ({
        ...p,
        firebaseData: { ...p.firebaseData, avatar: base64 },
      }));
    } catch (err) {
      console.error("Failed to upload avatar:", err);
      Alert.alert("Upload Failed", "Could not update your photo. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  if (!isLoaded || loading) {
    return (
      <Box flex={1} bg="#121212" justifyContent="center" alignItems="center">
        <Text color="#a0a0a0">Loading profile...</Text>
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
    <Box flex={1} bg="#121212">
      <LinearGradient
        colors={["rgba(255, 190, 92, 0.28)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }}
        pointerEvents="none"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg }}>
            {/* Header */}
            <HStack
              justifyContent="space-between"
              alignItems="center"
              style={{ marginTop: SPACE["4xl"], marginBottom: SPACE["2xl"] }}
            >
              <Text style={{ color: "#ffffff", fontSize: TYPE.size.display, fontWeight: TYPE.weight.bold, lineHeight: TYPE.size.display * TYPE.leading.tight }}>
                {isEditing ? "Edit\nProfile" : "Your\nProfile"}
              </Text>
              {!isEditing && (
                <TouchableOpacity
                  onPress={() => router.push("/(stack)/settings/settings")}
                  style={{
                    padding: SPACE.sm,
                    backgroundColor: "#1e1e1e",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#333",
                  }}
                >
                  <Icon as={Menu} size="xl" color="white" />
                </TouchableOpacity>
              )}
            </HStack>

            <VStack space="lg" alignItems="center">
              {/* Avatar */}
              <TouchableOpacity
                onPress={isEditing ? handleChangeAvatar : undefined}
                disabled={avatarUploading}
                style={{ alignItems: "center", marginBottom: isEditing ? SPACE.sm : 0 }}
              >
                <View style={{ position: "relative" }}>
                  <Avatar size="2xl" bg="#1e1e1e" borderRadius="$full" opacity={avatarUploading ? 0.5 : 1}>
                    {display.avatar ? (
                      <AvatarImage source={{ uri: display.avatar }} alt="Avatar" />
                    ) : (
                      <Avatar.FallbackText color="white">{initials}</Avatar.FallbackText>
                    )}
                  </Avatar>
                  {avatarUploading && (
                    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                      <ActivityIndicator size="small" color={ACCENT} />
                    </View>
                  )}
                </View>
                {isEditing && (
                  <Text style={{ color: avatarUploading ? "#666" : ACCENT, fontSize: TYPE.size.label, marginTop: SPACE.sm }}>
                    {avatarUploading ? "Uploading..." : "Tap to change photo"}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Name + username — shown prominently when not editing */}
              {!isEditing && (
                <VStack alignItems="center" space="xs" style={{ marginBottom: SPACE.sm }}>
                  <Text style={{ color: "#ffffff", fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold, textAlign: "center" }}>
                    {display.firstName} {display.lastName}
                  </Text>
                  {display.username ? (
                    <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.body }}>
                      @{display.username}
                    </Text>
                  ) : null}
                </VStack>
              )}

              {/* Stats card */}
              <View style={{ flexDirection: "row", backgroundColor: "#1e1e1e", borderRadius: 12, borderWidth: 1, borderColor: "#333", overflow: "hidden", width: "100%" }}>
                <View style={{ flex: 1, alignItems: "center", paddingVertical: SPACE.lg, borderRightWidth: 1, borderRightColor: "#333" }}>
                  <Text style={{ color: ACCENT, fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold }}>{display.ridesJoined ?? 0}</Text>
                  <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.label, marginTop: 2 }}>Joined</Text>
                </View>
                <View style={{ flex: 1, alignItems: "center", paddingVertical: SPACE.lg }}>
                  <Text style={{ color: ACCENT, fontSize: TYPE.size.heading, fontWeight: TYPE.weight.bold }}>{display.ridesHosted ?? 0}</Text>
                  <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.label, marginTop: 2 }}>Hosted</Text>
                </View>
              </View>

              {/* Form / Display */}
              <VStack space="sm" w="100%" style={{ marginTop: SPACE.lg }}>
                {isEditing ? (
                  <>
                    <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.caption }}>First Name</Text>
                    <Input
                      bg="#1e1e1e"
                      borderColor={formErrors.firstName ? "#ff6b6b" : "#333"}
                    >
                      <InputField
                        color="white"
                        value={formData.firstName}
                        onChangeText={(t) => handleTextChange("firstName", t)}
                      />
                    </Input>
                    {formErrors.firstName && (
                      <Text color="#ff6b6b" fontSize="$sm" mt="$1">
                        {formErrors.firstName}
                      </Text>
                    )}

                    <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.caption, marginTop: SPACE.md }}>
                      Last Name
                    </Text>
                    <Input
                      bg="#1e1e1e"
                      borderColor={formErrors.lastName ? "#ff6b6b" : "#333"}
                    >
                      <InputField
                        color="white"
                        value={formData.lastName}
                        onChangeText={(t) => handleTextChange("lastName", t)}
                      />
                    </Input>
                    {formErrors.lastName && (
                      <Text color="#ff6b6b" fontSize="$sm" mt="$1">
                        {formErrors.lastName}
                      </Text>
                    )}

                    <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.caption, marginTop: SPACE.md }}>
                      Username
                    </Text>
                    <Input
                      bg="#1e1e1e"
                      borderColor={formErrors.username ? "#ff6b6b" : "#333"}
                    >
                      <InputField
                        color="white"
                        value={formData.username}
                        onChangeText={(t) => handleTextChange("username", t)}
                      />
                    </Input>
                    {formErrors.username && (
                      <Text color="#ff6b6b" fontSize="$sm" mt="$1">
                        {formErrors.username}
                      </Text>
                    )}

                    <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.caption, marginTop: SPACE.md }}>
                      Gender (optional — helps us keep riders safe)
                    </Text>
                    <Text style={{ color: "#666", fontSize: TYPE.size.micro, marginBottom: SPACE.sm }}>
                      We only ask so safety features can work. It’s completely optional, never shared, and you can remove it anytime.
                    </Text>
                    <HStack space="sm" w="100%">
                      {(["M", "F", "NB"] as Gender[]).map((option) => (
                        <TouchableOpacity
                          key={option}
                          activeOpacity={0.7}
                          onPress={() => setFormData({ ...formData, gender: option })}
                          style={{
                            flex: 1,
                            padding: SPACE.md,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: formData.gender === option ? ACCENT : "#333",
                            backgroundColor: formData.gender === option ? "#2e2610" : "#1e1e1e",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{
                            color: formData.gender === option ? ACCENT : "#a0a0a0",
                            fontSize: TYPE.size.body,
                            fontWeight: formData.gender === option ? TYPE.weight.semibold : TYPE.weight.regular,
                          }}>
                            {option === "M" ? "Male" : option === "F" ? "Female" : "Non-binary"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </HStack>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setFormData({ ...formData, gender: null })}
                      style={{
                        marginTop: SPACE.sm,
                        padding: SPACE.md,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: formData.gender === null ? ACCENT : "#333",
                        backgroundColor: formData.gender === null ? "#2e2610" : "transparent",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{
                        color: formData.gender === null ? ACCENT : "#a0a0a0",
                        fontSize: TYPE.size.body,
                        fontWeight: formData.gender === null ? TYPE.weight.semibold : TYPE.weight.regular,
                      }}>
                        Prefer not to say
                      </Text>
                    </TouchableOpacity>

                    <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.caption, marginTop: SPACE.md }}>Email</Text>
                    <Text style={{ color: "white", fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold }}>{display.email}</Text>
                  </>
                ) : (
                  /* View mode — details below the name card */
                  <View style={{ backgroundColor: "#1e1e1e", borderRadius: 12, borderWidth: 1, borderColor: "#333", overflow: "hidden" }}>
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
                      <View key={row.label} style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "#2a2a2a" }}>
                        <Text style={{ color: "#a0a0a0", fontSize: TYPE.size.label, marginBottom: 2 }}>{row.label}</Text>
                        <Text style={{ color: "#ffffff", fontSize: TYPE.size.body, fontWeight: TYPE.weight.medium }}>{row.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </VStack>

              {/* Buttons */}
              <VStack space="md" style={{ marginTop: SPACE["2xl"], width: "100%", paddingBottom: SPACE["2xl"] }}>
                {isEditing ? (
                  <>
                    <Button bg={ACCENT} onPress={handleUpdateProfile}>
                      <Text color="#121212" style={{ fontWeight: TYPE.weight.semibold, fontSize: TYPE.size.body }}>
                        Save Changes
                      </Text>
                    </Button>
                    <Button
                      variant="outline"
                      borderColor="#333"
                      onPress={() => {
                        setIsEditing(false);
                        setFormErrors({});
                      }}
                    >
                      <Text color="white">Cancel</Text>
                    </Button>
                  </>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      setFormData({
                        firstName: display.firstName,
                        lastName: display.lastName,
                        username: display.username,
                        gender: display.gender ?? null,
                      });
                      setIsEditing(true);
                    }}
                    style={{
                      borderWidth: 1,
                      borderColor: ACCENT,
                      borderRadius: 8,
                      paddingVertical: SPACE.md,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: ACCENT, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold }}>
                      Edit Profile
                    </Text>
                  </TouchableOpacity>
                )}
              </VStack>
            </VStack>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Box>
  );
}