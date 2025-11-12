import { db } from "@/services/firebaseConfig";
import { useAuth } from "@clerk/clerk-expo";
import {
  Box,
  Button,
  HStack,
  Heading,
  Input,
  InputField,
  ScrollView,
  Text,
  Textarea,
  TextareaInput,
  VStack,
} from "@gluestack-ui/themed";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ChevronLeft } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";

const REPORT_REASONS = [
  "Harassment or hate",
  "Spam or scam",
  "Safety concern",
  "Fake profile",
  "Other",
];

export default function ReportUserScreen() {
  const { userId: reporterId } = useAuth();
  const router = useRouter();
  const { userId: targetUserId, rideId } = useLocalSearchParams<{
    userId?: string;
    rideId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reporterInfo, setReporterInfo] = useState({
    name: "",
    email: "",
  });
  const [targetInfo, setTargetInfo] = useState<{
    name: string;
    username: string;
  } | null>(null);
  const [form, setForm] = useState({
    reason: "",
    message: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!reporterId || !targetUserId) {
        Alert.alert(
          "Missing information",
          "Unable to load report form. Please try again."
        );
        router.back();
        return;
      }

      try {
        const reporterDoc = await getDoc(doc(db, "users", reporterId));
        if (reporterDoc.exists()) {
          const data = reporterDoc.data();
          setReporterInfo({
            name:
              `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
              data.username ||
              "Unknown reporter",
            email: data.email || "",
          });
        }

        const targetDoc = await getDoc(doc(db, "users", targetUserId));
        if (targetDoc.exists()) {
          const data = targetDoc.data();
          setTargetInfo({
            name:
              `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
              data.username ||
              "Unknown rider",
            username: data.username || "Unknown",
          });
        } else {
          setTargetInfo({
            name: "Unknown rider",
            username: targetUserId,
          });
        }
      } catch (error) {
        console.error("Error loading report screen:", error);
        Alert.alert("Error", "Failed to load report form. Please try again.");
        router.back();
        return;
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reporterId, targetUserId]);

  const canSubmit = useMemo(
    () => form.reason.trim().length > 0 && form.message.trim().length > 0,
    [form]
  );

  const handleSubmit = async () => {
    if (!reporterId || !targetUserId) {
      Alert.alert("Error", "Missing information for this report.");
      return;
    }

    if (!canSubmit) {
      Alert.alert("Error", "Please choose a reason and provide details.");
      return;
    }

    const web3formsApiKey = Constants.expoConfig?.extra?.web3formsApiKey;
    if (!web3formsApiKey) {
      Alert.alert(
        "Error",
        "Support service is not configured. Please contact the administrator."
      );
      return;
    }

    setSubmitting(true);
    try {
      const compiledMessage = [
        `Reporter ID: ${reporterId}`,
        `Reporter Name: ${reporterInfo.name}`,
        `Reporter Email: ${reporterInfo.email || "N/A"}`,
        `Reported User ID: ${targetUserId}`,
        `Reported User Name: ${targetInfo?.name || "Unknown"}`,
        `Reported Username: ${targetInfo?.username || "Unknown"}`,
        `Ride Context: ${rideId || "N/A"}`,
        `Reason: ${form.reason}`,
        `Details:\n${form.message}`,
      ].join("\n");

      const formData = new FormData();
      formData.append("access_key", web3formsApiKey);
      formData.append("name", reporterInfo.name || "BearPool User");
      formData.append("email", reporterInfo.email || "noreply@bearpool.app");
      formData.append("subject", `User Report - ${form.reason}`);
      formData.append("message", compiledMessage);
      formData.append("from_name", "BearPool Reports");
      formData.append("replyto", reporterInfo.email || "noreply@bearpool.app");

      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to submit report");
      }

      try {
        await addDoc(collection(db, "reports"), {
          reporterId,
          reportedUserId: targetUserId,
          rideId: rideId || null,
          reason: form.reason,
          message: form.message,
          reporterEmail: reporterInfo.email || null,
          reporterName: reporterInfo.name || null,
          reportedUsername: targetInfo?.username || null,
          status: "open",
          source: "report-user",
          createdAt: serverTimestamp(),
        });
      } catch (dbError) {
        console.error("Failed to log report to Firestore:", dbError);
      }

      Alert.alert(
        "Report submitted",
        "Thanks for keeping BearPool safe. Our team will review this report shortly.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert(
        "Error",
        "Failed to submit your report. Please try again later."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box flex={1} bg="#121212" justifyContent="center" alignItems="center">
        <Text color="#a0a0a0">Loading report form...</Text>
      </Box>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Box flex={1} bg="#121212">
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 60, flexGrow: 1 }}
        >
          <Box px="$4" py="$6">
            <HStack alignItems="center" mb="$6" mt="$8">
              <TouchableOpacity onPress={() => router.back()}>
                <ChevronLeft color="white" size={28} />
              </TouchableOpacity>
              <Heading size="xl" color="white" ml="$3">
                Report User
              </Heading>
            </HStack>

            <Text color="#a0a0a0" fontSize="$sm" mb="$6" lineHeight="$md">
              You’re about to report{" "}
              <Text color="white" fontWeight="$semibold">
                {targetInfo?.name}
              </Text>{" "}
              (@{targetInfo?.username}). We’ll review your note within 24 hours.
            </Text>

            <VStack space="lg">
              <VStack space="sm">
                <Text color="#a0a0a0" fontSize="$sm">
                  Reason
                </Text>
                <HStack flexWrap="wrap" space="sm">
                  {REPORT_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      onPress={() =>
                        setForm((prev) => ({ ...prev, reason }))
                      }
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        borderRadius: 999,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor:
                          form.reason === reason ? "#3a7bd5" : "#333",
                        backgroundColor:
                          form.reason === reason ? "#1a3a7b" : "#1e1e1e",
                      }}
                    >
                      <Text
                        style={{
                          color:
                            form.reason === reason ? "white" : "#a0a0a0",
                          fontWeight:
                            form.reason === reason ? "600" : "400",
                        }}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </HStack>
              </VStack>

              <VStack space="sm">
                <Text color="#a0a0a0" fontSize="$sm">
                  Additional details
                </Text>
                <Textarea bg="#2a2a2a" borderColor="#333" borderRadius="$lg">
                  <TextareaInput
                    placeholder="Describe what happened..."
                    placeholderTextColor="#666"
                    color="white"
                    value={form.message}
                    onChangeText={(text) =>
                      setForm((prev) => ({ ...prev, message: text }))
                    }
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />
                </Textarea>
              </VStack>

              <VStack space="sm">
                <Text color="#a0a0a0" fontSize="$sm">
                  Your email (optional)
                </Text>
                <Input bg="#2a2a2a" borderColor="#333">
                  <InputField
                    placeholder="We'll follow up here"
                    placeholderTextColor="#666"
                    color="white"
                    value={reporterInfo.email}
                    onChangeText={(text) =>
                      setReporterInfo((prev) => ({ ...prev, email: text }))
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </Input>
              </VStack>

              <Button
                bg="#3a7bd5"
                onPress={handleSubmit}
                isDisabled={!canSubmit || submitting}
              >
                <Text color="white" fontWeight="$semibold">
                  {submitting ? "Submitting..." : "Submit Report"}
                </Text>
              </Button>
            </VStack>
          </Box>
        </ScrollView>
      </Box>
    </KeyboardAvoidingView>
  );
}
