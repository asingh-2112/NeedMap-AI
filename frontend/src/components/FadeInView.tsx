import { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { useAccessibility } from "../context/AccessibilityContext";

export const FadeInView = ({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) => {
  const { reduceMotion } = useAccessibility();
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      shift.setValue(0);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [delay, opacity, reduceMotion, shift]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY: shift }] }]}>{children}</Animated.View>;
};
