import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { NavHeader } from "@/components/ui/NavHeader";
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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { toast } from "@/components/ui/Dialog";

const REPORT_REASONS = [
  "Harassment or hate",
  "Spam or scam",
  "Safety concern",
  "Fake profile",
  "Other",
];

export default function ReportUserScreen() {
  const { userId: reporterId } = useFirebaseAuth();
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
        toast("Unable to load report form. Please try again.", { type: "error" });
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
        toast("Failed to load report form. Please try again.", { type: "error" });
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
      toast("Missing information for this report.", { type: "error" });
      return;
    }

    if (!canSubmit) {
      toast("Please choose a reason and provide details.", { type: "error" });
      return;
    }

    const web3formsApiKey = Constants.expoConfig?.extra?.web3formsApiKey;
    if (!web3formsApiKey) {
      toast("Support service is not configured. Please contact the administrator.", {
        type: "error",
      });
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

      toast("Thanks for keeping BearPool safe. Our team will review this report shortly.", {
        type: "success",
      });
      router.back();
    } catch (error) {
      console.error("Error submitting report:", error);
      toast("Failed to submit your report. Please try again later.", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box flex={1} bg={darkTheme.bg} justifyContent="center" alignItems="center">
        <Text color={darkTheme.textSecondary}>Loading report form...</Text>
      </Box>
    );
  }

  return (
    <>
    <Stack.Screen options={{ gestureEnabled: !submitting }} />
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Box flex={1} bg={darkTheme.bg}>
        <NavHeader title="Report User" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 60, flexGrow: 1 }}
        >
          <Box px="$4" py="$6">

            <Text color={darkTheme.textSecondary} fontSize="$sm" mb="$6" lineHeight="$md">
              You’re about to report{" "}
              <Text color={darkTheme.textPrimary} fontWeight="$semibold">
                {targetInfo?.name}
              </Text>{" "}
              (@{targetInfo?.username}). We’ll review your report within 24 hours.
            </Text>

            <VStack space="lg">
              <VStack space="sm">
                <Text color={darkTheme.textSecondary} fontSize="$sm">
                  Reason
                </Text>
                <HStack flexWrap="wrap" space="sm">
                  {REPORT_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      activeOpacity={0.7}
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
                          form.reason === reason ? ACCENT : darkTheme.border,
                        backgroundColor:
                          form.reason === reason ? "#2e2610" : darkTheme.surface,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            form.reason === reason ? ACCENT : darkTheme.textSecondary,
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
                <Text color={darkTheme.textSecondary} fontSize="$sm">
                  Additional details
                </Text>
                <Textarea bg={darkTheme.raised} borderColor={darkTheme.border} borderRadius="$lg">
                  <TextareaInput
                    placeholder="Describe what happened..."
                    placeholderTextColor={darkTheme.textMuted}
                    color={darkTheme.textPrimary}
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
                <Text color={darkTheme.textSecondary} fontSize="$sm">
                  Your email (optional)
                </Text>
                <Input bg={darkTheme.raised} borderColor={darkTheme.border}>
                  <InputField
                    placeholder="We'll follow up here"
                    placeholderTextColor={darkTheme.textMuted}
                    color={darkTheme.textPrimary}
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
                bg={ACCENT}
                onPress={handleSubmit}
                isDisabled={!canSubmit || submitting}
              >
                <Text color={darkTheme.bg} fontWeight="$semibold">
                  {submitting ? "Submitting..." : "Submit Report"}
                </Text>
              </Button>
            </VStack>
          </Box>
        </ScrollView>
      </Box>
    </KeyboardAvoidingView>
    </>
  );
}
