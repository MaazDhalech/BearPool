import { useTheme } from "@/hooks/useTheme";
import React, { useCallback, useImperativeHandle, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";

/** Imperative handle for AppSheet: `ref.current?.present()` / `.dismiss()`. */
export type AppSheetRef = {
  present: (index?: number) => Promise<void>;
  dismiss: () => Promise<void>;
  resize: (index: number) => Promise<void>;
};

type AppSheetProps = {
  children?: React.ReactNode;
  detents?: (string | number)[];
  backgroundColor?: string;
  cornerRadius?: number;
  grabber?: boolean;
  onDismiss?: () => void;
};

/**
 * Themed native bottom sheet. Currently implemented as a Modal fallback
 * because @lodev09/react-native-true-sheet is not linked in the native binary.
 * Swap back to TrueSheet once `pod install` + a native rebuild is done.
 */
export const AppSheet = React.forwardRef<AppSheetRef, AppSheetProps>(
  function AppSheet({ children, onDismiss, cornerRadius = 20 }, ref) {
    const t = useTheme();
    const [visible, setVisible] = useState(false);

    const present = useCallback(async () => {
      setVisible(true);
    }, []);

    const dismiss = useCallback(async () => {
      setVisible(false);
      onDismiss?.();
    }, [onDismiss]);

    useImperativeHandle(ref, () => ({
      present,
      dismiss,
      resize: async () => {},
    }));

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={dismiss}
      >
        <TouchableWithoutFeedback onPress={dismiss}>
          <View style={s.overlay} />
        </TouchableWithoutFeedback>
        <View
          style={[
            s.sheet,
            {
              backgroundColor: t.surface,
              borderTopLeftRadius: cornerRadius,
              borderTopRightRadius: cornerRadius,
            },
          ]}
        >
          {/* grabber */}
          <Pressable onPress={dismiss} style={s.grabberRow}>
            <View style={[s.grabber, { backgroundColor: t.textSecondary }]} />
          </Pressable>
          {children}
        </View>
      </Modal>
    );
  },
);

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 34,
  },
  grabberRow: {
    alignItems: "center",
    paddingVertical: 12,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
});
