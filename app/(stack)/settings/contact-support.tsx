import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
    Box,
    Button,
    ButtonText,
    HStack,
    Heading,
    Input,
    InputField,
    ScrollView,
    Spinner,
    Text,
    Textarea,
    TextareaInput,
    VStack,
} from "@gluestack-ui/themed";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { NavHeader } from "@/components/ui/NavHeader";
import { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from "react-native";

const MAX_MESSAGE_LENGTH = 1000;

export default function ContactSupportScreen() {
  const { userId } = useFirebaseAuth();
  const router = useRouter();

  const [supportForm, setSupportForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitingSupport, setSubmitingSupport] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch user data to pre-fill form
  useEffect(() => {
    if (!userId) return;

    const fetchUserData = async () => {
      try {
        const userDocRef = doc(db, "users", userId);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setSupportForm((prev) => ({
            ...prev,
            name: `${userData.first_name || ""} ${
              userData.last_name || ""
            }`.trim(),
            email: userData.email || "",
          }));
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const handleGoBack = () => {
    router.back();
  };

  const handleSupportSubmit = async () => {
    if (
      !supportForm.name ||
      !supportForm.email ||
      !supportForm.subject ||
      !supportForm.message
    ) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setSubmitingSupport(true);
    try {
      const web3formsApiKey = Constants.expoConfig?.extra?.web3formsApiKey;

      if (!web3formsApiKey) {
        Alert.alert(
          "Error",
          "Support service is not configured. Please contact the administrator."
        );
        return;
      }

      const formData = new FormData();
      formData.append("access_key", web3formsApiKey);
      formData.append("name", supportForm.name);
      formData.append("email", supportForm.email);
      formData.append("subject", `App Support - ${supportForm.subject}`);
      formData.append("message", supportForm.message);
      formData.append("from_name", "App Support System");
      formData.append("replyto", supportForm.email);

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        if (userId) {
          try {
            await addDoc(collection(db, "supportRequests"), {
              userId: userId,
              name: supportForm.name,
              email: supportForm.email,
              subject: supportForm.subject,
              message: supportForm.message,
              status: "open",
              source: "contact-support",
              createdAt: serverTimestamp(),
            });
          } catch (dbError) {
            console.error("Failed to log support request:", dbError);
          }
        }

        Alert.alert(
          "Success!",
          "Your support request has been submitted successfully. We'll get back to you soon!",
          [
            {
              text: "OK",
              onPress: () => {
                router.back();
              },
            },
          ]
        );
      } else {
        throw new Error(result.message || "Failed to submit support request");
      }
    } catch (error) {
      console.error("Error submitting support request:", error);
      Alert.alert(
        "Error",
        "Failed to submit your support request. Please try again later."
      );
    } finally {
      setSubmitingSupport(false);
    }
  };

  if (loading) {
    return (
      <Box flex={1} bg={darkTheme.bg} justifyContent="center" alignItems="center">
        <Text color={darkTheme.textSecondary}>Loading...</Text>
      </Box>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Box flex={1} bg={darkTheme.bg}>
        <NavHeader title="Contact Support" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: 60,
            flexGrow: 1,
          }}
        >
          <Box px="$4" py="$6">

            {/* Description */}
            <Text color={darkTheme.textSecondary} fontSize="$sm" mb="$6" lineHeight="$md">
              We&apos;re here to help! Please fill out the form below and we&apos;ll get
              back to you as soon as possible. Our support team typically
              responds within 24 hours.
            </Text>

            {/* Support Form */}
            <VStack space="lg">
              <VStack space="sm">
                <Text color={darkTheme.textPrimary} fontSize="$sm" fontWeight="$semibold">
                  Name
                </Text>
                <Input bg={darkTheme.raised} borderColor={darkTheme.border}>
                  <InputField
                    placeholder="Your full name"
                    color={darkTheme.textPrimary}
                    placeholderTextColor={darkTheme.textSecondary}
                    value={supportForm.name}
                    onChangeText={(text) =>
                      setSupportForm((prev) => ({ ...prev, name: text }))
                    }
                  />
                </Input>
              </VStack>

              <VStack space="sm">
                <Text color={darkTheme.textPrimary} fontSize="$sm" fontWeight="$semibold">
                  Email
                </Text>
                <Input bg={darkTheme.raised} borderColor={darkTheme.border}>
                  <InputField
                    placeholder="your.email@example.com"
                    color={darkTheme.textPrimary}
                    placeholderTextColor={darkTheme.textSecondary}
                    value={supportForm.email}
                    onChangeText={(text) =>
                      setSupportForm((prev) => ({ ...prev, email: text }))
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </Input>
              </VStack>

              <VStack space="sm">
                <Text color={darkTheme.textPrimary} fontSize="$sm" fontWeight="$semibold">
                  Subject
                </Text>
                <Input bg={darkTheme.raised} borderColor={darkTheme.border}>
                  <InputField
                    placeholder="Brief description of your issue"
                    color={darkTheme.textPrimary}
                    placeholderTextColor={darkTheme.textSecondary}
                    value={supportForm.subject}
                    onChangeText={(text) =>
                      setSupportForm((prev) => ({
                        ...prev,
                        subject: text,
                      }))
                    }
                  />
                </Input>
              </VStack>

              <VStack space="sm">
                <HStack justifyContent="space-between" alignItems="center">
                  <Text color={darkTheme.textPrimary} fontSize="$sm" fontWeight="$semibold">
                    Message
                  </Text>
                  {supportForm.message.length > MAX_MESSAGE_LENGTH * 0.8 && (
                    <Text
                      style={{
                        color: supportForm.message.length >= MAX_MESSAGE_LENGTH ? darkTheme.danger : darkTheme.textSecondary,
                        fontSize: 11,
                      }}
                    >
                      {supportForm.message.length}/{MAX_MESSAGE_LENGTH}
                    </Text>
                  )}
                </HStack>
                <Textarea bg={darkTheme.raised} borderColor={darkTheme.border} minHeight="$32">
                  <TextareaInput
                    placeholder="Please describe your issue or question in detail. Include any relevant information that might help us assist you better."
                    color={darkTheme.textPrimary}
                    placeholderTextColor={darkTheme.textSecondary}
                    value={supportForm.message}
                    onChangeText={(text) => {
                      if (text.length <= MAX_MESSAGE_LENGTH)
                        setSupportForm((prev) => ({ ...prev, message: text }));
                    }}
                    multiline
                    textAlignVertical="top"
                  />
                </Textarea>
              </VStack>

              <Button
                bg={ACCENT}
                onPress={handleSupportSubmit}
                disabled={submitingSupport}
                mt="$4"
                size="lg"
              >
                {submitingSupport ? (
                  <HStack space="sm" alignItems="center">
                    <Spinner size="small" color={darkTheme.bg} />
                    <ButtonText color={darkTheme.bg}>Submitting...</ButtonText>
                  </HStack>
                ) : (
                  <ButtonText color={darkTheme.bg} fontSize="$md" fontWeight="$semibold">
                    Submit Support Request
                  </ButtonText>
                )}
              </Button>
            </VStack>
          </Box>
        </ScrollView>
      </Box>
    </KeyboardAvoidingView>
  );
}
