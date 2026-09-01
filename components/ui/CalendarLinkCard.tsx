import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { darkTheme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type Props = {
  linked: boolean;
  busy: boolean;
  onToggle: () => void;
  testID?: string;
};

/**
 * "Add to Calendar" card shared by the ride details and group settings
 * screens - keeps both in sync instead of hand-copying styles.
 */
export function CalendarLinkCard({ linked, busy, onToggle, testID }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: linked ? darkTheme.success + "14" : darkTheme.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: linked ? darkTheme.success + "40" : darkTheme.border,
        paddingHorizontal: SPACE.lg,
        paddingVertical: SPACE.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, flex: 1 }}>
        <Ionicons
          name={linked ? "checkmark-circle" : "calendar-outline"}
          size={22}
          color={linked ? darkTheme.success : darkTheme.accent}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: darkTheme.textPrimary, fontSize: TYPE.size.body, fontWeight: TYPE.weight.semibold }}>
            {linked ? "Added to Calendar" : "Add to Calendar"}
          </Text>
          <Text style={{ color: darkTheme.textSecondary, fontSize: TYPE.size.label, marginTop: 2 }}>
            {linked ? "This ride is on your calendar" : "Get a reminder before it starts"}
          </Text>
        </View>
      </View>
      <Pressable
        testID={testID}
        disabled={busy}
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={linked ? "Remove ride from calendar" : "Add ride to calendar"}
        accessibilityState={{ disabled: busy, busy }}
        style={{
          minWidth: 64,
          alignItems: "center",
          justifyContent: "center",
          opacity: busy ? 0.7 : 1,
          borderRadius: 99,
          paddingHorizontal: SPACE.md,
          paddingVertical: SPACE.sm - 2,
          backgroundColor: linked ? "transparent" : darkTheme.accent,
          borderWidth: linked ? 1 : 0,
          borderColor: darkTheme.border,
        }}
      >
        {busy ? (
          <ActivityIndicator
            size="small"
            color={linked ? darkTheme.textSecondary : darkTheme.onAccent}
          />
        ) : (
          <Text
            style={{
              color: linked ? darkTheme.textSecondary : darkTheme.onAccent,
              fontSize: TYPE.size.label,
              fontWeight: TYPE.weight.bold,
            }}
          >
            {linked ? "Remove" : "Add"}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
