import { db } from "@/services/firebaseConfig";
import { useAuth, useUser } from "@clerk/clerk-expo";
import {
  Avatar,
  AvatarImage,
  Box,
  Button,
  CloseIcon,
  HStack,
  Heading,
  Icon,
  Input,
  InputField,
  KeyboardAvoidingView,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ScrollView,
  Text,
  VStack
} from "@gluestack-ui/themed";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  arrayRemove,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, Platform, TouchableOpacity } from "react-native";

// Import bad-words with error handling
let Filter: any = null;
let filter: any = null;

try {
  // Try to import bad-words
  const BadWordsModule = require("bad-words");
  Filter = BadWordsModule.default || BadWordsModule;
  filter = new Filter();
} catch (error) {
  console.warn("Bad-words library not available, using fallback filter:", error);
  
  // Fallback implementation with basic profanity list
  const basicProfanityList = [
    'damn', 'hell', 'shit', 'fuck', 'bitch', 'ass', 'crap', 'piss'
    // Add more words as needed
  ];
  
  filter = {
    isProfane: (text: string) => {
      const lowerText = text.toLowerCase();
      return basicProfanityList.some(word => lowerText.includes(word));
    },
    clean: (text: string) => {
      let cleanText = text;
      basicProfanityList.forEach(word => {
        const regex = new RegExp(word, 'gi');
        cleanText = cleanText.replace(regex, '*'.repeat(word.length));
      });
      return cleanText;
    }
  };
}

// Add custom words if the library is available
if (filter && typeof filter.addWords === 'function') {
  // filter.addWords(['customword1', 'customword2']);
}

// Default avatar image (can be a placeholder image URL or base64 string)
const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

interface BlockedUser {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string;
}

