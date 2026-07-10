import { useTheme } from "@/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, type ViewStyle } from "react-native";

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Required so the control is announced by screen readers. */
  accessibilityLabel: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
};

/** A tappable icon with a generous hit area and an accessibility label. */
export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  size = 22,
  color,
  style,
}: Props) {
  const t = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[{ padding: 6 }, style]}
    >
      <Ionicons name={name} size={size} color={color ?? t.textPrimary} />
    </TouchableOpacity>
  );
}
