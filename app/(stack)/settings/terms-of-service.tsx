import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import {
    Box,
    HStack,
    Heading,
    ScrollView,
    Spinner,
    Text,
    VStack,
} from "@gluestack-ui/themed";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { NavHeader } from "@/components/ui/NavHeader";
import { toast } from "@/components/ui/Dialog";
import { useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Linking,
    Platform,
    TouchableOpacity,
} from "react-native";

const GIST_URL = "https://gist.githubusercontent.com/babikerb/00ad066b2a3ebcd66ace4dfff75b17e2/raw";

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const [termsContent, setTermsContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTermsOfService();
  }, []);

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

  const handleGoBack = () => {
    router.back();
  };

  const handleRefresh = () => {
    fetchTermsOfService();
  };

  const handleViewOriginal = () => {
    const originalUrl = "https://gist.github.com/babikerb/00ad066b2a3ebcd66ace4dfff75b17e2";
    Linking.openURL(originalUrl).catch(() => {
      toast("Unable to open the link.", { type: "error" });
    });
  };

  const formatTermsContent = (content: string) => {
    if (!content) return [];

    const lines = content.split('\n');
    const formattedSections = [];
    let currentSection = { title: '', content: [] as string[], isSubheading: false };

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      // Skip empty lines and separators
      if (!trimmedLine || trimmedLine === '---') return;

      // Check for main title (BearPool – Terms of Service)
      if (trimmedLine.includes('BearPool') && trimmedLine.includes('Terms of Service')) {
        if (currentSection.title || currentSection.content.length > 0) {
          formattedSections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmedLine.replace(/[#*]/g, '').trim(),
          content: [],
          isSubheading: false
        };
      }
      // Check for "Last updated" line
      else if (trimmedLine.toLowerCase().startsWith('**last updated:**') || 
               trimmedLine.toLowerCase().startsWith('last updated:')) {
        if (currentSection.title || currentSection.content.length > 0) {
          formattedSections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmedLine.replace(/[*]/g, '').trim(),
          content: [],
          isSubheading: false
        };
      }
      // Check for main section headings (## **1. Title**)
      else if (trimmedLine.match(/^##?\s*\*{0,2}\d+\.\s+/)) {
        if (currentSection.title || currentSection.content.length > 0) {
          formattedSections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmedLine.replace(/^##?\s*\*{0,2}/, '').replace(/\*{0,2}$/, '').trim(),
          content: [],
          isSubheading: false
        };
      }
      // Check for subsection headings (### **• Title**)
      else if (trimmedLine.match(/^###\s*\*{0,2}•/)) {
        currentSection.content.push('');
        currentSection.content.push(trimmedLine.replace(/^###\s*\*{0,2}/, '').replace(/\*{0,2}$/, '').trim());
      }
      // Regular content
      else {
        // Remove markdown bold markers but keep the text
        const cleanedLine = trimmedLine.replace(/\*\*/g, '');
        currentSection.content.push(cleanedLine);
      }
    });

    // Add the last section
    if (currentSection.title || currentSection.content.length > 0) {
      formattedSections.push(currentSection);
    }

    return formattedSections;
  };

  const sections = formatTermsContent(termsContent);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Box flex={1} bg={darkTheme.bg}>
        <NavHeader title="Terms of Service" />
        <Box px="$4" py="$6">
          {/* Action Buttons */}
          <HStack space="md" mb="$4">
            <TouchableOpacity
              onPress={handleRefresh}
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
              onPress={handleViewOriginal}
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
                <Spinner size="large" color={ACCENT} />
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
                  onPress={handleRefresh}
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
                      // Check if this is a subsection heading (starts with •)
                      const isSubheading = paragraph.startsWith('•');
                      
                      // Check if this is a bullet point (starts with - or •)
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
      </Box>
    </KeyboardAvoidingView>
  );
}