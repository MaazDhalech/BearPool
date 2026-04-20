import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import { useEffect } from "react";
import { ViewStyle } from "react-native";

type Props = {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
};

export function FadeSlideIn({ children, delay = 0, style }: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 350 }));
  }, []);

  return (
    <Animated.View style={[animStyle, style]}>{children}</Animated.View>
  );
}
