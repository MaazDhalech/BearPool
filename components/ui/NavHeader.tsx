import { GlassSurface } from "@/components/ui/GlassSurface";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useTheme } from "@/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BTN = 40;

/** Circular liquid-glass icon button used on the header edges. */
function CircleButton({
  name,
  onPress,
  accessibilityLabel,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <GlassSurface
        fallbackColor={t.raised}
        style={{
          width: BTN,
          height: BTN,
          borderRadius: BTN / 2,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Ionicons name={name} size={20} color={t.textPrimary} />
      </GlassSurface>
    </TouchableOpacity>
  );
}

type Props = {
  title?: string;
  subtitle?: string;
  /** Defaults to router.back(). */
  onBack?: () => void;
  showBack?: boolean;
  /** Trailing circular action button. */
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightLabel?: string;
  /** Makes the centered title block tappable. */
  onTitlePress?: () => void;
  style?: ViewStyle;
};

/**
 * Centered one-line navigation header: a circular back button on the left, a
 * centered bold title with an optional subtitle, and an optional circular action
 * on the right. The edge buttons use liquid glass (falling back to a solid
 * surface). Self-contained — render as the first child of the screen; do NOT
 * wrap it in another safe-area / paddingTop container.
 */
export function NavHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  rightIcon,
  onRightPress,
  rightLabel,
  onTitlePress,
  style,
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const titleBlock = (
    <View style={{ flex: 1, alignItems: "center", paddingHorizontal: SPACE.sm }}>
      {title ? (
        <Text
          numberOfLines={1}
          style={{
            color: t.textPrimary,
            fontSize: TYPE.size.subheading,
            fontWeight: TYPE.weight.bold,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text
          numberOfLines={1}
          style={{
            color: t.textSecondary,
            fontSize: TYPE.size.label,
            textAlign: "center",
            marginTop: 1,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[{ paddingTop: insets.top, backgroundColor: t.bg }, style]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACE.md,
          paddingVertical: SPACE.sm,
          minHeight: BTN + SPACE.sm,
        }}
      >
        {/* Left slot (fixed width so the title stays centered) */}
        <View style={{ width: BTN }}>
          {showBack ? (
            <CircleButton
              name="arrow-back"
              onPress={onBack ?? (() => router.back())}
              accessibilityLabel="Go back"
            />
          ) : null}
        </View>

        {/* Centered title */}
        {onTitlePress ? (
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.7} onPress={onTitlePress}>
            {titleBlock}
          </TouchableOpacity>
        ) : (
          titleBlock
        )}

        {/* Right slot (mirrors the left so the title is truly centered) */}
        <View style={{ width: BTN, alignItems: "flex-end" }}>
          {rightIcon ? (
            <CircleButton
              name={rightIcon}
              onPress={onRightPress ?? (() => {})}
              accessibilityLabel={rightLabel ?? "More"}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}
