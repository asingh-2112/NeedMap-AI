import { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAccessibility } from "../../context/AccessibilityContext";
import { fonts } from "../../theme";

type Props = {
  onLogin: () => void;
  onVolunteerSignup: () => void;
  onOrganizationSignup: () => void;
};

export const LandingScreen = ({ onLogin, onVolunteerSignup }: Props) => {
  const { highContrast, reduceMotion, screenReaderOptimized, textScale, touchTarget } = useAccessibility();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (reduceMotion) {
      fadeIn.setValue(1);
      slideUp.setValue(0);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fadeIn, reduceMotion, slideUp]);

  const textStyle = (fontSize: number, lineHeight?: number) => ({
    fontSize: fontSize * textScale,
    ...(lineHeight ? { lineHeight: lineHeight * textScale } : {}),
  });
  const touchStyle = { minHeight: touchTarget };

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={["#4A00E0", "#6C3CE1", "#8E2DE2"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative circles */}
      <View style={[styles.circle, styles.circleTopRight]} />
      <View style={[styles.circle, styles.circleBottomLeft]} />
      <View style={[styles.circle, styles.circleSmall]} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.container, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

          {/* Illustration area */}
          <View style={styles.illustrationArea}>
            <View style={styles.illustrationCircle}>
              <Text style={styles.illustrationEmoji}>🤝</Text>
            </View>
            <View style={styles.floatingDot1} />
            <View style={styles.floatingDot2} />
            <View style={styles.floatingDot3} />
          </View>

          {/* White card */}
          <View style={[styles.card, highContrast ? styles.highContrastCard : null]}>
            <Text style={[styles.title, textStyle(28, 34)]}>NeedMap AI</Text>
            <Text style={[styles.subtitle, textStyle(14, 21)]}>
              Connecting volunteers with communities in need through AI-powered matching
            </Text>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, textStyle(20, 25)]}>500+</Text>
                <Text style={[styles.statLabel, textStyle(11, 15)]}>Volunteers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, textStyle(20, 25)]}>1.2K</Text>
                <Text style={[styles.statLabel, textStyle(11, 15)]}>Needs Met</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, textStyle(20, 25)]}>50+</Text>
                <Text style={[styles.statLabel, textStyle(11, 15)]}>NGOs</Text>
              </View>
            </View>

            {/* Buttons */}
            <Pressable style={styles.primaryBtn} onPress={onLogin} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? "Login to NeedMap AI" : undefined}>
              <LinearGradient
                colors={["#6C3CE1", "#4A00E0"]}
                style={[styles.btnGradient, touchStyle]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.primaryBtnText, textStyle(16, 21)]}>Login</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={[styles.secondaryBtn, touchStyle]} onPress={onVolunteerSignup} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? "Create volunteer account" : undefined}>
              <Text style={[styles.secondaryBtnText, textStyle(16, 21)]}>Create Account</Text>
            </Pressable>

            <Text style={[styles.footerText, textStyle(12, 17)]}>
              Making a difference, together 🌍
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 40 },

  // Decorative background circles
  circle: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  circleTopRight: { width: 200, height: 200, top: -50, right: -50 },
  circleBottomLeft: { width: 260, height: 260, bottom: -80, left: -80 },
  circleSmall: { width: 80, height: 80, top: 120, left: 30, backgroundColor: "rgba(255,255,255,0.05)" },

  // Illustration
  illustrationArea: { alignItems: "center", marginBottom: 30, position: "relative", height: 140 },
  illustrationCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  illustrationEmoji: { fontSize: 48 },
  floatingDot1: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: "#FFD166", top: 10, right: 60 },
  floatingDot2: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: "#06D6A0", bottom: 20, left: 50 },
  floatingDot3: { position: "absolute", width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.3)", top: 40, left: 40 },

  // White Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 12,
  },
  highContrastCard: { borderColor: "#000000", borderWidth: 3, backgroundColor: "#FFFFFF" },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#2D2B55",
    fontFamily: fonts.heading,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#7B7B9B",
    fontFamily: fonts.body,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 24,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 28,
    paddingVertical: 16,
    backgroundColor: "#F8F7FF",
    borderRadius: 16,
  },
  statItem: { alignItems: "center" },
  statNumber: { fontSize: 20, fontWeight: "900", color: "#4A00E0", fontFamily: fonts.heading },
  statLabel: { fontSize: 11, color: "#7B7B9B", fontFamily: fonts.body, marginTop: 2 },

  // Buttons
  primaryBtn: { marginBottom: 12, borderRadius: 14, overflow: "hidden" },
  btnGradient: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800", fontFamily: fonts.body, letterSpacing: 0.5 },

  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E8E5F5",
    backgroundColor: "#F8F7FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  secondaryBtnText: { color: "#4A00E0", fontSize: 16, fontWeight: "800", fontFamily: fonts.body },

  footerText: {
    textAlign: "center",
    color: "#AEAEC0",
    fontSize: 12,
    fontFamily: fonts.body,
  },
});
