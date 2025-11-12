import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";

export default function TabBarBackground() {
  const blur =
    Platform.OS === "ios"
      ? {
          tint: "systemChromeMaterialDark" as const,
          intensity: 70,
        }
      : {
          tint: "dark" as const,
          intensity: 50,
        };

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        tint={blur.tint}
        intensity={blur.intensity}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(5,5,5,0.9)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
});

export function useBottomTabOverflow() {
  return 0;
}
