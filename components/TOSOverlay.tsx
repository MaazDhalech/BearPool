// components/TOSOverlay.tsx
import {
  Box,
  Button,
  Heading,
  HStack,
  Icon,
  Modal,
  ScrollView,
  Spinner,
  Text,
  VStack,
} from "@gluestack-ui/themed";
import { Link } from "expo-router";
import { ChevronLeft, ExternalLink } from "lucide-react-native";
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
      <Modal.Content bg="#121212" p="$4" maxHeight="95%">
        {/* Header */}
        <Box px="$4" py="$4">
          <HStack alignItems="center" mb="$4">
            <TouchableOpacity onPress={onClose}>
              <Icon as={ChevronLeft} size="xl" color="white" />
            </TouchableOpacity>
            <Heading size="xl" color="white" ml="$3">
              Terms of Service
            </Heading>
          </HStack>

          {/* Action Buttons */}
          <HStack space="md" mb="$4">
            <TouchableOpacity
              onPress={fetchTermsOfService}
              style={{
                backgroundColor: "#2a2a2a",
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                flex: 1,
              }}
            >
              <Text color="white" fontSize="$sm" textAlign="center">
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
                backgroundColor: "#2a2a2a",
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#333",
                flex: 1,
              }}
            >
              <HStack space="xs" alignItems="center" justifyContent="center">
                <Icon as={ExternalLink} size="sm" color="white" />
                <Text color="white" fontSize="$sm">
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
                <Spinner size="large" color="white" />
                <Text color="#a0a0a0" mt="$4">
                  Loading terms of service...
                </Text>
              </Box>
            ) : error ? (
              <Box py="$8" alignItems="center">
                <Text color="#ff6b6b" mb="$4" textAlign="center">
                  {error}
                </Text>
                <TouchableOpacity
                  onPress={fetchTermsOfService}
                  style={{
                    backgroundColor: "#ff6b6b",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text color="white" fontSize="$sm">
                    Try Again
                  </Text>
                </TouchableOpacity>
              </Box>
            ) : sections.length === 0 ? (
              <Box py="$8" alignItems="center">
                <Text color="#a0a0a0" textAlign="center">
                  No terms of service content available.
                </Text>
              </Box>
            ) : (
              <VStack space="lg">
                {sections.map((section, index) => (
                  <Box
                    key={index}
                    bg="#1e1e1e"
                    p="$4"
                    borderRadius="$md"
                    borderWidth={1}
                    borderColor="#333"
                  >
                    {section.title && (
                      <Heading
                        size={index === 0 ? "lg" : "md"}
                        color="white"
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
                          color={isSubheading ? "#4CAF50" : "#e0e0e0"}
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
            <Button variant="outline" onPress={onClose} flex={1} borderColor="#666">
              <Text color="#a0a0a0">Cancel</Text>
            </Button>
            <Button bg="#3a7bd5" onPress={onAccept} flex={1} isDisabled={loading || !!error}>
              <Text color="white" fontWeight="$semibold">
                I Agree
              </Text>
            </Button>
          </HStack>

          <Box mt="$3" alignItems="center">
            <Link href="/(stack)/settings/terms-of-service" asChild>
              <TouchableOpacity style={{ flexDirection: "row", alignItems: "center" }}>
                <ExternalLink size={16} color="#3a7bd5" />
                <Text color="#3a7bd5" ml="$1" fontSize="$sm">
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