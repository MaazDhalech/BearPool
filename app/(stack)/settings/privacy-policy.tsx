import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import {
    Box,
    HStack,
    Heading,
    ScrollView,
    Text,
    VStack,
} from "@gluestack-ui/themed";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { NavHeader } from "@/components/ui/NavHeader";
import { useTheme } from "@/hooks/useTheme";
import { toast } from "@/components/ui/Dialog";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Linking,
    Platform,
    TouchableOpacity,
} from "react-native";

const GIST_URL = "https://gist.githubusercontent.com/MaazDhalech/5574b48ea3ce14025b56bd0778318235/raw";

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const t = useTheme();
  const [privacyContent, setPrivacyContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrivacyPolicy();
  }, []);

  const fetchPrivacyPolicy = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(GIST_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const content = await response.text();
      setPrivacyContent(content);
    } catch (err) {
      console.error("Error fetching privacy policy:", err);
      setError("Failed to load privacy policy. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleRefresh = () => {
    fetchPrivacyPolicy();
  };

  const handleViewOriginal = () => {
    const originalUrl = "https://gist.github.com/MaazDhalech/5574b48ea3ce14025b56bd0778318235";
    Linking.openURL(originalUrl).catch(() => {
      toast("Unable to open the link.", { type: "error" });
    });
  };

  const formatPrivacyContent = (content: string) => {
    if (!content) return [];

    const lines = content.split('\n');
    const formattedSections = [];
    let currentSection = { title: '', content: [] as string[] };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) return;

      // Check if it's a heading (starts with number followed by period)
      if (/^\d+\.\s/.test(trimmedLine)) {
        // Save previous section if it has content
        if (currentSection.title || currentSection.content.length > 0) {
          formattedSections.push({ ...currentSection });
        }
        
        // Start new section
        currentSection = {
          title: trimmedLine,
          content: []
        };
      } else if (trimmedLine.toLowerCase().includes('privacy policy for bearpool') || 
                 trimmedLine.toLowerCase().includes('last updated:')) {
        // Handle title and last updated
        if (currentSection.title || currentSection.content.length > 0) {
          formattedSections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmedLine,
          content: []
        };
      } else {
        // Add to current section content
        currentSection.content.push(trimmedLine);
      }
    });

    // Add the last section
    if (currentSection.title || currentSection.content.length > 0) {
      formattedSections.push(currentSection);
    }

    return formattedSections;
  };

  const sections = formatPrivacyContent(privacyContent);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <Box flex={1} bg={t.bg}>
        <NavHeader title="Privacy Policy" />
        <Box px="$4" py="$6">
          {/* Action Buttons */}
          <HStack space="md" mb="$4">
            <TouchableOpacity
              onPress={handleRefresh}
              style={{
                backgroundColor: t.raised,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: t.border,
                flex: 1,
              }}
            >
              <Text color={t.textPrimary} fontSize="$sm" textAlign="center">
                Refresh
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleViewOriginal}
              style={{
                backgroundColor: t.raised,
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: t.border,
                flex: 1,
              }}
            >
              <HStack space="xs" alignItems="center" justifyContent="center">
                <Ionicons name="open-outline" size={16} color={t.textPrimary} />
                <Text color={t.textPrimary} fontSize="$sm">
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
                <ActivityIndicator size="large" color={ACCENT} />
                <Text color={t.textSecondary} mt="$4">
                  Loading privacy policy...
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
                  <Text color={t.textPrimary} fontSize="$sm">
                    Try Again
                  </Text>
                </TouchableOpacity>
              </Box>
            ) : sections.length === 0 ? (
              <Box py="$8" alignItems="center">
                <Text color={t.textSecondary} textAlign="center">
                  No privacy policy content available.
                </Text>
              </Box>
            ) : (
              <VStack space="lg">
                {sections.map((section, index) => (
                  <Box
                    key={index}
                    bg={t.surface}
                    p="$4"
                    borderRadius="$md"
                    borderWidth={1}
                    borderColor={t.border}
                  >
                    {section.title && (
                      <Heading 
                        size="md" 
                        color={t.textPrimary} 
                        mb={section.content.length > 0 ? "$3" : "$0"}
                        lineHeight="$lg"
                      >
                        {section.title}
                      </Heading>
                    )}
                    
                    {section.content.map((paragraph, pIndex) => (
                      <Text
                        key={pIndex}
                        color={darkTheme.textBright}
                        fontSize="$sm"
                        lineHeight="$lg"
                        mb={pIndex < section.content.length - 1 ? "$2" : "$0"}
                      >
                        {paragraph}
                      </Text>
                    ))}
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