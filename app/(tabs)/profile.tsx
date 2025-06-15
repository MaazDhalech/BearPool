import { db } from "@/services/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
import {
  Avatar,
  Box,
  Button,
  ChevronDownIcon,
  HStack,
  Heading,
  Icon,
  Input,
  InputField,
  KeyboardAvoidingView,
  ScrollView,
  Select,
  SelectBackdrop,
  SelectContent,
  SelectDragIndicator,
  SelectDragIndicatorWrapper,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Platform, TouchableOpacity } from "react-native";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

export default function ProfileScreen() {
  const { isLoaded, userId: clerkUserId, signOut } = useAuth();
  const { user } = useUser();
  const [firebaseUserId, setFirebaseUserId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    genderPref: "N",
  });

  useEffect(() => {
    if (!isLoaded || !clerkUserId || !user) return;

    const fetchUserData = async () => {
      try {
        const usersRef = collection(db, "users");
        const q = query(
          usersRef,
          where("email", "==", user.primaryEmailAddress?.emailAddress)
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          setFirebaseUserId(userDoc.id);

          const userData = userDoc.data();
          const combinedData = {
            clerkData: {
              email: user.primaryEmailAddress?.emailAddress,
              firstName: user.firstName,
              lastName: user.lastName,
              username: user.username,
            },
            firebaseData: {
              ...userData,
              avatar:
                typeof userData.avatar === "string"
                  ? userData.avatar
                  : DEFAULT_AVATAR,
            },
          };

          setProfileData(combinedData);

          setFormData({
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            username: userData.username || user.username || "",
            genderPref: userData.pref || "N",
          });
        } else {
          console.warn("No Firestore user found for Clerk user");
          setProfileData({
            clerkData: {
              email: user.primaryEmailAddress?.emailAddress,
              firstName: user.firstName,
              lastName: user.lastName,
              username: user.username,
            },
            firebaseData: {
              avatar: DEFAULT_AVATAR,
              pref: "N",
              username: user.username || "",
              ridesJoined: 0,
              ridesHosted: 0,
            },
          });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [isLoaded, clerkUserId, user]);

  const handleUpdateProfile = async () => {
    if (!firebaseUserId || !user) return;

    try {
      await user.update({
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      await updateDoc(doc(db, "users", firebaseUserId), {
        username: formData.username,
        pref: formData.genderPref,
        email: user.primaryEmailAddress?.emailAddress,
        first_name: formData.firstName,
        last_name: formData.lastName,
        avatar: profileData?.firebaseData?.avatar || DEFAULT_AVATAR,
        createdAt: profileData?.firebaseData?.createdAt || new Date(),
        ridesJoined: profileData?.firebaseData?.ridesJoined || 0,
        ridesHosted: profileData?.firebaseData?.ridesHosted || 0,
      });

      const userDoc = await getDoc(doc(db, "users", firebaseUserId));
      const userData = userDoc.data();
      setProfileData({
        clerkData: {
          email: user.primaryEmailAddress?.emailAddress,
          firstName: formData.firstName,
          lastName: formData.lastName,
          username: user.username,
        },
        firebaseData: {
          ...userData,
          avatar:
            typeof userData?.avatar === "string"
              ? userData.avatar
              : DEFAULT_AVATAR,
        },
      });

      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  const handleChangeAvatar = async () => {
    if (!firebaseUserId) return;

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      alert("Permission to access camera roll is required!");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!pickerResult.canceled && pickerResult.assets?.[0]?.uri) {
      try {
        const manipResult = await ImageManipulator.manipulateAsync(
          pickerResult.assets[0].uri,
          [{ resize: { width: 400 } }],
          {
            compress: 0.4,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );

        if (!manipResult.base64) throw new Error("Compression failed");

        const base64String = `data:image/jpeg;base64,${manipResult.base64}`;

        if (base64String.length > 900000) {
          throw new Error("Image is still too large after compression");
        }

        await updateDoc(doc(db, "users", firebaseUserId), {
          avatar: base64String,
        });

        setProfileData((prev: any) => ({
          ...prev,
          firebaseData: {
            ...prev.firebaseData,
            avatar: base64String,
          },
        }));
      } catch (error) {
        console.error("Error updating avatar:", error);
        alert("Image is too large. Please choose a smaller file.");
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace("/(auth)/Login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!isLoaded || loading) {
    return (
      <Box
        flex={1}
        justifyContent="center"
        alignItems="center"
        bg="#121212"
      >
        <Text color="#a0a0a0">Loading profile...</Text>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box
        flex={1}
        justifyContent="center"
        alignItems="center"
        bg="#121212"
      >
        <Text color="#a0a0a0">Please sign in to view your profile</Text>
        <Button mt="$4" bg="#3a7bd5" onPress={() => router.push("/(auth)/Login")}>
          <Text color="white">Sign In</Text>
        </Button>
      </Box>
    );
  }

  const displayData = {
    firstName:
      profileData?.firebaseData?.first_name ||
      profileData?.clerkData?.firstName ||
      "",
    lastName:
      profileData?.firebaseData?.last_name ||
      profileData?.clerkData?.lastName ||
      "",
    username:
      profileData?.firebaseData?.username ||
      profileData?.clerkData?.username ||
      "",
    email: profileData?.clerkData?.email || "",
    genderPref: profileData?.firebaseData?.pref || "N",
    avatar: profileData?.firebaseData?.avatar || DEFAULT_AVATAR,
    ridesJoined: profileData?.firebaseData?.ridesJoined || 0,
    ridesHosted: profileData?.firebaseData?.ridesHosted || 0,
  };

  const getInitials = () => {
    if (displayData.firstName && displayData.lastName) {
      return `${displayData.firstName[0]}${displayData.lastName[0]}`;
    }
    return displayData.username?.[0] || "U";
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Box flex={1} px="$4" py="$6" bg="#121212">
          <Heading size="xl" mt = "$10" mb="$6" color="white">
            {isEditing ? "Edit Profile" : "Your Profile"}
          </Heading>

          <VStack space="lg" alignItems="center" pb="$16">
            {/* Profile Picture */}
            <Box width="100%" alignItems="center" justifyContent="center" mb="$4">
              <TouchableOpacity
                onPress={isEditing ? handleChangeAvatar : undefined}
                style={{ alignItems: "center" }}
              >
                <Avatar size="2xl" borderRadius="$full" bgColor="#1e1e1e">
                  {displayData.avatar ? (
                    <Avatar.Image
                      source={{ uri: displayData.avatar }}
                      alt="Profile picture"
                    />
                  ) : (
                    <Avatar.FallbackText color="white">{getInitials()}</Avatar.FallbackText>
                  )}
                </Avatar>
                {isEditing && (
                  <Text mt="$2" textAlign="center" color="#3a7bd5">
                    Tap to change photo
                  </Text>
                )}
              </TouchableOpacity>
            </Box>

            {/* Stats */}
            <HStack space="xl" w="100%" justifyContent="space-between" px="$4">
              <Box alignItems="center">
                <Text fontSize="$md" color="#a0a0a0">
                  Rides Joined
                </Text>
                <Text fontWeight="$bold" fontSize="$xl" color="white">
                  {displayData.ridesJoined}
                </Text>
              </Box>
              <Box alignItems="center">
                <Text fontSize="$md" color="#a0a0a0">
                  Rides Hosted
                </Text>
                <Text fontWeight="$bold" fontSize="$xl" color="white">
                  {displayData.ridesHosted}
                </Text>
              </Box>
            </HStack>

            {/* Profile Info */}
            {isEditing ? (
              <>
                <VStack space="sm" w="100%">
                  <Text fontSize="$md" color="#a0a0a0">
                    First Name
                  </Text>
                  <Input bg="#1e1e1e" borderColor="#333">
                    <InputField
                      color="white"
                      value={formData.firstName}
                      onChangeText={(text) =>
                        setFormData({ ...formData, firstName: text })
                      }
                      returnKeyType="next"
                    />
                  </Input>
                </VStack>

                <VStack space="sm" w="100%">
                  <Text fontSize="$md" color="#a0a0a0">
                    Last Name
                  </Text>
                  <Input bg="#1e1e1e" borderColor="#333">
                    <InputField
                      color="white"
                      value={formData.lastName}
                      onChangeText={(text) =>
                        setFormData({ ...formData, lastName: text })
                      }
                      returnKeyType="next"
                    />
                  </Input>
                </VStack>

                <VStack space="sm" w="100%">
                  <Text fontSize="$md" color="#a0a0a0">
                    Username
                  </Text>
                  <Input bg="#1e1e1e" borderColor="#333">
                    <InputField
                      color="white"
                      value={formData.username}
                      onChangeText={(text) =>
                        setFormData({ ...formData, username: text })
                      }
                      returnKeyType="done"
                    />
                  </Input>
                </VStack>
              </>
            ) : (
              <>
                <VStack space="sm" w="100%" alignItems="flex-start">
                  <Text fontSize="$md" color="#a0a0a0">
                    Name
                  </Text>
                  <Text fontWeight="$semibold" fontSize="$lg" color="white">
                    {displayData.firstName} {displayData.lastName}
                  </Text>
                </VStack>

                <VStack space="sm" w="100%" alignItems="flex-start">
                  <Text fontSize="$md" color="#a0a0a0">
                    Username
                  </Text>
                  <Text fontWeight="$semibold" fontSize="$lg" color="white">
                    {displayData.username || "Not set"}
                  </Text>
                </VStack>
              </>
            )}

            <VStack space="sm" w="100%" alignItems="flex-start">
              <Text fontSize="$md" color="#a0a0a0">
                Email
              </Text>
              <Text fontWeight="$semibold" fontSize="$lg" color="white">
                {displayData.email}
              </Text>
            </VStack>

            {/* Gender Preference */}
            <VStack space="sm" w="100%">
              <Text fontSize="$md" color="#a0a0a0">
                Gender Preference
              </Text>
              {isEditing ? (
                <Select
                  selectedValue={formData.genderPref}
                  onValueChange={(value) =>
                    setFormData({ ...formData, genderPref: value })
                  }
                >
                  <SelectTrigger bg="#1e1e1e" borderColor="#333">
                    <SelectInput
                      color="white"
                      value={
                        formData.genderPref === "N"
                          ? "No Preference"
                          : formData.genderPref === "M"
                          ? "Male Only"
                          : formData.genderPref === "F"
                          ? "Female Only"
                          : formData.genderPref === "NB"
                          ? "Non-binary Only"
                          : ""
                      }
                    />
                    <SelectIcon>
                      <Icon as={ChevronDownIcon} color="#a0a0a0" />
                    </SelectIcon>
                  </SelectTrigger>

                  <SelectPortal>
                    <SelectBackdrop bg="rgba(0,0,0,0.7)" />
                    <SelectContent bg="#1e1e1e" borderColor="#333">
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator bg="#3a3a3a" />
                      </SelectDragIndicatorWrapper>
                      <SelectItem label="No Preference" value="N" />
                      <SelectItem label="Male Only" value="M" />
                      <SelectItem label="Female Only" value="F" />
                      <SelectItem label="Non-binary Only" value="NB" />
                    </SelectContent>
                  </SelectPortal>
                </Select>
              ) : (
                <Text fontWeight="$semibold" fontSize="$lg" color="white">
                  {formData.genderPref === "N"
                    ? "No Preference"
                    : formData.genderPref === "M"
                    ? "Male Only"
                    : formData.genderPref === "F"
                    ? "Female Only"
                    : formData.genderPref === "NB"
                    ? "Non-binary Only"
                    : ""}
                </Text>
              )}
            </VStack>

            {/* Action Buttons */}
            <VStack space="md" mt="$6" w="100%">
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
                  <Button bg="#d53a3a" onPress={handleLogout}>
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