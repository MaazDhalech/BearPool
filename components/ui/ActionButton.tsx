import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useTheme } from "@/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  type ViewStyle,
} from "react-native";

type Variant = "primary" | "secondary" | "ghost";

type Props = {
  label: string;
  onPress?: (e?: any) => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

/**
 * Standard button.
 *  - primary:   filled accent (dark label)
 *  - secondary: outlined accent (accent label)
 *  - ghost:     subtle outline (muted label)
 */
export function ActionButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
  accessibilityLabel,
}: Props) {
  const t = useTheme();
  const isDisabled = disabled || loading;

  const bg = variant === "primary" ? t.accent : "transparent";
  const borderColor =
    variant === "secondary" ? t.accent : variant === "ghost" ? t.border : "transparent";
  const labelColor =
    variant === "primary"
      ? t.onAccent
      : variant === "secondary"
      ? t.accent
      : t.textSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled }}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: SPACE.sm,
          paddingHorizontal: SPACE.lg,
          paddingVertical: SPACE.sm + 2,
          borderRadius: 10,
          borderWidth: variant === "primary" ? 0 : 1,
          backgroundColor: bg,
          borderColor,
          opacity: isDisabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={labelColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={labelColor} /> : null}
          <Text
            style={{
              color: labelColor,
              fontSize: TYPE.size.body,
              fontWeight: TYPE.weight.semibold,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
