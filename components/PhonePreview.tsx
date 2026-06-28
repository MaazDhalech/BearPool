import { ACCENT } from "@/constants/Colors";
import { SPACE } from "@/constants/Spacing";
import { TYPE } from "@/constants/Typography";
import { Ionicons } from "@expo/vector-icons";
import { Linking, type StyleProp, Text, TouchableOpacity, View, type ViewStyle } from "react-native";

/** Call/message card for a phone number shared in chat. */
export function PhonePreview({
  phone,
  alignRight,
  style,
}: {
  phone: string;
  alignRight: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const digits = phone.replace(/[^\d+]/g, "");
  return (
    <View
      style={[
        {
          width: 250,
          maxWidth: "100%",
          alignSelf: alignRight ? "flex-end" : "flex-start",
          backgroundColor: "#1e1e1e",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#2a2a2a",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.sm,
          paddingHorizontal: SPACE.md,
          paddingVertical: SPACE.md,
        }}
      >
        <Ionicons name="call" size={18} color={ACCENT} />
        <Text style={{ color: "#e8e8e8", fontSize: TYPE.size.body, fontWeight: "600" }}>{phone}</Text>
      </View>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: "#2a2a2a" }}>
        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${digits}`).catch(() => {})}
          activeOpacity={0.7}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, paddingVertical: SPACE.md }}
        >
          <Ionicons name="call-outline" size={17} color={ACCENT} />
          <Text style={{ color: ACCENT, fontSize: TYPE.size.body, fontWeight: "600" }}>Call</Text>
        </TouchableOpacity>
        <View style={{ width: 1, backgroundColor: "#2a2a2a" }} />
        <TouchableOpacity
          onPress={() => Linking.openURL(`sms:${digits}`).catch(() => {})}
          activeOpacity={0.7}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, paddingVertical: SPACE.md }}
        >
          <Ionicons name="chatbubble-outline" size={17} color={ACCENT} />
          <Text style={{ color: ACCENT, fontSize: TYPE.size.body, fontWeight: "600" }}>Message</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
