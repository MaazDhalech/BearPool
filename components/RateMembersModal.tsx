// components/RateMembersModal.tsx
//
// Shown right after the existing ride-feedback modal is submitted.
// Lists the OTHER members of the ride and lets the user tap 1–5 stars
// for each. Rating everyone is optional — un-starred members are skipped.

import { ACCENT } from "@/constants/Colors";
import { darkTheme } from "@/constants/theme";
import { db } from "@/services/firebaseConfig";
import { submitMemberRatings } from "@/utils/userRatings";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Member = {
  id: string;
  name: string;
  avatar?: string;
};

type Props = {
  visible: boolean;
  rideId: string | null;
  /** All memberIds on the ride; the current user is filtered out here. */
  memberIds: string[];
  currentUserId: string | null;
  onClose: () => void;
};

export default function RateMembersModal({
  visible,
  rideId,
  memberIds,
  currentUserId,
  onClose,
}: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [stars, setStars] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load name + avatar for every other member when the modal opens
  useEffect(() => {
    if (!visible || !currentUserId) return;

    const otherIds = memberIds.filter((id) => id !== currentUserId);

    const load = async () => {
      setLoading(true);
      const loaded: Member[] = [];
      for (const id of otherIds) {
        try {
          const snap = await getDoc(doc(db, "users", id));
          if (!snap.exists()) continue;
          const data = snap.data();
          loaded.push({
            id,
            name:
              data.first_name && data.last_name
                ? `${data.first_name} ${data.last_name}`
                : data.username || "BearPool user",
            avatar: typeof data.avatar === "string" ? data.avatar : undefined,
          });
        } catch {
          // Skip members we fail to load rather than blocking the modal
        }
      }
      setMembers(loaded);
      setStars({});
      setLoading(false);
    };

    load();
  }, [visible, currentUserId, memberIds]);

  const ratedCount = Object.values(stars).filter((s) => s > 0).length;

  const handleSubmit = async () => {
    if (!rideId || !currentUserId || ratedCount === 0) return;
    setSubmitting(true);
    try {
      await submitMemberRatings(
        rideId,
        currentUserId,
        Object.entries(stars).map(([ratedUserId, s]) => ({
          ratedUserId,
          stars: s,
        })),
      );
    } catch (e) {
      console.error("Failed to submit member ratings:", e);
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  // Nothing to rate (e.g. solo ride) → close automatically
  useEffect(() => {
    if (visible && !loading && members.length === 0) onClose();
  }, [visible, loading, members.length]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Rate your ride members</Text>
          <Text style={styles.subtitle}>
            Help other Bears know who&apos;s great to ride with. Optional —
            skip anyone you&apos;d rather not rate.
          </Text>

          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 32 }} />
          ) : (
            members.map((m) => (
              <View key={m.id} style={styles.memberRow}>
                <View style={styles.memberInfo}>
                  {m.avatar ? (
                    <Image source={{ uri: m.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>
                        {m.name[0]?.toUpperCase() || "?"}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.name}
                  </Text>
                </View>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() =>
                        setStars((prev) => ({ ...prev, [m.id]: n }))
                      }
                      hitSlop={6}
                    >
                      <Ionicons
                        name={(stars[m.id] || 0) >= n ? "star" : "star-outline"}
                        size={26}
                        color={(stars[m.id] || 0) >= n ? "#f5c518" : darkTheme.textSecondary}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            style={[styles.submitButton, ratedCount === 0 && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={ratedCount === 0 || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {ratedCount > 0 ? `Submit ${ratedCount} rating${ratedCount > 1 ? "s" : ""}` : "Submit"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} disabled={submitting}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: darkTheme.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: darkTheme.border,
  },
  title: {
    color: darkTheme.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: darkTheme.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: darkTheme.border,
  },
  memberInfo: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginRight: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  avatarFallback: {
    backgroundColor: darkTheme.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: darkTheme.textPrimary,
    fontWeight: "700",
  },
  memberName: {
    color: darkTheme.textPrimary,
    fontSize: 15,
    flexShrink: 1,
  },
  starRow: {
    flexDirection: "row",
    gap: 4,
  },
  submitButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 18,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  skipText: {
    color: darkTheme.textSecondary,
    textAlign: "center",
    marginTop: 14,
    fontSize: 14,
  },
});