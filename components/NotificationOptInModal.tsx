import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Modal, Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onEnable: () => void;
  onClose: () => void;
  isDenied?: boolean;
};

export const NotificationOptInModal = ({
  visible,
  onEnable,
  onClose,
  isDenied = false,
}: Props) => {
  const primaryLabel = useMemo(
    () => (isDenied ? "Open Settings" : "Enable"),
    [isDenied]
  );

  const body = useMemo(
    () =>
      isDenied
        ? "Notifications are off. Enable them in Settings to get chat messages and ride updates for this ride."
        : "Get notified about new chat messages and ride updates for this ride.",
    [isDenied]
  );

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
            backgroundColor: "#121212",
            borderRadius: 14,
            padding: 20,
            borderWidth: 1,
            borderColor: "#2a2a2a",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons name="notifications" size={22} color="#ffffff" />
            <Text
              style={{
                color: "#ffffff",
                fontSize: 18,
                fontWeight: "700",
                marginLeft: 8,
              }}
            >
              Enable notifications?
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
            {body}
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
              onPress={onEnable}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                backgroundColor: "#3a7bd5",
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>
                {primaryLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};
