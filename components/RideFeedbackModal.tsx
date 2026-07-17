import { darkTheme } from "@/constants/theme";
// components/RideFeedbackModal.tsx
import { ACCENT } from "@/constants/Colors";
import { db } from "@/services/firebaseConfig";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
    Avatar,
    Box,
    Button,
    ButtonText,
    HStack,
    Heading,
    Pressable,
    ScrollView,
    Text,
    Textarea,
    TextareaInput,
    VStack,
} from "@gluestack-ui/themed";
import Constants from "expo-constants";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    increment,
    serverTimestamp,
    updateDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
} from "react-native";

type RideInfo = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  startTime?: any;
  archived: boolean;
  isActive: boolean;
  hostId: string;
  memberIds: string[];
  seats: number;
  rideFull: boolean;
};

type UserData = {
  name: string;
  email: string;
  avatar?: string;
};

type FeedbackModalProps = {
  visible: boolean;
  rideInfo: RideInfo | null;
  onClose: () => void;
  onRateLater?: () => void;
  onFeedbackSubmit?: () => void;
};

export default function RideFeedbackModal({
  visible,
  rideInfo,
  onClose,
  onRateLater,
  onFeedbackSubmit,
}: FeedbackModalProps) {
  const { userId } = useFirebaseAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hostUserData, setHostUserData] = useState<UserData | null>(null);

  // Feedback form state
  const [feedbackForm, setFeedbackForm] = useState({
    rating: 0,
    driverRating: 0,
    communicationRating: 0,
    safetyRating: 0,
    punctualityRating: 0,
    comments: "",
    suggestions: "",
    wouldRideAgain: null as boolean | null,
    reportIssue: false,
    issueDetails: "",
  });

  const [userData, setUserData] = useState<UserData>({
    name: "",
    email: "",
    avatar: "",
  });

  // Fetch user data and host data when modal opens
  useEffect(() => {
    if (!visible || !userId || !rideInfo) {
      setLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        // Fetch current user data
        const userDocRef = doc(db, "users", userId);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const userDataFromDb = userSnap.data();
          setUserData({
            name:
              `${userDataFromDb.first_name || ""} ${userDataFromDb.last_name || ""}`.trim() ||
              "Anonymous",
            email: userDataFromDb.email || "",
            avatar: userDataFromDb.avatar || "",
          });
        }

        // Fetch host user data if available
        if (rideInfo.hostId) {
          const hostDocRef = doc(db, "users", rideInfo.hostId);
          const hostSnap = await getDoc(hostDocRef);

          if (hostSnap.exists()) {
            const hostData = hostSnap.data();
            setHostUserData({
              name:
                `${hostData.first_name || ""} ${hostData.last_name || ""}`.trim() ||
                "Anonymous Host",
              email: hostData.email || "",
              avatar: hostData.avatar || "",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [visible, userId, rideInfo]);

  const handleRatingSelect = (
    type: "overall" | "driver" | "communication" | "safety" | "punctuality",
    value: number,
  ) => {
    setFeedbackForm((prev) => ({
      ...prev,
      ...(type === "overall" && { rating: value }),
      ...(type === "driver" && { driverRating: value }),
      ...(type === "communication" && { communicationRating: value }),
      ...(type === "safety" && { safetyRating: value }),
      ...(type === "punctuality" && { punctualityRating: value }),
    }));
  };

  const handleWouldRideAgain = (value: boolean) => {
    setFeedbackForm((prev) => ({
      ...prev,
      wouldRideAgain: value,
    }));
  };

  const handleReportIssue = (value: boolean) => {
    setFeedbackForm((prev) => ({
      ...prev,
      reportIssue: value,
      ...(value === false && { issueDetails: "" }), // Clear issue details if not reporting
    }));
  };

  const formatRideId = (rideId: string) => {
    if (rideId.length <= 12) return rideId;
    return `${rideId.substring(0, 6)}...${rideId.substring(rideId.length - 6)}`;
  };

  const getRideStatus = () => {
    if (!rideInfo) return "Unknown";
    if (rideInfo.archived) return "Archived";
    if (rideInfo.rideFull) return "Full";
    if (rideInfo.isActive === false) return "Inactive";
    return "Active";
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return darkTheme.success;
      case "archived":
        return darkTheme.danger;
      case "full":
        return "#FFA726";
      case "inactive":
        return darkTheme.textSecondary;
      default:
        return darkTheme.textSecondary;
    }
  };

  const handleSubmit = async () => {
    if (!rideInfo || !userId) return;

    // Validate at least overall rating is provided
    if (feedbackForm.rating === 0) {
      Alert.alert(
        "Rating Required",
        "Please provide an overall rating for the ride.",
      );
      return;
    }

    // Validate wouldRideAgain is answered
    if (feedbackForm.wouldRideAgain === null) {
      Alert.alert(
        "Feedback Required",
        "Please indicate if you would ride again with this host.",
      );
      return;
    }

    // Validate issue details if reporting an issue
    if (feedbackForm.reportIssue && !feedbackForm.issueDetails.trim()) {
      Alert.alert(
        "Issue Details Required",
        "Please provide details about the issue you encountered.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const web3formsApiKey = Constants.expoConfig?.extra?.web3formsApiKey;

      // Prepare comprehensive ride data for the form
      const formData = new FormData();
      formData.append("access_key", web3formsApiKey);
      formData.append("name", userData.name);
      formData.append("email", userData.email);
      formData.append(
        "subject",
        `🚗 Ride Feedback - ${rideInfo.from} to ${rideInfo.to}`,
      );
      formData.append("from_name", "RideShare Feedback System");
      formData.append("replyto", userData.email);

      // Structure the message with all ride details
      const rideStartTime = rideInfo.startTime
        ? new Date(rideInfo.startTime.toDate()).toLocaleString()
        : "Not specified";

      const status = getRideStatus();
      const statusColor = getStatusColor(status);

      const messageContent = `
🚗 **RIDE FEEDBACK SUBMISSION**
📅 Submitted: ${new Date().toLocaleString()}

---

**📊 USER INFORMATION**
• Name: ${userData.name}
• Email: ${userData.email}
• User ID: ${userId}

---

**📍 RIDE DETAILS**
• Route: ${rideInfo.from} → ${rideInfo.to}
• Date: ${rideInfo.date}
• Time: ${rideInfo.time}
• Start Time (DB): ${rideStartTime}
• Ride ID: ${formatRideId(rideInfo.id)}
• Status: ${status}
• Available Seats: ${rideInfo.seats}
• Current Members: ${rideInfo.memberIds?.length || 0}
• Ride Full: ${rideInfo.rideFull ? "Yes" : "No"}
• Archived: ${rideInfo.archived ? "Yes" : "No"}

---

**👤 HOST INFORMATION**
• Host ID: ${rideInfo.hostId}
• Host Name: ${hostUserData?.name || "Unknown"}
• Host Email: ${hostUserData?.email || "Not provided"}

---

**⭐ RATINGS & FEEDBACK**

**Overall Experience:** ${feedbackForm.rating}/5 ⭐
**Driver/Host:** ${feedbackForm.driverRating}/5 ⭐
**Communication:** ${feedbackForm.communicationRating}/5 ⭐
**Safety & Comfort:** ${feedbackForm.safetyRating}/5 ⭐
**Punctuality:** ${feedbackForm.punctualityRating}/5 ⭐

**Would Ride Again:** ${feedbackForm.wouldRideAgain ? "✅ Yes" : "❌ No"}
**Report Issue:** ${feedbackForm.reportIssue ? "⚠️ YES - See details below" : "✅ No issues reported"}

---

**💬 USER COMMENTS**
${feedbackForm.comments || "No comments provided"}

---

**💡 SUGGESTIONS FOR IMPROVEMENT**
${feedbackForm.suggestions || "No suggestions provided"}

---

${
  feedbackForm.reportIssue
    ? `
**🚨 REPORTED ISSUE DETAILS**
${feedbackForm.issueDetails}

---`
    : ""
}

**🔧 SYSTEM INFO**
• Submission ID: ${Date.now()}
• Platform: ${Platform.OS}
• App Version: ${Constants.expoConfig?.version || "Unknown"}
• Environment: ${__DEV__ ? "Development" : "Production"}
            `.trim();

      formData.append("message", messageContent);

      // Additional metadata for better categorization
      formData.append("ride_id", rideInfo.id);
      formData.append("route", `${rideInfo.from}_${rideInfo.to}`);
      formData.append("overall_rating", feedbackForm.rating.toString());
      formData.append("driver_rating", feedbackForm.driverRating.toString());
      formData.append(
        "communication_rating",
        feedbackForm.communicationRating.toString(),
      );
      formData.append("safety_rating", feedbackForm.safetyRating.toString());
      formData.append(
        "punctuality_rating",
        feedbackForm.punctualityRating.toString(),
      );
      formData.append(
        "would_ride_again",
        feedbackForm.wouldRideAgain ? "yes" : "no",
      );
      formData.append("report_issue", feedbackForm.reportIssue ? "yes" : "no");
      formData.append("feedback_type", "post_ride_feedback");
      formData.append("category", "Ride Feedback");

      // web3forms: best-effort, never blocks submission
      let web3formsId: string | null = null;
      if (web3formsApiKey) {
        try {
          const response = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            body: formData,
            headers: {
              Accept: "application/json",
            },
          });
          const result = await response.json();
          if (result.success) {
            web3formsId = result.messageId || null;
          } else {
            console.warn("web3forms submission failed:", result.message);
          }
        } catch (web3formsError) {
          console.warn("web3forms request failed:", web3formsError);
        }
      }

      // Save feedback to Firestore for analytics
      try {
        await addDoc(collection(db, "rideFeedback"), {
          userId: userId,
          rideId: rideInfo.id,
          from: rideInfo.from,
          to: rideInfo.to,
          date: rideInfo.date,
          time: rideInfo.time,
          hostId: rideInfo.hostId,
          hostName: hostUserData?.name || "Unknown",

          // Ratings
          overallRating: feedbackForm.rating,
          driverRating: feedbackForm.driverRating,
          communicationRating: feedbackForm.communicationRating,
          safetyRating: feedbackForm.safetyRating,
          punctualityRating: feedbackForm.punctualityRating,

          // Additional feedback
          wouldRideAgain: feedbackForm.wouldRideAgain,
          reportIssue: feedbackForm.reportIssue,
          issueDetails: feedbackForm.reportIssue
            ? feedbackForm.issueDetails
            : null,
          comments: feedbackForm.comments,
          suggestions: feedbackForm.suggestions,

          // Metadata
          submittedAt: serverTimestamp(),
          web3formsId,
          submissionTimestamp: Date.now(),
          userEmail: userData.email,
          userName: userData.name,

          // Ride status at time of feedback
          rideStatus: status,
          memberCount: rideInfo.memberIds?.length || 0,
          seatsAvailable: rideInfo.seats,
          rideFull: rideInfo.rideFull,
          archived: rideInfo.archived,
        });

        // Update user's last rated ride
        try {
          await updateDoc(doc(db, "users", userId), {
            lastRatedRide: rideInfo.id,
            lastRatedAt: serverTimestamp(),
            totalRidesRated: increment(1),
          });
        } catch (userUpdateError) {
          console.error(
            "Failed to update user rating stats:",
            userUpdateError,
          );
        }

        // Call the feedback submit callback if provided
        if (onFeedbackSubmit) {
          onFeedbackSubmit();
        }
      } catch (dbError) {
        console.error("Failed to log feedback to database:", dbError);
      }

      Alert.alert(
        "Thank You! ✨",
        "Your feedback has been submitted successfully. We appreciate you helping us improve our service!\n\nYour feedback makes our community better for everyone.",
        [
          {
            text: "OK",
            onPress: () => {
              onClose();
              // Reset form
              setFeedbackForm({
                rating: 0,
                driverRating: 0,
                communicationRating: 0,
                safetyRating: 0,
                punctualityRating: 0,
                comments: "",
                suggestions: "",
                wouldRideAgain: null,
                reportIssue: false,
                issueDetails: "",
              });
            },
          },
        ],
      );
    } catch (error) {
      console.error("Error submitting feedback:", error);
      Alert.alert(
        "Submission Error",
        "Failed to submit your feedback. Please check your internet connection and try again.\n\nError: " +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRateLater = () => {
    if (onRateLater) {
      onRateLater();
    }
    onClose();

    // Reset form
    setFeedbackForm({
      rating: 0,
      driverRating: 0,
      communicationRating: 0,
      safetyRating: 0,
      punctualityRating: 0,
      comments: "",
      suggestions: "",
      wouldRideAgain: null,
      reportIssue: false,
      issueDetails: "",
    });
  };

  const RatingStars = ({
    rating,
    onRate,
    label,
    description,
    disabled = false,
  }: {
    rating: number;
    onRate: (value: number) => void;
    label: string;
    description?: string;
    disabled?: boolean;
  }) => (
    <VStack space="xs" mb="$4" bg="#1a1a1a" p="$3" borderRadius="$lg">
      <Text color={darkTheme.textPrimary} fontSize="$sm" fontWeight="$semibold" mb="$1">
        {label}
      </Text>
      {description && (
        <Text color={darkTheme.textFaint} fontSize="$xs" mb="$2">
          {description}
        </Text>
      )}
      <HStack space="sm" justifyContent="center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={() => !disabled && onRate(star)}
            disabled={disabled}
            opacity={disabled ? 0.5 : 1}
            style={{ padding: 4 }}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={24}
              color={star <= rating ? "#FFD700" : darkTheme.borderStrong}
            />
          </Pressable>
        ))}
      </HStack>
      <Text
        color={rating === 0 ? darkTheme.textMuted : "#FFD700"}
        fontSize="$xs"
        textAlign="center"
        mt="$1"
        fontWeight={rating > 0 ? "600" : "normal"}
      >
        {rating === 0 ? "Tap to rate" : `${rating}/5`}
      </Text>
    </VStack>
  );

  const YesNoButton = ({
    selected,
    onSelect,
    label,
    type = "yes",
  }: {
    selected: boolean;
    onSelect: (value: boolean) => void;
    label: string;
    type: "yes" | "no" | "issue";
  }) => {
    const isYes = type === "yes";
    const isIssue = type === "issue";

    const bgColor = selected
      ? isYes
        ? darkTheme.success
        : darkTheme.danger
      : darkTheme.raised;
    const borderColor = selected
      ? isYes
        ? "#388E3C"
        : "#D32F2F"
      : darkTheme.borderStrong;

    return (
      <Pressable
        onPress={() => onSelect(isYes || isIssue)}
        style={{
          flex: 1,
          backgroundColor: bgColor,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: borderColor,
          alignItems: "center",
          justifyContent: "center",
          marginHorizontal: 4,
        }}
      >
        <Text
          color={selected ? "white" : darkTheme.textSecondary}
          fontWeight="600"
          fontSize="$sm"
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <Box
            style={styles.modalContent}
            justifyContent="center"
            alignItems="center"
          >
            <ActivityIndicator size="large" color={ACCENT} />
            <Text color={darkTheme.textSecondary} mt="$4" fontSize="$sm">
              Loading ride details...
            </Text>
          </Box>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
            <Box style={styles.modalContent}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 30 }}
                >
                  {/* Header */}
                  <HStack
                    justifyContent="space-between"
                    alignItems="center"
                    mb="$4"
                  >
                    <VStack flex={1}>
                      <Heading size="xl" color={darkTheme.textPrimary} fontWeight="700">
                        Rate Your Ride ✨
                      </Heading>
                      <Text color={darkTheme.textSecondary} fontSize="$sm" mt="$1">
                        Share your experience to help our community
                      </Text>
                    </VStack>
                    <Pressable
                      onPress={onClose}
                      p="$2"
                      borderRadius="$full"
                      bg={darkTheme.raised}
                      $pressed={{ bg: darkTheme.border }}
                    >
                      <Ionicons name="close" size={24} color={darkTheme.textSecondary} />
                    </Pressable>
                  </HStack>

                  {/* Ride Summary */}
                  {rideInfo && (
                    <Box
                      bg="#1a1a1a"
                      borderRadius="$lg"
                      p="$4"
                      mb="$6"
                      borderWidth={1}
                      borderColor={darkTheme.border}
                    >
                      <HStack alignItems="center" mb="$3">
                        <Box
                          px="$2"
                          py="$1"
                          borderRadius="$full"
                          bg={getStatusColor(getRideStatus()) + "20"}
                          borderWidth={1}
                          borderColor={getStatusColor(getRideStatus())}
                        >
                          <Text
                            color={getStatusColor(getRideStatus())}
                            fontSize="$xs"
                            fontWeight="600"
                          >
                            {getRideStatus().toUpperCase()}
                          </Text>
                        </Box>
                        <Text color={darkTheme.textMuted} fontSize="$xs" ml="$2">
                          ID: {formatRideId(rideInfo.id)}
                        </Text>
                      </HStack>

                      <HStack alignItems="center" mb="$3">
                        <Ionicons name="location-outline" size={20} color={ACCENT} style={{ marginRight: 12 }} />
                        <VStack flex={1}>
                          <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="700">
                            {rideInfo.from} → {rideInfo.to}
                          </Text>
                          <Text color={darkTheme.textFaint} fontSize="$sm">
                            {rideInfo.date} at {rideInfo.time}
                          </Text>
                        </VStack>
                      </HStack>

                      <HStack space="md" mt="$3">
                        <HStack alignItems="center" flex={1}>
                          <Ionicons name="people-outline" size={16} color={darkTheme.textMuted} style={{ marginRight: 8 }} />
                          <Text color={darkTheme.textSecondary} fontSize="$xs">
                            {rideInfo.memberIds?.length || 0} riders
                          </Text>
                        </HStack>
                        <HStack alignItems="center" flex={1}>
                          <Ionicons name="calendar-outline" size={16} color={darkTheme.textMuted} style={{ marginRight: 8 }} />
                          <Text color={darkTheme.textSecondary} fontSize="$xs">
                            {rideInfo.seats} seats
                          </Text>
                        </HStack>
                      </HStack>

                      {hostUserData && (
                        <HStack
                          alignItems="center"
                          mt="$4"
                          pt="$4"
                          borderTopWidth={1}
                          borderTopColor={darkTheme.border}
                        >
                          <Avatar size="sm" mr="$3">
                            <Avatar.Image
                              source={{
                                uri:
                                  hostUserData.avatar ||
                                  "https://static.vecteezy.com/system/resources/previews/008/442/086/non_2x/illustration-of-human-icon-user-symbol-icon-modern-design-on-blank-background-free-vector.jpg",
                              }}
                              alt="Host avatar"
                            />
                          </Avatar>
                          <VStack flex={1}>
                            <Text color={darkTheme.textSecondary} fontSize="$xs">
                              Ride Host
                            </Text>
                            <Text color={darkTheme.textPrimary} fontSize="$sm" fontWeight="500">
                              {hostUserData.name}
                            </Text>
                          </VStack>
                        </HStack>
                      )}
                    </Box>
                  )}

                  {/* Ratings Section */}
                  <VStack space="lg" mb="$6">
                    <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="600">
                      How was your experience? ⭐
                    </Text>

                    <RatingStars
                      rating={feedbackForm.rating}
                      onRate={(value) => handleRatingSelect("overall", value)}
                      label="Overall Experience"
                      description="How would you rate this ride overall?"
                    />

                    <RatingStars
                      rating={feedbackForm.driverRating}
                      onRate={(value) => handleRatingSelect("driver", value)}
                      label="Driver/Host"
                      description="How was the driver/host's performance?"
                    />

                    <RatingStars
                      rating={feedbackForm.communicationRating}
                      onRate={(value) =>
                        handleRatingSelect("communication", value)
                      }
                      label="Communication"
                      description="How was the communication before/during the ride?"
                    />

                    <RatingStars
                      rating={feedbackForm.safetyRating}
                      onRate={(value) => handleRatingSelect("safety", value)}
                      label="Safety & Comfort"
                      description="Did you feel safe and comfortable during the ride?"
                    />

                    <RatingStars
                      rating={feedbackForm.punctualityRating}
                      onRate={(value) =>
                        handleRatingSelect("punctuality", value)
                      }
                      label="Punctuality"
                      description="Was the ride on time as scheduled?"
                    />
                  </VStack>

                  {/* Would Ride Again */}
                  <VStack space="md" mb="$6">
                    <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="600">
                      Would you ride with this host again? 🤔
                    </Text>
                    <HStack space="sm" mt="$2">
                      <YesNoButton
                        selected={feedbackForm.wouldRideAgain === true}
                        onSelect={handleWouldRideAgain}
                        label="Yes, definitely!"
                        type="yes"
                      />
                      <YesNoButton
                        selected={feedbackForm.wouldRideAgain === false}
                        onSelect={(value) => handleWouldRideAgain(false)}
                        label="Probably not"
                        type="no"
                      />
                    </HStack>
                  </VStack>

                  {/* Report Issue */}
                  <VStack space="md" mb="$6">
                    <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="600">
                      Any issues to report? 🚨
                    </Text>
                    <HStack space="sm" mt="$2">
                      <YesNoButton
                        selected={feedbackForm.reportIssue === true}
                        onSelect={handleReportIssue}
                        label="Yes, report issue"
                        type="issue"
                      />
                      <YesNoButton
                        selected={feedbackForm.reportIssue === false}
                        onSelect={(value) => handleReportIssue(false)}
                        label="No issues"
                        type="no"
                      />
                    </HStack>

                    {feedbackForm.reportIssue && (
                      <VStack space="sm" mt="$4">
                        <Text
                          color={darkTheme.textPrimary}
                          fontSize="$sm"
                          fontWeight="$semibold"
                        >
                          Please describe the issue:
                        </Text>
                        <Textarea
                          bg={darkTheme.raised}
                          borderColor={darkTheme.danger}
                          minHeight="$24"
                        >
                          <TextareaInput
                            placeholder="Describe any safety concerns, inappropriate behavior, or other issues you encountered..."
                            color={darkTheme.textPrimary}
                            placeholderTextColor={darkTheme.textSecondary}
                            value={feedbackForm.issueDetails}
                            onChangeText={(text) =>
                              setFeedbackForm((prev) => ({
                                ...prev,
                                issueDetails: text,
                              }))
                            }
                            multiline
                            textAlignVertical="top"
                          />
                        </Textarea>
                      </VStack>
                    )}
                  </VStack>

                  {/* Comments & Suggestions */}
                  <VStack space="lg" mb="$6">
                    <VStack space="sm">
                      <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="600">
                        Additional Comments 💬
                      </Text>
                      <Text color={darkTheme.textFaint} fontSize="$sm">
                        Any other thoughts about the ride?
                      </Text>
                      <Textarea
                        bg={darkTheme.raised}
                        borderColor={darkTheme.border}
                        minHeight="$32"
                        mt="$2"
                      >
                        <TextareaInput
                          placeholder="Share any positive experiences, things that could be improved, or general feedback..."
                          color={darkTheme.textPrimary}
                          placeholderTextColor={darkTheme.textSecondary}
                          value={feedbackForm.comments}
                          onChangeText={(text) =>
                            setFeedbackForm((prev) => ({
                              ...prev,
                              comments: text,
                            }))
                          }
                          multiline
                          textAlignVertical="top"
                        />
                      </Textarea>
                    </VStack>

                    <VStack space="sm">
                      <Text color={darkTheme.textPrimary} fontSize="$lg" fontWeight="600">
                        Suggestions for Improvement 💡
                      </Text>
                      <Text color={darkTheme.textFaint} fontSize="$sm">
                        How can we make the ride-sharing experience better?
                      </Text>
                      <Textarea
                        bg={darkTheme.raised}
                        borderColor={darkTheme.border}
                        minHeight="$32"
                        mt="$2"
                      >
                        <TextareaInput
                          placeholder="Your ideas for improving the app, matching process, safety features, etc..."
                          color={darkTheme.textPrimary}
                          placeholderTextColor={darkTheme.textSecondary}
                          value={feedbackForm.suggestions}
                          onChangeText={(text) =>
                            setFeedbackForm((prev) => ({
                              ...prev,
                              suggestions: text,
                            }))
                          }
                          multiline
                          textAlignVertical="top"
                        />
                      </Textarea>
                    </VStack>
                  </VStack>

                  {/* Action Buttons */}
                  <VStack space="md" mb="$4">
                    <Button
                      bg={ACCENT}
                      onPress={handleSubmit}
                      disabled={
                        submitting ||
                        feedbackForm.rating === 0 ||
                        feedbackForm.wouldRideAgain === null
                      }
                      size="lg"
                      borderRadius="$lg"
                      opacity={submitting || feedbackForm.rating === 0 || feedbackForm.wouldRideAgain === null ? 0.6 : 1}
                    >
                      {submitting ? (
                        <HStack space="sm" alignItems="center">
                          <ActivityIndicator size="small" color={darkTheme.bg} />
                          <ButtonText color={darkTheme.bg}>Submitting...</ButtonText>
                        </HStack>
                      ) : (
                        <ButtonText
                          color={darkTheme.bg}
                          fontSize="$md"
                          fontWeight="$semibold"
                        >
                          Submit Feedback
                        </ButtonText>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      borderColor={darkTheme.borderStrong}
                      onPress={handleRateLater}
                      disabled={submitting}
                      size="lg"
                      borderRadius="$lg"
                    >
                      <ButtonText color={darkTheme.textSecondary}>Remind Me Later</ButtonText>
                    </Button>
                  </VStack>

                  {/* Footer Note */}
                  <VStack space="xs" mt="$4">
                    <Text color={darkTheme.textMuted} fontSize="$xs" textAlign="center">
                      ⓘ Your feedback is anonymous unless you include personal
                      information.
                    </Text>
                    <Text color={darkTheme.textMuted} fontSize="$xs" textAlign="center">
                      ⓘ All submissions are reviewed to improve our community
                      standards.
                    </Text>
                    <Text color={darkTheme.textMuted} fontSize="$xs" textAlign="center">
                      ⓘ Reported issues are investigated within 24-48 hours.
                    </Text>
                  </VStack>
                </ScrollView>
            </Box>
          </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: darkTheme.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
    minHeight: "85%",
  },
});
