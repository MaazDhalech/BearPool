import { ACCENT } from "@/constants/Colors";
import { darkTheme } from "@/constants/theme";
import { TYPE } from "@/constants/Typography";
import { ActivityIndicator, type StyleProp, Text, View, type ViewStyle } from "react-native";

/**
 * Centered loading spinner with an optional label. Use while a screen's data
 * is loading so content fades in rather than snapping.
 */
export function LoadingState({
  label,
  style,
}: {
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { alignItems: "center", justifyContent: "center", paddingVertical: 72, gap: 12 },
        style,
      ]}
    >
      <ActivityIndicator size="large" color={ACCENT} />
      {label ? (
        <Text style={{ color: darkTheme.textMuted, fontSize: TYPE.size.label }}>{label}</Text>
      ) : null}
    </View>
  );
}
