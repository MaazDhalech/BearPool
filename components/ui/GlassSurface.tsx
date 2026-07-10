import { useTheme } from "@/hooks/useTheme";
import {
  isLiquidGlassSupported,
  LiquidGlassView,
  type LiquidGlassViewProps,
} from "@callstack/liquid-glass";
import React from "react";
import { View } from "react-native";

type Props = LiquidGlassViewProps & {
  /** Solid background used when liquid glass isn't supported (older OS / Android). */
  fallbackColor?: string;
};

// Real value is provided natively; the JS stub types it as a literal, so widen it.
const supported = isLiquidGlassSupported as boolean;

/**
 * Liquid-glass surface that degrades gracefully: on iOS 26 it renders a real
 * Apple liquid-glass material; everywhere else it falls back to a solid themed
 * surface so layouts stay identical.
 */
export function GlassSurface({
  children,
  style,
  fallbackColor,
  effect = "regular",
  colorScheme = "dark",
  ...rest
}: Props) {
  const t = useTheme();

  if (!supported) {
    return (
      <View style={[{ backgroundColor: fallbackColor ?? t.raised }, style]}>
        {children}
      </View>
    );
  }

  return (
    <LiquidGlassView effect={effect} colorScheme={colorScheme} style={style} {...rest}>
      {children}
    </LiquidGlassView>
  );
}
