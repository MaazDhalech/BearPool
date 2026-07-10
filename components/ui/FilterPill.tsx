import { TYPE } from "@/constants/Typography";
import { useTheme } from "@/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, type ViewStyle } from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  active?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  accessibilityLabel?: string;
  style?: ViewStyle;
};

/** Small pill button used for sort toggles and filter chips. */
export function FilterPill({
  label,
  onPress,
  active = false,
  icon,
  iconPosition = "right",
  accessibilityLabel,
  style,
}: Props) {
  const t = useTheme();
  const glyph = icon ? (
    <Ionicons name={icon} size={12} color={t.accent} />
  ) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: active ? t.accent : t.border,
          backgroundColor: active ? t.accent + "22" : t.surface,
        },
        style,
      ]}
    >
      {icon && iconPosition === "left" ? glyph : null}
      <Text
        style={{
          color: t.accent,
          fontSize: TYPE.size.label,
          fontWeight: TYPE.weight.semibold,
        }}
      >
        {label}
      </Text>
      {icon && iconPosition === "right" ? glyph : null}
    </TouchableOpacity>
  );
}
