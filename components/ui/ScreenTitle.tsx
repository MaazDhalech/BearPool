import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { useTheme } from "@/hooks/useTheme";
import { Text, type TextStyle } from "react-native";

/**
 * The large scrolling page title used at the top of tab screens
 * (e.g. "Upcoming\nRide Groups"). Standardizes size, weight, spacing and color.
 */
export function ScreenTitle({
  children,
  style,
}: {
  children: string;
  style?: TextStyle;
}) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[
        {
          color: t.textPrimary,
          fontSize: TYPE.size.display,
          fontWeight: TYPE.weight.bold,
          lineHeight: TYPE.size.display * TYPE.leading.tight,
          marginTop: SPACE["4xl"],
          marginBottom: SPACE["2xl"],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
