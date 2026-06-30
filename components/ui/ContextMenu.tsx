import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleProp, ViewStyle } from "react-native";

/**
 * Native iOS context menus (UIMenu) with a graceful fallback.
 *
 * On iOS we render `ContextMenuView` from `react-native-ios-context-menu`, so a
 * long-press lifts the wrapped content and shows the system menu. Android — and
 * iOS before the dev-client is rebuilt — fall back to a long-press that calls
 * `onFallbackPress`, which the caller wires to the existing bottom `Sheet`.
 *
 * Used for simple menus (e.g. group-settings members). Chat reactions use the
 * custom `MessageMenu` instead, because the library's interactive auxiliary
 * preview is broken on the New Architecture (Expo 54 / RN 0.81).
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
        menuConfig={{
          menuTitle: menuTitle ?? "",
          menuItems: actions.map((a) => ({
            actionKey: a.key,
            actionTitle: a.title,
            menuAttributes: a.destructive ? ["destructive"] : [],
            ...(a.systemIcon
              ? { icon: { type: "IMAGE_SYSTEM", imageValue: { systemName: a.systemIcon } } }
              : {}),
          })),
        }}
        onPressMenuItem={({ nativeEvent }: any) =>
          actions.find((a) => a.key === nativeEvent.actionKey)?.onPress()
        }
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

// ── Chat message menu (native iOS) ──────────────────────────────────────────
// Real UIMenu wrapping the bubble: an inline emoji-reaction row pinned to the
// top of the menu, then the message actions below. Native lift + blur. The
// floating reaction *bar* (auxiliary preview) is broken on RN 0.81 / iOS 26, so
// reactions live as a native inline row instead. On Android this is a
// passthrough — the caller drives its own overlay via a long-press gesture.
const REACT_PREFIX = "react::";

export function ChatMessageMenu({
  reactionEmojis,
  activeEmojis,
  onReact,
  actions,
  style,
  children,
}: {
  reactionEmojis: string[];
  /** Emojis the current user has already reacted with (shows a checkmark). */
  activeEmojis: string[];
  onReact: (emoji: string) => void;
  actions: MenuAction[];
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  if (!nativeContextMenuAvailable) return <>{children}</>;

  return (
    <ContextMenuView
      style={style}
      menuConfig={{
        menuTitle: "",
        menuItems: [
          {
            menuOptions: ["displayInline"],
            menuItems: reactionEmojis.map((e) => ({
              actionKey: `${REACT_PREFIX}${e}`,
              actionTitle: e,
              menuState: activeEmojis.includes(e) ? "on" : "off",
            })),
          },
          ...actions.map((a) => ({
            actionKey: a.key,
            actionTitle: a.title,
            menuAttributes: a.destructive ? ["destructive"] : [],
            ...(a.systemIcon
              ? { icon: { type: "IMAGE_SYSTEM", imageValue: { systemName: a.systemIcon } } }
              : {}),
          })),
        ],
      }}
      onPressMenuItem={({ nativeEvent }: any) => {
        const key: string = nativeEvent.actionKey;
        if (key.startsWith(REACT_PREFIX)) {
          onReact(key.slice(REACT_PREFIX.length));
          return;
        }
        actions.find((a) => a.key === key)?.onPress();
      }}
    >
      {children}
    </ContextMenuView>
  );
}
