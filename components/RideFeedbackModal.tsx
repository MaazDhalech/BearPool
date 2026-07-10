// components/RideFeedbackModal.tsx
import { ActionButton } from "@/components/ui/ActionButton";
import { toast } from "@/components/ui/Dialog";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useTheme } from "@/hooks/useTheme";
import { submitRideReview } from "@/services/rideReviews";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

/** Minimal shape the modal needs. Extra ride fields are ignored. */
export type RideFeedbackRide = {
  id: string;
  from?: string;
  to?: string;
  date?: string;
  time?: string;
};

type FeedbackModalProps = {
  visible: boolean;
  rideInfo: RideFeedbackRide | null;
  onClose: () => void;
  onRateLater?: () => void;
  onFeedbackSubmit?: () => void;
};

const MAX_FEEDBACK_LENGTH = 300;

export default function RideFeedbackModal({
  visible,
  rideInfo,
  onClose,
  onRateLater,
  onFeedbackSubmit,
}: FeedbackModalProps) {
  const t = useTheme();
  const { userId } = useFirebaseAuth();

  const [rating, setRating] = useState(0);
  const [completed, setCompleted] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Start each prompt from a blank slate.
  useEffect(() => {
    if (visible) {
      setRating(0);
      setCompleted(null);
      setFeedback("");
      setSubmitting(false);
    }
  }, [visible]);

  const canSubmit = rating > 0 && completed !== null && !submitting;

  const handleSubmit = async () => {
    if (!rideInfo?.id || !userId || !canSubmit) return;
    setSubmitting(true);
    try {
      await submitRideReview(rideInfo.id, userId, {
        rating,
        completed: completed!,
        feedback,
      });
      toast("Thanks for the feedback");
      onFeedbackSubmit?.();
      onClose();
    } catch (err) {
      console.error("Failed to submit ride review:", err);
      toast("Couldn't submit your rating. Please try again.", { type: "error" });
      setSubmitting(false);
    }
  };

  const handleRateLater = () => {
    onRateLater?.();
    onClose();
  };

  const route =
    rideInfo?.from && rideInfo?.to ? `${rideInfo.from} → ${rideInfo.to}` : "your ride";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={[styles.overlay, { backgroundColor: t.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.sheet, { backgroundColor: t.bg }]}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ padding: SPACE.xl, paddingBottom: SPACE["3xl"] }}
                >
                  {/* Grabber */}
                  <View
                    style={{
                      alignSelf: "center",
                      width: 36,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: t.borderStrong,
                      marginBottom: SPACE.xl,
                    }}
                  />

                  <Text
                    style={{
                      color: t.textPrimary,
                      fontSize: TYPE.size.heading,
                      fontWeight: TYPE.weight.bold,
                    }}
                  >
                    How was your ride?
                  </Text>
                  <Text
                    style={{
                      color: t.textSecondary,
                      fontSize: TYPE.size.caption,
                      marginTop: SPACE.xs,
                    }}
                    numberOfLines={1}
                  >
                    {route}
                    {rideInfo?.date ? ` · ${rideInfo.date}` : ""}
                  </Text>

                  {/* Stars */}
                  <Text style={[styles.label, { color: t.textSecondary }]}>Rating</Text>
                  <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Pressable
                        key={star}
                        onPress={() => setRating(star)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={`${star} star${star === 1 ? "" : "s"}`}
                      >
                        <Ionicons
                          name={star <= rating ? "star" : "star-outline"}
                          size={34}
                          color={star <= rating ? t.accent : t.textMuted}
                        />
                      </Pressable>
                    ))}
                  </View>

                  {/* Completed */}
                  <Text style={[styles.label, { color: t.textSecondary }]}>
                    Did this ride happen?
                  </Text>
                  <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                    <ChoicePill
                      label="Yes, it happened"
                      active={completed === true}
                      onPress={() => setCompleted(true)}
                    />
                    <ChoicePill
                      label="It never happened"
                      active={completed === false}
                      onPress={() => setCompleted(false)}
                    />
                  </View>

                  {/* Feedback */}
                  <Text style={[styles.label, { color: t.textSecondary }]}>
                    Feedback <Text style={{ color: t.textMuted }}>(optional)</Text>
                  </Text>
                  <TextInput
                    value={feedback}
                    onChangeText={(text) =>
                      text.length <= MAX_FEEDBACK_LENGTH && setFeedback(text)
                    }
                    placeholder="Anything worth sharing about this ride?"
                    placeholderTextColor={t.placeholder}
                    multiline
                    textAlignVertical="top"
                    style={{
                      backgroundColor: t.surface,
                      color: t.textPrimary,
                      borderWidth: 1,
                      borderColor: t.border,
                      borderRadius: 10,
                      padding: SPACE.md,
                      minHeight: 90,
                      fontSize: TYPE.size.body,
                    }}
                  />
                  <Text
                    style={{
                      color: t.textMuted,
                      fontSize: TYPE.size.micro,
                      textAlign: "right",
                      marginTop: SPACE.xs,
                    }}
                  >
                    {feedback.length} / {MAX_FEEDBACK_LENGTH}
                  </Text>

                  {/* Actions */}
                  <View style={{ marginTop: SPACE.xl, gap: SPACE.sm }}>
                    <ActionButton
                      label={submitting ? "Submitting..." : "Submit"}
                      onPress={handleSubmit}
                      loading={submitting}
                      disabled={!canSubmit}
                    />
                    <ActionButton
                      label="Remind me later"
                      variant="ghost"
                      onPress={handleRateLater}
                      disabled={submitting}
                    />
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ChoicePill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        paddingVertical: SPACE.md,
        borderRadius: 999,
        borderWidth: 1,
        alignItems: "center",
        borderColor: active ? t.accent : t.border,
        backgroundColor: active ? t.accent + "1f" : t.surface,
      }}
    >
      <Text
        style={{
          color: active ? t.accent : t.textSecondary,
          fontSize: TYPE.size.body,
          fontWeight: active ? TYPE.weight.semibold : TYPE.weight.regular,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  label: {
    fontSize: TYPE.size.label,
    fontWeight: TYPE.weight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: SPACE.xl,
    marginBottom: SPACE.sm,
  },
});
