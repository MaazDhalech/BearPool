import { useTheme } from "@/hooks/useTheme";
import React from "react";
import { View, type ViewProps } from "react-native";

type Props = ViewProps & {
  fallbackColor?: string;
  effect?: string;
  colorScheme?: string;
};

/**
 * Liquid-glass surface that degrades gracefully: on iOS 26 it renders a real
 * Apple liquid-glass material; everywhere else it falls back to a solid themed
 * surface so layouts stay identical.
 *
 * NOTE: @callstack/liquid-glass is not linked in the native binary, so this
 * component always renders the solid fallback until that module is installed.
 */
export function GlassSurface({
  children,
  style,
  fallbackColor,
  effect: _effect,
  colorScheme: _colorScheme,
  ...rest
}: Props) {
  const t = useTheme();

  return (
    <View style={[{ backgroundColor: fallbackColor ?? t.raised }, style]} {...rest}>
      {children}
    </View>
  );
}
