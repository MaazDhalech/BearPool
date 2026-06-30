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

type Variant = "primary" | "secondary" | "ghost" | "danger";

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
 * Standard button. Filled hierarchy, no outlines.
 *  - primary:   accent fill (dark label)
 *  - secondary: subtle raised-surface fill (primary-text label)
 *  - ghost:     transparent, borderless (muted label)
 *  - danger:    tinted-red fill (danger label) for destructive actions
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

  const bg =
    variant === "primary"
      ? t.accent
      : variant === "secondary"
      ? t.raised
      : variant === "danger"
      ? t.danger + "1f"
      : "transparent";
  const labelColor =
    variant === "primary"
      ? t.onAccent
      : variant === "secondary"
      ? t.textPrimary
      : variant === "danger"
      ? t.danger
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
          backgroundColor: bg,
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
