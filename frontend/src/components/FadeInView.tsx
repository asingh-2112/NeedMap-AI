import { useEffect, useRef } from "react";
import { Animated, type ViewStyle } from "react-native";

export const FadeInView = ({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: ViewStyle }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, shift]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY: shift }] }]}>{children}</Animated.View>;
};
