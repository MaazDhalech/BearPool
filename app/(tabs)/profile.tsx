import { db } from "@/services/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  HStack,
  Heading,
  Input,
  InputField,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  VStack
} from "@gluestack-ui/themed";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Platform, TouchableOpacity } from "react-native";

// Default avatar image (can be a placeholder image URL or base64 string)
const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function ProfileScreen() {
  const { isLoaded, userId: clerkUserId, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  type Gender = "M" | "F" | "NB" | null;
  
    const [formData, setFormData] = useState({
      firstName: "",
      lastName: "",
      username: "",
      gender: null as Gender,
      genderPref: "N",
    });

  useEffect(() => {
    if (!isLoaded || !clerkUserId || !user) return;

    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, "users", clerkUserId);
        const userSnap = await getDoc(userDocRef);

        const firebaseData = userSnap.exists()
          ? {
              ...userSnap.data(),
              avatar:
                typeof userSnap.data().avatar === "string"
                  ? userSnap.data().avatar
                  : DEFAULT_AVATAR,
            }
          : {
              avatar: DEFAULT_AVATAR,
              pref: "N",
              username: user.username || "",
              ridesJoined: 0,
              ridesHosted: 0,
              createdAt: new Date(),
              gender: null,
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
          genderPref: firebaseData.pref || "N",
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [isLoaded, clerkUserId, user]);

  const handleUpdateProfile = async () => {
    if (!clerkUserId || !user) return;
    try {
      // update Clerk
      await user.update({
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      // update Firestore
      const updatedData = {
        username: formData.username,
        pref: formData.genderPref,
        gender: formData.gender,
        email: user.primaryEmailAddress?.emailAddress || "",
        first_name: formData.firstName,
        last_name: formData.lastName,
        avatar: profileData.firebaseData.avatar,
        createdAt: profileData.firebaseData.createdAt,
        ridesJoined: profileData.firebaseData.ridesJoined,
        ridesHosted: profileData.firebaseData.ridesHosted,
      };
      await setDoc(doc(db, "users", clerkUserId), updatedData);

      setProfileData({
        clerkData: {
          ...profileData.clerkData,
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: formData.username,
        },
        firebaseData: updatedData,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  const handleChangeAvatar = async () => {
    if (!clerkUserId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert("Camera roll permissions required");
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
      alert("Image compression failed");
      return;
    }
    const base64 = `data:image/jpeg;base64,${compressed.base64}`;
    if (base64.length > 900000) {
      alert("Image too large, choose a smaller one");
      return;
    }
    await updateDoc(doc(db, "users", clerkUserId), { avatar: base64 });
    setProfileData((p: any) => ({
      ...p,
      firebaseData: { ...p.firebaseData, avatar: base64 },
    }));
  };

  const handleLogout = async () => {
    if (!isLoaded) return;

    try {
      await signOut();
      router.replace("/(auth)/Login");
    } catch (err) {
      console.error("Error signing out:", err);
    }
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
        <Button
          mt="$4"
          bg="#3a7bd5"
          onPress={() => router.push("/(auth)/Login")}
        >
          <Text color="white">Sign In</Text>
        </Button>
      </Box>
    );
  }

  const display = {
    firstName:
      profileData.firebaseData.first_name || profileData.clerkData.firstName,
    lastName:
      profileData.firebaseData.last_name || profileData.clerkData.lastName,
    username:
      profileData.firebaseData.username || profileData.clerkData.username,
    email: profileData.clerkData.email,
    gender: profileData.firebaseData.gender,
    genderPref: profileData.firebaseData.pref,
    avatar: profileData.firebaseData.avatar,
    ridesJoined: profileData.firebaseData.ridesJoined,
    ridesHosted: profileData.firebaseData.ridesHosted,
  };

  const initials =
    (display.firstName?.[0] || "") + (display.lastName?.[0] || "") || "U";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 120 }}>
        <Box flex={1} bg="#121212" px="$4" py="$6">
          <Heading size="xl" color="white" mb="$6" mt="$8">
            {isEditing ? "Edit Profile" : "Your Profile"}
          </Heading>

          <VStack space="lg" alignItems="center">
            <TouchableOpacity
              onPress={isEditing ? handleChangeAvatar : undefined}
              style={{ marginBottom: 24 }}
            >
              <Avatar size="2xl" bg="#1e1e1e" borderRadius="$full">
                {display.avatar ? (
                  <AvatarImage source={{ uri: display.avatar }} alt="Avatar" />
                ) : (
                  <Avatar.FallbackText color="white">
                    {initials}
                  </Avatar.FallbackText>
                )}
              </Avatar>
              {isEditing && (
                <Text mt="$2" color="#3a7bd5">
                  Tap to change photo
                </Text>
              )}
            </TouchableOpacity>

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

            <VStack space="sm" w="100%" mt="$6">
              {isEditing ? (
                <>
                  <Text color="#a0a0a0">First Name</Text>
                  <Input bg="#1e1e1e" borderColor="#333">
                    <InputField
                      color="white"
                      value={formData.firstName}
                      onChangeText={(t) =>
                        setFormData({ ...formData, firstName: t })
                      }
                    />
                  </Input>

                  <Text color="#a0a0a0">Last Name</Text>
                  <Input bg="#1e1e1e" borderColor="#333">
                    <InputField
                      color="white"
                      value={formData.lastName}
                      onChangeText={(t) =>
                        setFormData({ ...formData, lastName: t })
                      }
                    />
                  </Input>

                  <Text color="#a0a0a0">Username</Text>
                  <Input bg="#1e1e1e" borderColor="#333">
                    <InputField
                      color="white"
                      value={formData.username}
                      onChangeText={(t) =>
                        setFormData({ ...formData, username: t })
                      }
                    />
                  </Input>

                  <Text color="#a0a0a0" mt="$4">
                    Gender
                  </Text>
                  <HStack space="sm" w="100%">
                    {(["M", "F", "NB"] as Gender[]).map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() =>
                          setFormData({ ...formData, gender: option })
                        }
                        style={{
                          flex: 1,
                          padding: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor:
                            formData.gender === option ? "#3a7bd5" : "#333",
                          backgroundColor:
                            formData.gender === option ? "#1a3a7b" : "#1e1e1e",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color:
                              formData.gender === option
                                ? "#ffffff"
                                : "#a0a0a0",
                            fontSize: 14,
                            fontWeight:
                              formData.gender === option ? "600" : "400",
                          }}
                        >
                          {option === "M"
                            ? "Male"
                            : option === "F"
                            ? "Female"
                            : "Non-binary"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </HStack>
                </>
              ) : (
                <>
                  <Text color="#a0a0a0">Name</Text>
                  <Text color="white" fontSize="$lg" fontWeight="$semibold">
                    {display.firstName} {display.lastName}
                  </Text>

                  <Text color="#a0a0a0" mt="$4">
                    Username
                  </Text>
                  <Text color="white" fontSize="$lg" fontWeight="$semibold">
                    {display.username || "Not set"}
                  </Text>

                  <Text color="#a0a0a0" mt="$4">
                    Gender
                  </Text>
                  <Text color="white" fontSize="$lg" fontWeight="$semibold">
                    {display.gender === "M"
                      ? "Male"
                      : display.gender === "F"
                      ? "Female"
                      : display.gender === "NB"
                      ? "Non-binary"
                      : "Not specified"}
                  </Text>
                </>
              )}
              <Text color="#a0a0a0" mt="$4">
                Email
              </Text>
              <Text color="white" fontSize="$lg" fontWeight="$semibold">
                {display.email}
              </Text>
              <Text color="#a0a0a0" mt="$4">
                Gender Preference
              </Text>
              {isEditing ? (
                <VStack space="sm" w="100%">
                  {/* First row */}
                  <HStack space="sm" w="100%">
                    {(["N", "M"] as const).map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() =>
                          setFormData({ ...formData, genderPref: option })
                        }
                        style={{
                          flex: 1,
                          padding: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor:
                            formData.genderPref === option ? "#3a7bd5" : "#333",
                          backgroundColor:
                            formData.genderPref === option
                              ? "#1a3a7b"
                              : "#1e1e1e",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color:
                              formData.genderPref === option
                                ? "#ffffff"
                                : "#a0a0a0",
                            fontSize: 14,
                            fontWeight:
                              formData.genderPref === option ? "600" : "400",
                          }}
                        >
                          {option === "N" ? "No Preference" : "Male Only"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </HStack>

                  {/* Second row */}
                  <HStack space="sm" w="100%">
                    {(["F", "NB"] as const).map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() =>
                          setFormData({ ...formData, genderPref: option })
                        }
                        style={{
                          flex: 1,
                          padding: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor:
                            formData.genderPref === option ? "#3a7bd5" : "#333",
                          backgroundColor:
                            formData.genderPref === option
                              ? "#1a3a7b"
                              : "#1e1e1e",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            color:
                              formData.genderPref === option
                                ? "#ffffff"
                                : "#a0a0a0",
                            fontSize: 14,
                            fontWeight:
                              formData.genderPref === option ? "600" : "400",
                          }}
                        >
                          {option === "F" ? "Female Only" : "Non-binary Only"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </HStack>
                </VStack>
              ) : (
                <Text color="white" fontSize="$lg" fontWeight="$semibold">
                  {display.genderPref === "N"
                    ? "No Preference"
                    : display.genderPref === "M"
                    ? "Male Only"
                    : display.genderPref === "F"
                    ? "Female Only"
                    : "Non-binary Only"}
                </Text>
              )}
            </VStack>

            <VStack space="md" mt="$8" w="100%">
              {isEditing ? (
                <>
                  <Button bg="#3a7bd5" onPress={handleUpdateProfile}>
                    <Text color="white" fontWeight="$semibold">
                      Save Changes
                    </Text>
                  </Button>
                  <Button
                    variant="outline"
                    borderColor="#333"
                    onPress={() => setIsEditing(false)}
                  >
                    <Text color="white">Cancel</Text>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    borderColor="#333"
                    onPress={() => setIsEditing(true)}
                  >
                    <Text color="white">Edit Profile</Text>
                  </Button>
                  <Button bg="#3a7bd5" onPress={handleLogout}>
                    <Text color="white" fontWeight="$semibold">
                      Log Out
                    </Text>
                  </Button>
                </>
              )}
            </VStack>
          </VStack>
        </Box>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
