import { darkTheme } from "@/constants/theme";
import { SPACE } from "@/constants/Spacing";
import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

/**
 * Native iOS context menus (UIMenu) with a graceful fallback.
 *
 * On iOS we render `ContextMenuView` from `react-native-ios-context-menu`, so a
 * long-press lifts the wrapped content and shows the system menu (plus, for
 * chat, a floating reaction bar as the auxiliary preview). Android — and iOS
 * before the dev-client is rebuilt — fall back to a long-press that calls
 * `onFallbackPress`, which the caller wires to the existing bottom `Sheet`.
 *
 * The native module is required lazily and behind a try/catch so a missing
 * binary degrades to the fallback instead of crashing the bundle.
 */

let ContextMenuView: any = null;
if (Platform.OS === "ios") {
  try {
    ContextMenuView = require("react-native-ios-context-menu").ContextMenuView;
  } catch {
    ContextMenuView = null;
  }
}

export const nativeContextMenuAvailable = Platform.OS === "ios" && !!ContextMenuView;

export type MenuAction = {
  key: string;
  title: string;
  /** SF Symbol name — iOS native menu only (e.g. "trash", "person"). */
  systemIcon?: string;
  destructive?: boolean;
  onPress: () => void;
};

function toMenuItems(actions: MenuAction[]) {
  return actions.map((a) => ({
    actionKey: a.key,
    actionTitle: a.title,
    menuAttributes: a.destructive ? ["destructive"] : [],
    ...(a.systemIcon
      ? { icon: { type: "IMAGE_SYSTEM", imageValue: { systemName: a.systemIcon } } }
      : {}),
  }));
}

function dispatch(actions: MenuAction[], actionKey: string) {
  actions.find((a) => a.key === actionKey)?.onPress();
}

// ── Generic context menu ───────────────────────────────────────────────────
export function ContextMenu({
  actions,
  menuTitle,
  onFallbackPress,
  disabled,
  style,
  children,
}: {
  actions: MenuAction[];
  menuTitle?: string;
  /** Android / pre-rebuild long-press handler (opens the caller's Sheet). */
  onFallbackPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  if (nativeContextMenuAvailable && !disabled) {
    return (
      <ContextMenuView
        style={style}
        menuConfig={{ menuTitle: menuTitle ?? "", menuItems: toMenuItems(actions) }}
        onPressMenuItem={({ nativeEvent }: any) => dispatch(actions, nativeEvent.actionKey)}
      >
        {children}
      </ContextMenuView>
    );
  }

  return (
    <Pressable
      style={style}
      delayLongPress={250}
      onLongPress={
        disabled || !onFallbackPress
          ? undefined
          : () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onFallbackPress();
            }
      }
    >
      {children}
    </Pressable>
  );
}

// ── Reaction context menu (chat bubbles) ────────────────────────────────────
// Adds a horizontal emoji bar above the lifted bubble via the iOS auxiliary
// preview. Tapping an emoji toggles the reaction and dismisses the menu.
function ReactionBar({
  emojis,
  active,
  onReact,
}: {
  emojis: string[];
  active: string[];
  onReact: (emoji: string) => void;
}) {
  return (
    <View style={styles.reactionBar}>
      {emojis.map((emoji) => {
        const mine = active.includes(emoji);
        return (
          <Pressable
            key={emoji}
            onPress={() => onReact(emoji)}
            style={[styles.reactionPill, mine && styles.reactionPillActive]}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReactionContextMenu({
  reactionEmojis,
  activeEmojis,
  onReact,
  actions,
  onFallbackPress,
  align = "leading",
  disabled,
  style,
  children,
}: {
  reactionEmojis: string[];
  /** Emojis the current user has already reacted with (for highlighting). */
  activeEmojis: string[];
  onReact: (emoji: string) => void;
  actions: MenuAction[];
  onFallbackPress: () => void;
  align?: "leading" | "trailing";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const ref = useRef<any>(null);

  if (nativeContextMenuAvailable && !disabled) {
    return (
      <ContextMenuView
        ref={ref}
        style={style}
        isAuxiliaryPreviewEnabled
        auxiliaryPreviewConfig={{
          anchorPosition: "top",
          alignmentHorizontal:
            align === "trailing" ? "previewTrailing" : "previewLeading",
          transitionEntranceDelay: "RECOMMENDED",
          height: 52,
        }}
        renderAuxiliaryPreview={() => (
          <ReactionBar
            emojis={reactionEmojis}
            active={activeEmojis}
            onReact={(emoji) => {
              onReact(emoji);
              ref.current?.dismissMenu?.();
            }}
          />
        )}
        menuConfig={{ menuTitle: "", menuItems: toMenuItems(actions) }}
        onPressMenuItem={({ nativeEvent }: any) => dispatch(actions, nativeEvent.actionKey)}
      >
        {children}
      </ContextMenuView>
    );
  }

  return (
    <Pressable
      style={style}
      delayLongPress={200}
      onLongPress={
        disabled
          ? undefined
          : () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onFallbackPress();
            }
      }
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  reactionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.xs,
    backgroundColor: darkTheme.surface,
    borderRadius: 999,
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: darkTheme.raised,
  },
  reactionPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionPillActive: {
    backgroundColor: "rgba(10,132,255,0.18)",
    borderWidth: 1,
    borderColor: "#0a84ff",
  },
  reactionEmoji: { fontSize: 24 },
});
