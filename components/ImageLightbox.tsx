import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect } from "react";
import { Dimensions, Modal, StyleSheet, TouchableOpacity } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/** Full-screen image viewer: pinch-to-zoom, pan, double-tap zoom, swipe to dismiss. */
export function ImageLightbox({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const backdrop = useSharedValue(1);

  useEffect(() => {
    if (uri) {
      scale.value = 1;
      savedScale.value = 1;
      tx.value = 0;
      ty.value = 0;
      savedTx.value = 0;
      savedTy.value = 0;
      backdrop.value = 1;
    }
  }, [uri]); // eslint-disable-line react-hooks/exhaustive-deps

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        tx.value = savedTx.value + e.translationX;
        ty.value = savedTy.value + e.translationY;
      } else {
        ty.value = e.translationY;
        backdrop.value = Math.max(0, 1 - Math.abs(e.translationY) / 400);
      }
    })
    .onEnd((e) => {
      if (scale.value > 1) {
        savedTx.value = tx.value;
        savedTy.value = ty.value;
      } else if (Math.abs(e.translationY) > 120) {
        runOnJS(onClose)();
      } else {
        ty.value = withTiming(0);
        backdrop.value = withTiming(1);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, backdropStyle]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.center}>
          {uri ? (
            <Animated.View style={imgStyle}>
              <Image
                source={{ uri }}
                style={{ width: SCREEN_W, height: SCREEN_H }}
                contentFit="contain"
              />
            </Animated.View>
          ) : null}
        </Animated.View>
      </GestureDetector>
      <TouchableOpacity
        onPress={onClose}
        hitSlop={12}
        style={[styles.close, { top: insets.top + 8 }]}
      >
        <Ionicons name="close" size={26} color="#fff" />
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  close: {
    position: "absolute",
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
