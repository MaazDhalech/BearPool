import { darkTheme } from "@/constants/theme";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * iMessage-style long-press menu for chat messages. Renders a dimmed/blurred
 * backdrop, a lifted copy of the pressed bubble (at its measured on-screen
 * frame), a floating emoji reaction pill above it, and an action list below.
 *
 * Built in pure RN so it works on the New Architecture and both platforms —
 * the native context-menu auxiliary preview is broken on Expo 54 / RN 0.81.
 * The caller measures the bubble (`measureInWindow`) and passes the frame plus
 * a `renderBubble` closure that re-draws the same bubble visual.
 */

export type MessageMenuAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

export type MessageMenuState = {
  frame: { x: number; y: number; width: number; height: number };
  isCurrentUser: boolean;
  reactionEmojis: string[];
  /** Emojis the current user has already reacted with (highlighted). */
  activeEmojis: string[];
  onReact: (emoji: string) => void;
  actions: MessageMenuAction[];
  renderBubble: () => React.ReactNode;
};

const PILL_H = 48;
const EMOJI_BTN = 42;
const ACTION_ROW_H = 48;
const ACTION_W = 232;
const GAP = 10;
const EDGE = 12;

export function MessageMenu({
  state,
  onClose,
}: {
  state: MessageMenuState | null;
  onClose: () => void;
}) {
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const lift = useSharedValue(0);
  useEffect(() => {
    lift.value = state ? withSpring(1, { damping: 17, stiffness: 240 }) : 0;
  }, [state]);

  const bubbleAnim = useAnimatedStyle(() => ({
    transform: [{ scale: 0.97 + lift.value * 0.06 }],
  }));

  if (!state) return <Modal visible={false} transparent />;

  const f = state.frame;
  const { isCurrentUser, reactionEmojis, activeEmojis, actions } = state;

  // ── Vertical layout: keep pill + bubble + actions on screen ──
  const actionsH = actions.length * ACTION_ROW_H;
  const topLimit = insets.top + EDGE;
  const bottomLimit = SH - insets.bottom - EDGE;
  const pillBlock = PILL_H + GAP;
  const actionsBlock = GAP + actionsH;

  let shift = 0;
  const desiredTop = f.y - pillBlock;
  if (desiredTop < topLimit) shift = topLimit - desiredTop;
  const desiredBottom = f.y + shift + f.height + actionsBlock;
  if (desiredBottom > bottomLimit) shift -= desiredBottom - bottomLimit;

  const bubbleTop = f.y + shift;
  const pillTop = bubbleTop - pillBlock;
  const actionsTop = bubbleTop + f.height + GAP;

  // ── Horizontal layout: anchor to the bubble's side, clamp to screen ──
  const pillW = reactionEmojis.length * EMOJI_BTN + SPACE.sm * 2;
  const clampLeft = (preferred: number, w: number) =>
    Math.max(EDGE, Math.min(preferred, SW - EDGE - w));
  const pillLeft = clampLeft(
    isCurrentUser ? f.x + f.width - pillW : f.x,
    pillW,
  );
  const actionsLeft = clampLeft(
    isCurrentUser ? f.x + f.width - ACTION_W : f.x,
    ACTION_W,
  );

  const close = () => onClose();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.32)" }]} />

        {/* Lifted bubble copy */}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", left: f.x, top: bubbleTop, width: f.width },
            bubbleAnim,
          ]}
        >
          {state.renderBubble()}
        </Animated.View>

        {/* Reaction pill */}
        <Animated.View
          entering={FadeIn.duration(180)}
          style={{ position: "absolute", top: pillTop, left: pillLeft }}
        >
          <View style={styles.pill}>
            {reactionEmojis.map((emoji) => {
              const mine = activeEmojis.includes(emoji);
              return (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    state.onReact(emoji);
                    close();
                  }}
                  style={[styles.emojiBtn, mine && styles.emojiBtnActive]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Action list */}
        <Animated.View
          entering={FadeIn.duration(180)}
          style={{ position: "absolute", top: actionsTop, left: actionsLeft, width: ACTION_W }}
        >
          <View style={styles.actions}>
            {actions.map((a, i) => (
              <Pressable
                key={a.key}
                onPress={() => {
                  close();
                  a.onPress();
                }}
                style={({ pressed }) => [
                  styles.actionRow,
                  i > 0 && styles.actionDivider,
                  pressed && styles.actionPressed,
                ]}
              >
                <Text
                  style={[styles.actionLabel, a.destructive && { color: darkTheme.danger }]}
                >
                  {a.label}
                </Text>
                <Ionicons
                  name={a.icon}
                  size={19}
                  color={a.destructive ? darkTheme.danger : darkTheme.textBright}
                />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: darkTheme.surface,
    borderRadius: 999,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkTheme.raised,
    ...shadow(),
  },
  emojiBtn: {
    width: EMOJI_BTN,
    height: EMOJI_BTN,
    borderRadius: EMOJI_BTN / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiBtnActive: {
    backgroundColor: "rgba(10,132,255,0.18)",
    borderWidth: 1,
    borderColor: "#0a84ff",
  },
  emoji: { fontSize: 26 },

  actions: {
    backgroundColor: darkTheme.surface,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkTheme.raised,
    ...shadow(),
  },
  actionRow: {
    height: ACTION_ROW_H,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.lg,
  },
  actionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: darkTheme.raised },
  actionPressed: { backgroundColor: darkTheme.raised },
  actionLabel: { color: darkTheme.textBright, fontSize: TYPE.size.body, fontWeight: "500" },
});

function shadow() {
  return {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  };
}
