import { darkTheme } from "@/constants/theme";
// components/TOSOverlay.tsx
import { ACCENT } from "@/constants/Colors";
import {
  Box,
  Button,
  Heading,
  HStack,
  Modal,
  ScrollView,
  Spinner,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, TouchableOpacity } from "react-native";

const GIST_URL =
  "https://gist.githubusercontent.com/babikerb/00ad066b2a3ebcd66ace4dfff75b17e2/raw";

type Props = {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
};

export default function TOSOverlay({ visible, onClose, onAccept }: Props) {
  const [termsContent, setTermsContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    fetchTermsOfService();
  }, [visible]);

  const fetchTermsOfService = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(GIST_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const content = await response.text();
      setTermsContent(content);
    } catch (err) {
      console.error("Error fetching terms of service:", err);
      setError("Failed to load terms of service. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // SAME formatTermsContent() from your terms-of-service.tsx
  // ──────────────────────────────────────────────────────────────
  const formatTermsContent = (content: string) => {
    if (!content) return [];

    const lines = content.split("\n");
    const formattedSections = [];
    let currentSection = { title: "", content: [] as string[], isSubheading: false };

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine === "---") return;

      if (trimmedLine.includes("BearPool") && trimmedLine.includes("Terms of Service")) {
        if (currentSection.title || currentSection.content.length > 0) {
          formattedSections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmedLine.replace(/[#*]/g, "").trim(),
          content: [],
          isSubheading: false,
        };
      }
      else if (
        trimmedLine.toLowerCase().startsWith("**last updated:**") ||
        trimmedLine.toLowerCase().startsWith("last updated:")
      ) {
        if (currentSection.title || currentSection.content.length > 0) {
          formattedSections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmedLine.replace(/[*]/g, "").trim(),
          content: [],
          isSubheading: false,
        };
      }
      else if (trimmedLine.match(/^##?\s*\*{0,2}\d+\.\s+/)) {
        if (currentSection.title || currentSection.content.length > 0) {
          formattedSections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmedLine.replace(/^##?\s*\*{0,2}/, "").replace(/\*{0,2}$/, "").trim(),
          content: [],
          isSubheading: false,
        };
      }
      else if (trimmedLine.match(/^###\s*\*{0,2}•/)) {
        currentSection.content.push("");
        currentSection.content.push(
          trimmedLine.replace(/^###\s*\*{0,2}/, "").replace(/\*{0,2}$/, "").trim()
        );
      }
      else {
        const cleanedLine = trimmedLine.replace(/\*\*/g, "");
        currentSection.content.push(cleanedLine);
      }
    });

    if (currentSection.title || currentSection.content.length > 0) {
      formattedSections.push(currentSection);
    }

    return formattedSections;
  };

  const sections = formatTermsContent(termsContent);

  return (
    <Modal isOpen={visible} onClose={onClose} size="full">
      <Modal.Backdrop />
      <Modal.Content bg={darkTheme.bg} p="$4" maxHeight="95%">
        {/* Header */}
        <Box px="$4" py="$4">
          <HStack alignItems="center" mb="$4">
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="chevron-back" size={24} color={darkTheme.textPrimary} />
            </TouchableOpacity>
            <Heading size="xl" color={darkTheme.textPrimary} ml="$3">
              Terms of Service
            </Heading>
          </HStack>

          {/* Action Buttons */}
          <HStack space="md" mb="$4">
            <TouchableOpacity
              onPress={fetchTermsOfService}
              style={{
                backgroundColor: darkTheme.raised,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: darkTheme.border,
                flex: 1,
              }}
            >
              <Text color={darkTheme.textPrimary} fontSize="$sm" textAlign="center">
                Refresh
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Linking.openURL("https://gist.github.com/babikerb/00ad066b2a3ebcd66ace4dfff75b17e2").catch(() =>
                  alert("Unable to open link")
                );
              }}
              style={{
                backgroundColor: darkTheme.raised,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: darkTheme.border,
                flex: 1,
              }}
            >
              <HStack space="xs" alignItems="center" justifyContent="center">
                <Ionicons name="open-outline" size={16} color={darkTheme.textPrimary} />
                <Text color={darkTheme.textPrimary} fontSize="$sm">
                  View Original
                </Text>
              </HStack>
            </TouchableOpacity>
          </HStack>
        </Box>

        {/* Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <Box px="$4">
            {loading ? (
              <Box py="$8" alignItems="center">
                <Spinner size="large" color={darkTheme.textPrimary} />
                <Text color={darkTheme.textSecondary} mt="$4">
                  Loading terms of service...
                </Text>
              </Box>
            ) : error ? (
              <Box py="$8" alignItems="center">
                <Text color={darkTheme.danger} mb="$4" textAlign="center">
                  {error}
                </Text>
                <TouchableOpacity
                  onPress={fetchTermsOfService}
                  style={{
                    backgroundColor: darkTheme.danger,
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text color={darkTheme.textPrimary} fontSize="$sm">
                    Try Again
                  </Text>
                </TouchableOpacity>
              </Box>
            ) : sections.length === 0 ? (
              <Box py="$8" alignItems="center">
                <Text color={darkTheme.textSecondary} textAlign="center">
                  No terms of service content available.
                </Text>
              </Box>
            ) : (
              <VStack space="lg">
                {sections.map((section, index) => (
                  <Box
                    key={index}
                    bg={darkTheme.surface}
                    p="$4"
                    borderRadius="$md"
                    borderWidth={1}
                    borderColor={darkTheme.border}
                  >
                    {section.title && (
                      <Heading
                        size={index === 0 ? "lg" : "md"}
                        color={darkTheme.textPrimary}
                        mb={section.content.length > 0 ? "$3" : "$0"}
                        lineHeight="$lg"
                      >
                        {section.title}
                      </Heading>
                    )}

                    {section.content.map((paragraph, pIndex) => {
                      const isSubheading = paragraph.startsWith("•");
                      const isBullet = paragraph.match(/^[-•]\s/);

                      return (
                        <Text
                          key={pIndex}
                          color={isSubheading ? darkTheme.success : darkTheme.textBright}
                          fontSize={isSubheading ? "$md" : "$sm"}
                          fontWeight={isSubheading ? "$semibold" : "$normal"}
                          lineHeight="$lg"
                          mb={pIndex < section.content.length - 1 ? "$2" : "$0"}
                          pl={isBullet ? "$4" : "$0"}
                        >
                          {paragraph}
                        </Text>
                      );
                    })}
                  </Box>
                ))}
              </VStack>
            )}
          </Box>
        </ScrollView>

        {/* Accept / Cancel Buttons */}
        <Box px="$4" pb="$4" mt="$4">
          <HStack space="md">
            <Button variant="outline" onPress={onClose} flex={1} borderColor={darkTheme.textMuted}>
              <Text color={darkTheme.textSecondary}>Cancel</Text>
            </Button>
            <Button bg={ACCENT} onPress={onAccept} flex={1} isDisabled={loading || !!error}>
              <Text color={darkTheme.bg} fontWeight="$semibold">
                I Agree
              </Text>
            </Button>
          </HStack>

          <Box mt="$3" alignItems="center">
            <Link href="/(stack)/settings/terms-of-service" asChild>
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="open-outline" size={16} color={ACCENT} />
                <Text color={ACCENT} ml="$1" fontSize="$sm">
                  Open full version
                </Text>
              </TouchableOpacity>
            </Link>
          </Box>
        </Box>
      </Modal.Content>
    </Modal>
  );
}