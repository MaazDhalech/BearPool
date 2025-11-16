import { db } from "@/services/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
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
import { Alert, Platform, TouchableOpacity } from "react-native";

import * as filter from "leo-profanity";

// Optional: Customize
filter.add(["ridehate", "berkeleybully"]);
// filter.remove("assassin");

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function ProfileScreen() {
  const { isLoaded, userId: clerkUserId } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  type Gender = "M" | "F" | "NB" | null;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    gender: null as Gender,
  });

  // === Single validation using leo-profanity ===
  const validateAndCleanText = (text: string, fieldName: string): { isValid: boolean; cleanedText: string; error?: string } => {
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
          [field]: validation.error || `${field} contains inappropriate content`,
        });
      }
    }
  };

  // === Load profile data ===
  useEffect(() => {
    if (!isLoaded || !clerkUserId || !user) return;

    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, "users", clerkUserId);
        const userSnap = await getDoc(userDocRef);

        const firebaseData = userSnap.exists()
          ? {
              ...userSnap.data(),
              avatar: typeof userSnap.data().avatar === "string" ? userSnap.data().avatar : DEFAULT_AVATAR,
              blockedUsers: userSnap.data().blockedUsers || [],
            }
          : {
              avatar: DEFAULT_AVATAR,
              username: user.username || "",
              ridesJoined: 0,
              ridesHosted: 0,
              createdAt: new Date(),
              gender: null,
              blockedUsers: [],
            };

        setProfileData({
          clerkData: {
            email: user.primaryEmailAddress?.emailAddress || "",
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            username: user.username || "",
          },
          firebaseData,
        });

        setFormData({
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          username: firebaseData.username || user.username || "",
          gender: firebaseData.gender || null,
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [isLoaded, clerkUserId, user]);

  // === Save profile ===
  const handleUpdateProfile = async () => {
    if (!clerkUserId || !user) return;

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

      Alert.alert("Content Issues Found", `Please fix the following:\n\n${errorMessages}`, [
        { text: "Edit", style: "cancel" },
      ]);
      return;
    }

    try {
      const cleanedData = {
        firstName: validations.firstName.cleanedText,
        lastName: validations.lastName.cleanedText,
        username: validations.username.cleanedText,
        gender: formData.gender,
      };

      await user.update({
        firstName: cleanedData.firstName,
        lastName: cleanedData.lastName,
      });

      const updatedData = {
        username: cleanedData.username,
        gender: cleanedData.gender,
        email: user.primaryEmailAddress?.emailAddress || "",
        first_name: cleanedData.firstName,
        last_name: cleanedData.lastName,
        avatar: profileData.firebaseData.avatar,
        createdAt: profileData.firebaseData.createdAt,
        ridesJoined: profileData.firebaseData.ridesJoined,
        ridesHosted: profileData.firebaseData.ridesHosted,
        blockedUsers: profileData.firebaseData.blockedUsers || [],
      };

      await setDoc(doc(db, "users", clerkUserId), updatedData);

      setProfileData({
        clerkData: { ...profileData.clerkData, ...cleanedData },
        firebaseData: updatedData,
      });

      setFormData(cleanedData);
      setFormErrors({});
      setIsEditing(false);

      Alert.alert("Success", "Profile updated successfully!", [{ text: "OK" }]);
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.", [{ text: "OK" }]);
    }
  };

  // === Change avatar ===
  const handleChangeAvatar = async () => {
    if (!clerkUserId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission Required", "Camera roll permissions are required to change your avatar.");
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
      Alert.alert("Error", "Image compression failed. Please try again.");
      return;
    }

    const base64 = `data:image/jpeg;base64,${compressed.base64}`;
    if (base64.length > 900000) {
      Alert.alert("Error", "Image too large, please choose a smaller one.");
      return;
    }

    await updateDoc(doc(db, "users", clerkUserId), { avatar: base64 });
    setProfileData((p: any) => ({
      ...p,
      firebaseData: { ...p.firebaseData, avatar: base64 },
    }));
  };

  if (!isLoaded || loading) {
    return (
      <Box flex={1} bg="#121212" justifyContent="center" alignItems="center">
        <Text color="#a0a0a0">Loading profile...</Text>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box flex={1} bg="#121212" justifyContent="center" alignItems="center">
        <Text color="#a0a0a0">Please sign in to view your profile</Text>
        <Button mt="$4" bg="#3a7bd5" onPress={() => router.push("/(auth)/Login")}>
          <Text color="white">Sign In</Text>
        </Button>
      </Box>
    );
  }

  const display = {
    firstName: profileData.firebaseData.first_name || profileData.clerkData.firstName,
    lastName: profileData.firebaseData.last_name || profileData.clerkData.lastName,
    username: profileData.firebaseData.username || profileData.clerkData.username,
    email: profileData.clerkData.email,
    gender: profileData.firebaseData.gender,
    avatar: profileData.firebaseData.avatar,
    ridesJoined: profileData.firebaseData.ridesJoined,
    ridesHosted: profileData.firebaseData.ridesHosted,
    blockedUsers: profileData.firebaseData.blockedUsers || [],
  };

  const initials = (display.firstName?.[0] || "") + (display.lastName?.[0] || "") || "U";

  return (
    <Box flex={1} bg="#121212">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <Box px="$4" py="$6">
            {/* Header */}
            <HStack justifyContent="space-between" alignItems="center" mb="$6" mt="$8">
              <Heading size="xl" color="white">
                {isEditing ? "Edit Profile" : "Your Profile"}
              </Heading>
              {!isEditing && (
                <TouchableOpacity
                  onPress={() => router.push("/(stack)/settings/settings")}
                  style={{
                    padding: 8,
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
              <TouchableOpacity onPress={isEditing ? handleChangeAvatar : undefined} style={{ marginBottom: 24 }}>
                <Avatar size="2xl" bg="#1e1e1e" borderRadius="$full">
                  {display.avatar ? (
                    <AvatarImage source={{ uri: display.avatar }} alt="Avatar" />
                  ) : (
                    <Avatar.FallbackText color="white">{initials}</Avatar.FallbackText>
                  )}
                </Avatar>
                {isEditing && <Text mt="$2" color="#3a7bd5">Tap to change photo</Text>}
              </TouchableOpacity>

              {/* Stats */}
              <HStack space="xl" w="100%" justifyContent="space-evenly">
                <VStack alignItems="center">
                  <Text color="#a0a0a0">Rides Joined</Text>
                  <Text color="white" fontWeight="$bold" fontSize="$xl">
                    {display.ridesJoined}
                  </Text>
                </VStack>
                <VStack alignItems="center">
                  <Text color="#a0a0a0">Rides Hosted</Text>
                  <Text color="white" fontWeight="$bold" fontSize="$xl">
                    {display.ridesHosted}
                  </Text>
                </VStack>
              </HStack>

              {/* Form / Display */}
              <VStack space="sm" w="100%" mt="$6">
                {isEditing ? (
                  <>
                    <Text color="#a0a0a0">First Name</Text>
                    <Input bg="#1e1e1e" borderColor={formErrors.firstName ? "#ff6b6b" : "#333"}>
                      <InputField color="white" value={formData.firstName} onChangeText={(t) => handleTextChange("firstName", t)} />
                    </Input>
                    {formErrors.firstName && <Text color="#ff6b6b" fontSize="$sm" mt="$1">{formErrors.firstName}</Text>}

                    <Text color="#a0a0a0" mt="$4">Last Name</Text>
                    <Input bg="#1e1e1e" borderColor={formErrors.lastName ? "#ff6b6b" : "#333"}>
                      <InputField color="white" value={formData.lastName} onChangeText={(t) => handleTextChange("lastName", t)} />
                    </Input>
                    {formErrors.lastName && <Text color="#ff6b6b" fontSize="$sm" mt="$1">{formErrors.lastName}</Text>}

                    <Text color="#a0a0a0" mt="$4">Username</Text>
                    <Input bg="#1e1e1e" borderColor={formErrors.username ? "#ff6b6b" : "#333"}>
                      <InputField color="white" value={formData.username} onChangeText={(t) => handleTextChange("username", t)} />
                    </Input>
                    {formErrors.username && <Text color="#ff6b6b" fontSize="$sm" mt="$1">{formErrors.username}</Text>}

                    <Text color="#a0a0a0" mt="$4">Gender (optional — helps us keep riders safe)</Text>
                    <Text color="#666" fontSize="$xs" mb="$2">
                      We only ask so safety features can work. It’s completely optional, never shared, and you can remove it anytime.
                    </Text>
                    <HStack space="sm" w="100%">
                      {(["M", "F", "NB"] as Gender[]).map((option) => (
                        <TouchableOpacity
                          key={option}
                          onPress={() => setFormData({ ...formData, gender: option })}
                          style={{
                            flex: 1,
                            padding: 12,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: formData.gender === option ? "#3a7bd5" : "#333",
                            backgroundColor: formData.gender === option ? "#1a3a7b" : "#1e1e1e",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: formData.gender === option ? "#ffffff" : "#a0a0a0",
                              fontSize: 14,
                              fontWeight: formData.gender === option ? "600" : "400",
                            }}
                          >
                            {option === "M" ? "Male" : option === "F" ? "Female" : "Non-binary"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </HStack>
                    <TouchableOpacity
                      onPress={() => setFormData({ ...formData, gender: null })}
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: formData.gender === null ? "#3a7bd5" : "#333",
                        backgroundColor: formData.gender === null ? "#1a3a7b" : "transparent",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: formData.gender === null ? "#ffffff" : "#a0a0a0",
                          fontSize: 14,
                          fontWeight: formData.gender === null ? "600" : "400",
                        }}
                      >
                        Prefer not to say
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text color="#a0a0a0">Name</Text>
                    <Text color="white" fontSize="$lg" fontWeight="$semibold">
                      {display.firstName} {display.lastName}
                    </Text>

                    <Text color="#a0a0a0" mt="$4">Username</Text>
                    <Text color="white" fontSize="$lg" fontWeight="$semibold">
                      {display.username || "Not set"}
                    </Text>

                    <Text color="#a0a0a0" mt="$4">Gender (optional — helps us keep riders safe)</Text>
                    <Text color="white" fontSize="$lg" fontWeight="$semibold">
                      {display.gender === "M"
                        ? "Male"
                        : display.gender === "F"
                        ? "Female"
                        : display.gender === "NB"
                        ? "Non-binary"
                        : "Not specified"}
                    </Text>
                    <Text color="#666" fontSize="$xs" mt="$1">
                      We only use this for safety features and never share it elsewhere.
                    </Text>
                  </>
                )}
                <Text color="#a0a0a0" mt="$4">Email</Text>
                <Text color="white" fontSize="$lg" fontWeight="$semibold">
                  {display.email}
                </Text>
              </VStack>

              {/* Buttons */}
              <VStack space="md" mt="$8" w="100%" pb="$6">
                {isEditing ? (
                  <>
                    <Button bg="#3a7bd5" onPress={handleUpdateProfile}>
                      <Text color="white" fontWeight="$semibold">Save Changes</Text>
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
                  <Button variant="outline" borderColor="#333" onPress={() => setIsEditing(true)}>
                    <Text color="white">Edit Profile</Text>
                  </Button>
                )}
              </VStack>
            </VStack>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
    </Box>
  );
}