export default function ProfileScreen() {
  const { isLoaded, userId: clerkUserId, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
  
  type Gender = "M" | "F" | "NB" | null;
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    gender: null as Gender,
    genderPref: "N",
  });

  // Single validation function that handles both checking and user feedback
  const validateAndCleanText = (text: string, fieldName: string): { isValid: boolean; cleanedText: string; error?: string } => {
    if (!text.trim()) {
      return { isValid: true, cleanedText: text };
    }
    
    if (filter.isProfane(text)) {
      const cleanedText = filter.clean(text);
      return {
        isValid: false,
        cleanedText,
        error: `The ${fieldName} contains inappropriate content.`
      };
    }
    
    return { isValid: true, cleanedText: text };
  };

  // Real-time validation with user feedback
  const handleTextChange = (field: keyof typeof formData, value: string) => {
    // Update form data immediately for responsive UI
    setFormData({ ...formData, [field]: value });
    
    // Clear previous error for this field
    if (formErrors[field]) {
      setFormErrors({ ...formErrors, [field]: '' });
    }
    
    // Validate and show immediate feedback if needed
    if (value.trim()) {
      const validation = validateAndCleanText(value, field);
      if (!validation.isValid) {
        setFormErrors({ 
          ...formErrors, 
          [field]: validation.error || `${field} contains inappropriate content` 
        });
      }
    }
  };

  // Fetch blocked users data
  const fetchBlockedUsers = async () => {
    if (!clerkUserId || !profileData?.firebaseData?.blockedUsers) return;
    
    setLoadingBlockedUsers(true);
    try {
      const blockedUserIds = profileData.firebaseData.blockedUsers;
      if (blockedUserIds.length === 0) {
        setBlockedUsers([]);
        return;
      }

      // Fetch blocked users data in batches (Firestore 'in' query limit is 10)
      const blockedUsersData: BlockedUser[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < blockedUserIds.length; i += batchSize) {
        const batch = blockedUserIds.slice(i, i + batchSize);
        const q = query(
          collection(db, "users"),
          where("__name__", "in", batch)
        );
        
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          blockedUsersData.push({
            id: doc.id,
            username: data.username || "Unknown",
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            avatar: data.avatar || DEFAULT_AVATAR,
          });
        });
      }
      
      setBlockedUsers(blockedUsersData);
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      Alert.alert("Error", "Failed to load blocked users.");
    } finally {
      setLoadingBlockedUsers(false);
    }
  };

  // Unblock a user
  const handleUnblockUser = async (userId: string, username: string) => {
    if (!clerkUserId) return;

    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock ${username}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          style: "destructive",
          onPress: async () => {
            try {
              // Remove user from blockedUsers array
              await updateDoc(doc(db, "users", clerkUserId), {
                blockedUsers: arrayRemove(userId)
              });

              // Update local state
              setBlockedUsers(prev => prev.filter(user => user.id !== userId));
              setProfileData((prev: any) => ({
                ...prev,
                firebaseData: {
                  ...prev.firebaseData,
                  blockedUsers: prev.firebaseData.blockedUsers?.filter((id: string) => id !== userId) || []
                }
              }));

              Alert.alert("Success", `${username} has been unblocked.`);
            } catch (error) {
              console.error("Error unblocking user:", error);
              Alert.alert("Error", "Failed to unblock user. Please try again.");
            }
          }
        }
      ]
    );
  };

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
              blockedUsers: userSnap.data().blockedUsers || [], // Ensure blockedUsers exists
            }
          : {
              avatar: DEFAULT_AVATAR,
              pref: "N",
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

  // Fetch blocked users when modal opens
  useEffect(() => {
    if (showBlockedUsers && profileData) {
      fetchBlockedUsers();
    }
  }, [showBlockedUsers, profileData]);

  const handleUpdateProfile = async () => {
    if (!clerkUserId || !user) return;
    
    // Validate all fields
    const validations = {
      firstName: validateAndCleanText(formData.firstName, "first name"),
      lastName: validateAndCleanText(formData.lastName, "last name"),
      username: validateAndCleanText(formData.username, "username"),
    };

    // Check if any validation failed
    const hasErrors = Object.values(validations).some(v => !v.isValid);
    
    if (hasErrors) {
      // Show which fields have issues
      const errorMessages = Object.entries(validations)
        .filter(([_, validation]) => !validation.isValid)
        .map(([field, validation]) => `${field}: ${validation.error}`)
        .join('\n');
      
      Alert.alert(
        "Content Issues Found",
        `Please fix the following issues:\n\n${errorMessages}`,
        [
          { text: "Edit", style: "cancel" }
        ]
      );
      return;
    }

    try {
      // Use the already validated data (which is clean)
      const cleanedData = {
        firstName: validations.firstName.cleanedText,
        lastName: validations.lastName.cleanedText,
        username: validations.username.cleanedText,
        gender: formData.gender,
        genderPref: formData.genderPref,
      };

      // Update Clerk
      await user.update({
        firstName: cleanedData.firstName,
        lastName: cleanedData.lastName,
      });

      // Update Firestore
      const updatedData = {
        username: cleanedData.username,
        pref: cleanedData.genderPref,
        gender: cleanedData.gender,
        email: user.primaryEmailAddress?.emailAddress || "",
        first_name: cleanedData.firstName,
        last_name: cleanedData.lastName,
        avatar: profileData.firebaseData.avatar,
        createdAt: profileData.firebaseData.createdAt,
        ridesJoined: profileData.firebaseData.ridesJoined,
        ridesHosted: profileData.firebaseData.ridesHosted,
        blockedUsers: profileData.firebaseData.blockedUsers || [], // Preserve blockedUsers
      };
      
      await setDoc(doc(db, "users", clerkUserId), updatedData);

      setProfileData({
        clerkData: {
          ...profileData.clerkData,
          firstName: cleanedData.firstName,
          lastName: cleanedData.lastName,
          username: cleanedData.username,
        },
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

  const handleLogout = async () => {
    if (!isLoaded) return;

    try {
      await signOut();
      router.replace("/(auth)/Login");
    } catch (err) {
      console.error("Error signing out:", err);
      Alert.alert("Error", "Failed to sign out. Please try again.");
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
    blockedUsers: profileData.firebaseData.blockedUsers || [],
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
                  <Input bg="#1e1e1e" borderColor={formErrors.firstName ? "#ff6b6b" : "#333"}>
                    <InputField
                      color="white"
                      value={formData.firstName}
                      onChangeText={(t) => handleTextChange('firstName', t)}
                    />
                  </Input>
                  {formErrors.firstName && (
                    <Text color="#ff6b6b" fontSize="$sm" mt="$1">
                      {formErrors.firstName}
                    </Text>
                  )}

                  <Text color="#a0a0a0" mt="$4">Last Name</Text>
                  <Input bg="#1e1e1e" borderColor={formErrors.lastName ? "#ff6b6b" : "#333"}>
                    <InputField
                      color="white"
                      value={formData.lastName}
                      onChangeText={(t) => handleTextChange('lastName', t)}
                    />
                  </Input>
                  {formErrors.lastName && (
                    <Text color="#ff6b6b" fontSize="$sm" mt="$1">
                      {formErrors.lastName}
                    </Text>
                  )}

                  <Text color="#a0a0a0" mt="$4">Username</Text>
                  <Input bg="#1e1e1e" borderColor={formErrors.username ? "#ff6b6b" : "#333"}>
                    <InputField
                      color="white"
                      value={formData.username}
                      onChangeText={(t) => handleTextChange('username', t)}
                    />
                  </Input>
                  {formErrors.username && (
                    <Text color="#ff6b6b" fontSize="$sm" mt="$1">
                      {formErrors.username}
                    </Text>
                  )}

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
                    onPress={() => {
                      setIsEditing(false);
                      setFormErrors({});
                    }}
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
                  
                  {/* Unblock Users Button */}
                  <Button
                    variant="outline"
                    borderColor="#ff6b6b"
                    onPress={() => setShowBlockedUsers(true)}
                  >
                    <Text color="#ff6b6b">
                      Unblock Users ({display.blockedUsers.length})
                    </Text>
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

      {/* Blocked Users Modal */}
      <Modal
        isOpen={showBlockedUsers}
        onClose={() => setShowBlockedUsers(false)}
        finalFocusRef={undefined}
      >
        <ModalBackdrop />
        <ModalContent bg="#1e1e1e" maxWidth="$96" maxHeight="$3/4">
          <ModalHeader>
            <Heading size="lg" color="white">
              Blocked Users
            </Heading>
            <ModalCloseButton>
              <Icon as={CloseIcon} color="white" />
            </ModalCloseButton>
          </ModalHeader>
          <ModalBody>
            {loadingBlockedUsers ? (
              <Box py="$4" alignItems="center">
                <Text color="#a0a0a0">Loading blocked users...</Text>
              </Box>
            ) : blockedUsers.length === 0 ? (
              <Box py="$4" alignItems="center">
                <Text color="#a0a0a0">No blocked users</Text>
              </Box>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <VStack space="md" py="$2">
                  {blockedUsers.map((blockedUser) => (
                    <HStack
                      key={blockedUser.id}
                      space="md"
                      alignItems="center"
                      bg="#2a2a2a"
                      p="$3"
                      borderRadius="$md"
                    >
                      <Avatar size="md" bg="#333">
                        {blockedUser.avatar ? (
                          <AvatarImage
                            source={{ uri: blockedUser.avatar }}
                            alt="Avatar"
                          />
                        ) : (
                          <Avatar.FallbackText color="white">
                            {((blockedUser.first_name?.[0] || "") + 
                              (blockedUser.last_name?.[0] || "")) || "U"}
                          </Avatar.FallbackText>
                        )}
                      </Avatar>
                      
                      <VStack flex={1}>
                        <Text color="white" fontWeight="$semibold">
                          {blockedUser.username}
                        </Text>
                        <Text color="#a0a0a0" fontSize="$sm">
                          {blockedUser.first_name} {blockedUser.last_name}
                        </Text>
                      </VStack>
                      
                      <Button
                        size="sm"
                        bg="#ff6b6b"
                        onPress={() => handleUnblockUser(blockedUser.id, blockedUser.username)}
                      >
                        <Text color="white" fontSize="$sm">
                          Unblock
                        </Text>
                      </Button>
                    </HStack>
                  ))}
                </VStack>
              </ScrollView>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </KeyboardAvoidingView>
  );
}