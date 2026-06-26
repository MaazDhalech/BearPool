import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useTheme } from "@/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  title?: string;
  subtitle?: string;
  /** Defaults to router.back(). */
  onBack?: () => void;
  showBack?: boolean;
  /** Element rendered at the trailing edge (e.g. an IconButton). */
  right?: React.ReactNode;
  /** Makes the title block tappable (e.g. open group settings from a chat). */
  onTitlePress?: () => void;
  borderColor?: string;
  style?: ViewStyle;
};

/**
 * Standard top navigation bar for stack screens: safe-area inset + back button +
 * title (optional subtitle) + optional trailing action, with a bottom hairline.
 * Self-contained — render it as the first child of the screen (do NOT wrap it in
 * another safe-area / paddingTop container).
 */
export function NavHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
  onTitlePress,
  borderColor,
  style,
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const titleBlock = (
    <View style={{ flex: 1 }}>
      {title ? (
        <Text
          numberOfLines={1}
          style={{
            color: t.textPrimary,
            fontSize: TYPE.size.subheading,
            fontWeight: TYPE.weight.bold,
          }}
        >
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text
          numberOfLines={1}
          style={{ color: t.textSecondary, fontSize: TYPE.size.label, marginTop: 1 }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View
      style={[
        {
          paddingTop: insets.top,
          backgroundColor: t.bg,
          borderBottomWidth: 1,
          borderBottomColor: borderColor ?? t.border,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACE.md,
          paddingVertical: SPACE.sm + 2,
        }}
      >
        {showBack ? (
          <TouchableOpacity
            onPress={onBack ?? (() => router.back())}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 6, marginRight: 6 }}
          >
            <Ionicons name="arrow-back" size={24} color={t.textPrimary} />
          </TouchableOpacity>
        ) : null}

        {onTitlePress ? (
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.7} onPress={onTitlePress}>
            {titleBlock}
          </TouchableOpacity>
        ) : (
          titleBlock
        )}

        {right ? <View style={{ marginLeft: SPACE.sm }}>{right}</View> : null}
      </View>
    </View>
  );
}
