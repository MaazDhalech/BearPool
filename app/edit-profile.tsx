import { ACCENT } from "@/constants/Colors";
import { TYPE } from "@/constants/Typography";
import { SPACE } from "@/constants/Spacing";
import { ActionButton } from "@/components/ui/ActionButton";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
  Avatar,
  AvatarImage,
  HStack,
  Input,
  InputField,
  Text,
} from "@gluestack-ui/themed";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as filter from "leo-profanity";

filter.add(["ridehate", "berkeleybully"]);

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg";

type Gender = "M" | "F" | "NB" | null;

export default function EditProfileScreen() {
  const { userId } = useFirebaseAuth();
  const insets = useSafeAreaInsets();

  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    gender: null as Gender,
  });

  // === Load profile data ===
  useEffect(() => {
    if (!userId) return;
    const fetchUserData = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", userId));
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
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [userId]);

  // === Single validation using leo-profanity ===
  const validateAndCleanText = (
    text: string,
    fieldName: string,
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

  // === Save profile ===
  const handleUpdateProfile = async () => {
    if (!userId || !profileData) return;

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
        [{ text: "Edit", style: "cancel" }],
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
      setFormErrors({});

      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
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
        "We need access to your camera roll so you can choose a photo for your profile picture. Your photos are only used for your avatar and never shared without your permission.",
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
      { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );

    if (!compressed.base64) {
      Alert.alert(
        "Image Processing Failed",
        "We couldn't process your image. This might happen if the file is corrupted or in an unsupported format. Please try selecting a different image or take a new photo.",
      );
      return;
    }

    const base64 = `data:image/jpeg;base64,${compressed.base64}`;
    if (base64.length > 900000) {
      Alert.alert(
        "Image Too Large",
        "The selected image is too large to upload (max 900KB). Please choose a smaller image or try taking a new photo with your camera app set to a lower resolution.",
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

  const avatar = profileData?.firebaseData?.avatar;
  const initials =
    (formData.firstName?.[0] || "") + (formData.lastName?.[0] || "") || "U";
  const email = profileData?.firebaseData?.email || "";

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.headerSide}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerSide} />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: SPACE.lg, paddingBottom: SPACE["2xl"] }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Avatar */}
              <TouchableOpacity
                onPress={handleChangeAvatar}
                disabled={avatarUploading}
                style={{ alignItems: "center", marginBottom: SPACE["2xl"] }}
              >
                <View style={{ position: "relative" }}>
                  <Avatar size="2xl" bg="#1e1e1e" borderRadius="$full" opacity={avatarUploading ? 0.5 : 1}>
                    {avatar ? (
                      <AvatarImage source={{ uri: avatar }} alt="Avatar" />
                    ) : (
                      <Avatar.FallbackText color="white">{initials}</Avatar.FallbackText>
                    )}
                  </Avatar>
                  {/* Camera badge */}
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={15} color="#121212" />
                  </View>
                  {avatarUploading && (
                    <View style={styles.avatarSpinner}>
                      <ActivityIndicator size="small" color={ACCENT} />
                    </View>
                  )}
                </View>
                <Text style={{ color: avatarUploading ? "#666" : ACCENT, fontSize: TYPE.size.label, marginTop: SPACE.sm, fontWeight: TYPE.weight.semibold }}>
                  {avatarUploading ? "Uploading..." : "Change photo"}
                </Text>
              </TouchableOpacity>

              {/* First name */}
              <Text style={styles.label}>First Name</Text>
              <Input
                bg="#1e1e1e"
                borderWidth={1}
                borderColor={formErrors.firstName ? "#ff6b6b" : "#2a2a2a"}
                borderRadius="$xl"
                h="$12"
              >
                <InputField
                  color="white"
                  placeholder="First name"
                  placeholderTextColor="#555"
                  px="$4"
                  fontSize="$md"
                  value={formData.firstName}
                  onChangeText={(t) => handleTextChange("firstName", t)}
                />
              </Input>
              {formErrors.firstName ? <Text style={styles.error}>{formErrors.firstName}</Text> : null}

              {/* Last name */}
              <Text style={[styles.label, { marginTop: SPACE.lg }]}>Last Name</Text>
              <Input
                bg="#1e1e1e"
                borderWidth={1}
                borderColor={formErrors.lastName ? "#ff6b6b" : "#2a2a2a"}
                borderRadius="$xl"
                h="$12"
              >
                <InputField
                  color="white"
                  placeholder="Last name"
                  placeholderTextColor="#555"
                  px="$4"
                  fontSize="$md"
                  value={formData.lastName}
                  onChangeText={(t) => handleTextChange("lastName", t)}
                />
              </Input>
              {formErrors.lastName ? <Text style={styles.error}>{formErrors.lastName}</Text> : null}

              {/* Username */}
              <Text style={[styles.label, { marginTop: SPACE.lg }]}>Username</Text>
              <Input
                bg="#1e1e1e"
                borderWidth={1}
                borderColor={formErrors.username ? "#ff6b6b" : "#2a2a2a"}
                borderRadius="$xl"
                h="$12"
              >
                <InputField
                  color="white"
                  placeholder="Username"
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                  px="$4"
                  fontSize="$md"
                  value={formData.username}
                  onChangeText={(t) => handleTextChange("username", t)}
                />
              </Input>
              {formErrors.username ? <Text style={styles.error}>{formErrors.username}</Text> : null}

              {/* Gender */}
              <Text style={[styles.label, { marginTop: SPACE.lg }]}>Gender</Text>
              <Text style={styles.helper}>
                Optional. We only ask so safety features can work — never shared, removable anytime.
              </Text>
              <HStack space="sm" w="100%">
                {(["M", "F", "NB"] as Gender[]).map((option) => {
                  const selected = formData.gender === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.8}
                      onPress={() => setFormData({ ...formData, gender: option })}
                      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
                    >
                      <Text style={{
                        color: selected ? ACCENT : "#a0a0a0",
                        fontSize: TYPE.size.body,
                        fontWeight: selected ? TYPE.weight.semibold : TYPE.weight.regular,
                      }}>
                        {option === "M" ? "Male" : option === "F" ? "Female" : "Non-binary"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </HStack>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setFormData({ ...formData, gender: null })}
                style={[
                  styles.chip,
                  { marginTop: SPACE.sm },
                  formData.gender === null ? styles.chipOn : styles.chipOff,
                ]}
              >
                <Text style={{
                  color: formData.gender === null ? ACCENT : "#a0a0a0",
                  fontSize: TYPE.size.body,
                  fontWeight: formData.gender === null ? TYPE.weight.semibold : TYPE.weight.regular,
                }}>
                  Prefer not to say
                </Text>
              </TouchableOpacity>

              {/* Email (read-only) */}
              <Text style={[styles.label, { marginTop: SPACE.lg }]}>Email</Text>
              <View style={styles.readonly}>
                <Text style={{ color: "#cfcfcf", fontSize: TYPE.size.body }}>{email}</Text>
                <Ionicons name="lock-closed" size={14} color="#666" />
              </View>
            </ScrollView>

            {/* Sticky footer */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACE.md) }]}>
              <ActionButton label="Save Changes" onPress={handleUpdateProfile} />
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: "#1f1f1f",
  },
  headerSide: { width: 60 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#ffffff",
    fontSize: TYPE.size.subheading,
    fontWeight: TYPE.weight.bold,
  },
  cancel: { color: "#a0a0a0", fontSize: TYPE.size.body },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#121212",
  },
  avatarSpinner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#8a8a8a",
    fontSize: TYPE.size.label,
    fontWeight: TYPE.weight.semibold,
    marginBottom: SPACE.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  helper: { color: "#666", fontSize: TYPE.size.micro, marginBottom: SPACE.sm, lineHeight: TYPE.size.micro * 1.5 },
  error: { color: "#ff6b6b", fontSize: TYPE.size.label, marginTop: SPACE.xs },
  chip: {
    flex: 1,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.sm,
    borderRadius: 12,
    alignItems: "center",
  },
  chipOff: { backgroundColor: "#1e1e1e" },
  chipOn: { backgroundColor: "#3a2f12", borderWidth: 1, borderColor: ACCENT },
  readonly: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#181818",
    borderRadius: 12,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
  },
  footer: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: "#1f1f1f",
    backgroundColor: "#121212",
  },
});
