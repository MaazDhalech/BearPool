import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Standard bottom sheet used across the app. Consistent grabber, dark rounded
 * container, optional centered header (title + close), and a tap-outside
 * backdrop. Use <SheetAction> for the standard tappable rows.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View
              style={[
                styles.sheet,
                { paddingBottom: Math.max(insets.bottom, SPACE.md) + SPACE.sm },
              ]}
            >
              <View style={styles.grabber} />
              {title ? (
                <>
                  <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
                      <Ionicons name="close" size={20} color="#cfcfcf" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.divider} />
                </>
              ) : null}
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

/** A standard sheet row: icon + label, with an optional tint (e.g. destructive). */
export function SheetAction({
  icon,
  label,
  onPress,
  tint = "#e8e8e8",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.action}>
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const SHEET_DESTRUCTIVE = "#ff5a5a";

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1e1e1e",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: SPACE.sm,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#3a3a3a",
    marginBottom: SPACE.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.md,
  },
  title: { color: "#ffffff", fontSize: TYPE.size.subheading, fontWeight: TYPE.weight.bold },
  close: {
    position: "absolute",
    right: SPACE.lg,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { height: 1, backgroundColor: "#2a2a2a", marginBottom: 4 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  actionLabel: { fontSize: TYPE.size.body },
});
