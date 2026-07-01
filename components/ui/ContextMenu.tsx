import { darkTheme } from "@/constants/theme";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { showMenu } from "@/components/ui/Dialog";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

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
let ContextMenuButton: any = null;
if (Platform.OS === "ios") {
  try {
    const lib = require("react-native-ios-context-menu");
    ContextMenuView = lib.ContextMenuView;
    ContextMenuButton = lib.ContextMenuButton;
  } catch {
    ContextMenuView = null;
    ContextMenuButton = null;
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
            // `menuTitle` is required — the native RNIMenuItem parser drops any
            // submenu/inline group without it (even when empty).
            menuTitle: "",
            menuOptions: ["displayInline"],
            // Horizontal palette row (UIMenu.preferredElementSize = .small, iOS 16+).
            menuPreferredElementSize: "small",
            // No `menuState` here — the checkmark accessory widens each item and
            // forces the palette to wrap (4+2 instead of a single row of 6).
            menuItems: reactionEmojis.map((e) => ({
              actionKey: `${REACT_PREFIX}${e}`,
              actionTitle: e,
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

// ── Filter dropdown ─────────────────────────────────────────────────────────
// A labelled chip that opens a native iOS dropdown (ContextMenuButton, tap to
// open) to pick one option; the current value shows a checkmark. On Android it
// falls back to the in-app action sheet (showMenu).
// `label` shows in the dropdown menu; `chipLabel` (optional) is the shorter text
// shown on the collapsed chip so a long option doesn't overflow the row.
export type DropdownOption = { key: string; label: string; chipLabel?: string };

export function FilterDropdown({
  icon,
  options,
  selectedKey,
  onSelect,
  title,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  options: DropdownOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  title?: string;
}) {
  const selected = options.find((o) => o.key === selectedKey);

  const chip = (
    <View style={dropdownStyles.chip}>
      {icon ? <Ionicons name={icon} size={15} color={darkTheme.accent} /> : null}
      <Text style={dropdownStyles.chipText} numberOfLines={1}>
        {selected?.chipLabel ?? selected?.label ?? ""}
      </Text>
      <Ionicons name="chevron-down" size={14} color={darkTheme.textMuted} />
    </View>
  );

  if (Platform.OS === "ios" && ContextMenuButton) {
    return (
      <ContextMenuButton
        menuConfig={{
          menuTitle: title ?? "",
          menuItems: options.map((o) => ({
            actionKey: o.key,
            actionTitle: o.label,
            menuState: o.key === selectedKey ? "on" : "off",
          })),
        }}
        onPressMenuItem={({ nativeEvent }: any) => onSelect(nativeEvent.actionKey)}
      >
        {chip}
      </ContextMenuButton>
    );
  }

  return (
    <Pressable
      onPress={() =>
        showMenu({
          title,
          options: options.map((o) => ({ label: o.label, onPress: () => onSelect(o.key) })),
        })
      }
    >
      {chip}
    </Pressable>
  );
}

const dropdownStyles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: darkTheme.surface,
    borderWidth: 1,
    borderColor: darkTheme.border,
    borderRadius: 999,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  chipText: { color: darkTheme.textBright, fontSize: TYPE.size.label, fontWeight: "600" },
});
