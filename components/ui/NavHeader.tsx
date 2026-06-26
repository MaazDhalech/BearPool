import { TYPE } from "@/constants/Typography";
import { useTheme } from "@/hooks/useTheme";
import { isLiquidGlassSupported, LiquidGlassView } from "@callstack/liquid-glass";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";

const CIRCLE = 44;

// Raw device top inset, computed once - so every NavHeader sits at the exact
// same vertical spot on every screen, independent of each screen's container /
// SafeAreaContext (gluestack Box, KeyboardAvoidingView, etc.). Mirrors Tippy.
const TOP_INSET = initialWindowMetrics?.insets.top ?? 54;

// Translucent "glassy" look on platforms/OS versions without real liquid glass.
const glassFallback = {
  backgroundColor: "rgba(128,128,128,0.18)",
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.12)",
} as const;

/** Circular liquid-glass action button (back / trailing action). */
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
    <View style={[s.circle, !isLiquidGlassSupported && glassFallback]}>
      {isLiquidGlassSupported && (
        <LiquidGlassView
          colorScheme="dark"
          style={[StyleSheet.absoluteFill, { borderRadius: CIRCLE / 2 }]}
        />
      )}
      <TouchableOpacity
        onPress={onPress}
        hitSlop={10}
        style={s.circleInner}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name={name} size={20} color={t.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

type Props = {
  title?: string;
  subtitle?: string;
  /** Defaults to router.back(). */
  onBack?: () => void;
  showBack?: boolean;
  /** Trailing circular glass action. */
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightLabel?: string;
  /** Makes the centered title tappable. */
  onTitlePress?: () => void;
  style?: ViewStyle;
};

/**
 * Tippy-style header: a centered plain-text title flanked by circular
 * liquid-glass action buttons (back on the left, an optional action on the
 * right). The bar itself is transparent - only the side buttons are glass.
 * Self-contained (includes the top safe-area inset); render as the first child
 * of a screen.
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

  const titleText = (
    <>
      {title ? (
        <Text numberOfLines={1} style={[s.title, { color: t.textPrimary }]}>
          {title}
        </Text>
      ) : null}
      {subtitle ? (
        <Text numberOfLines={1} style={[s.subtitle, { color: t.textSecondary }]}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={[{ paddingTop: TOP_INSET }, s.container, style]}>
      {/* Left */}
      {showBack ? (
        <CircleButton
          name="chevron-back"
          onPress={onBack ?? (() => router.back())}
          accessibilityLabel="Go back"
        />
      ) : (
        <View style={s.spacer} />
      )}

      {/* Center - just text, no glass */}
      {onTitlePress ? (
        <TouchableOpacity style={s.center} activeOpacity={0.7} onPress={onTitlePress}>
          {titleText}
        </TouchableOpacity>
      ) : (
        <View style={s.center}>{titleText}</View>
      )}

      {/* Right */}
      {rightIcon ? (
        <CircleButton
          name={rightIcon}
          onPress={onRightPress ?? (() => {})}
          accessibilityLabel={rightLabel ?? "More"}
        />
      ) : (
        <View style={s.spacer} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: "transparent",
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    overflow: "hidden",
    flexShrink: 0,
  },
  circleInner: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: { width: CIRCLE, flexShrink: 0 },
  // Fixed height so the row is always CIRCLE tall whether or not side buttons
  // are present - keeps the title at the exact same Y on every screen.
  center: { flex: 1, height: CIRCLE, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "600", letterSpacing: -0.2, textAlign: "center" },
  subtitle: { fontSize: TYPE.size.label, textAlign: "center", marginTop: 1 },
});
