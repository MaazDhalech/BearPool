import { darkTheme } from "@/constants/theme";
import { ACCENT } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  from: string;
  to: string;
  onAdd: () => void;
  onClose: () => void;
};

export const CalendarOptInModal = ({ visible, from, to, onAdd, onClose }: Props) => {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            backgroundColor: darkTheme.bg,
            borderRadius: 14,
            padding: 20,
            borderWidth: 1,
            borderColor: darkTheme.raised,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons name="calendar" size={22} color={darkTheme.textPrimary} />
            <Text
              style={{
                color: darkTheme.textPrimary,
                fontSize: 18,
                fontWeight: "700",
                marginLeft: 8,
              }}
            >
              Add this ride to your calendar?
            </Text>
          </View>

          <Text
            style={{
              color: "#cfcfcf",
              fontSize: 14,
              lineHeight: 20,
              marginBottom: 18,
            }}
          >
            {`Get a reminder before ${from} → ${to} departs, so it doesn't sneak up on you.`}
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Pressable
              onPress={onClose}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                marginRight: 10,
              }}
            >
              <Text style={{ color: "#b0b0b0", fontSize: 14, fontWeight: "600" }}>
                Not now
              </Text>
            </Pressable>
            <Pressable
              onPress={onAdd}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                backgroundColor: ACCENT,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: darkTheme.bg, fontSize: 14, fontWeight: "700" }}>
                Add to Calendar
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
