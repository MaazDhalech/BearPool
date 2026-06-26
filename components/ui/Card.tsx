import { SPACE } from "@/constants/Spacing";
import { useTheme } from "@/hooks/useTheme";
import React from "react";
import { TouchableOpacity, View, type ViewStyle } from "react-native";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  /** Accent border to flag unread / highlighted cards. */
  highlighted?: boolean;
  activeOpacity?: number;
  accessibilityLabel?: string;
};

/** Standard surface card used for list items across the app. */
export function Card({
  children,
  onPress,
  style,
  highlighted = false,
  activeOpacity = 0.85,
  accessibilityLabel,
}: Props) {
  const t = useTheme();
  const cardStyle: ViewStyle = {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: highlighted ? t.accent + "55" : t.border,
    borderRadius: 12,
    padding: SPACE.lg,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={activeOpacity}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[cardStyle, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}
