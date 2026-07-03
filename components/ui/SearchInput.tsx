import { TYPE } from "@/constants/Typography";
import { SPACE } from "@/constants/Spacing";
import { useTheme } from "@/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { TextInput, TouchableOpacity, View, type ViewStyle } from "react-native";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
  autoFocus?: boolean;
};

/** Themed search field with a leading search icon and a clear button. */
export function SearchInput({
  value,
  onChangeText,
  placeholder = "Search...",
  style,
  autoFocus,
}: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          height: 44,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={16} color={t.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.placeholder}
        accessibilityLabel={placeholder}
        style={{
          flex: 1,
          color: t.textPrimary,
          fontSize: TYPE.size.body,
          paddingVertical: 0,
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={16} color={t.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
