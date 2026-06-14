import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useAccessibility } from "./AccessibilityContext";
import { colors } from "../theme";
import { subscribeToToasts, type ToastPayload } from "../services/toast";

type VisibleToast = ToastPayload & { id: number };

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const { highContrast, screenReaderOptimized, textScale, touchTarget } = useAccessibility();
  const [toast, setToast] = useState<VisibleToast | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -12, duration: 160, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  useEffect(() => subscribeToToasts((nextToast) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setToast({ ...nextToast, id: Date.now() });
    fade.setValue(0);
    translateY.setValue(-12);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(hideToast, nextToast.durationMs ?? 3200);
  }), [fade, translateY]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const accentStyle = toast?.type === "success"
    ? styles.successAccent
    : toast?.type === "error"
      ? styles.errorAccent
      : styles.infoAccent;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.toastWrap, { opacity: fade, transform: [{ translateY }] }]}
        >
          <Pressable
            style={[
              styles.toastCard,
              { minHeight: Math.max(62, touchTarget) },
              highContrast ? styles.highContrastToast : null,
            ]}
            onPress={hideToast}
            accessibilityRole="alert"
            accessibilityLabel={screenReaderOptimized ? `${toast.title}${toast.message ? `. ${toast.message}` : ""}` : undefined}
          >
            <View style={[styles.accent, accentStyle]} />
            <View style={styles.textWrap}>
              <Text style={[styles.title, { fontSize: 14 * textScale, lineHeight: 18 * textScale }]}>{toast.title}</Text>
              {toast.message ? <Text style={[styles.message, { fontSize: 12 * textScale, lineHeight: 17 * textScale }]} numberOfLines={3}>{toast.message}</Text> : null}
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  toastWrap: {
    position: "absolute",
    top: 54,
    left: 14,
    right: 14,
    zIndex: 9999,
    alignItems: "center",
  },
  toastCard: {
    width: "100%",
    maxWidth: 460,
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(8,19,28,0.97)",
    overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  highContrastToast: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000" },
  accent: { width: 5 },
  successAccent: { backgroundColor: colors.success },
  errorAccent: { backgroundColor: colors.danger },
  infoAccent: { backgroundColor: colors.primary },
  textWrap: { flex: 1, paddingHorizontal: 13, paddingVertical: 10, minWidth: 0 },
  title: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", marginBottom: 2 },
  message: { color: "#D8E7EE", fontSize: 12, fontWeight: "700", lineHeight: 17 },
});