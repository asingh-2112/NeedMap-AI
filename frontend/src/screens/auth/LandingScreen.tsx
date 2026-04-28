import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts } from "../../theme";

type Props = {
  onLogin: () => void;
  onVolunteerSignup: () => void;
  onOrganizationSignup: () => void;
};


const HERO_GIF = "https://kokanngo.org/public/website/images/great_place/walking.gif";

export const LandingScreen = ({ onLogin, onVolunteerSignup, onOrganizationSignup }: Props) => {
  const { loginBypass } = useAuth();
  const y1 = useRef(new Animated.Value(0)).current;
  const y2 = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(y1, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(y1, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(y2, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(y2, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    ).start();
  }, [y1, y2, glow]);

  const t1 = y1.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const t2 = y2.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });

  return (
    <View style={styles.page}>
      <LinearGradient colors={[colors.bg, colors.bgSoft, colors.bgWarm]} style={StyleSheet.absoluteFillObject} />

      <Animated.View style={[styles.softLight, { opacity: glowOpacity }]} />
      <Animated.View style={[styles.blob, styles.blobA, { transform: [{ translateY: t1 }] }]} />
      <Animated.View style={[styles.blob, styles.blobB, { transform: [{ translateY: t2 }] }]} />

      <View style={styles.container}>
        <Text style={styles.brand}>NeedMap AI</Text>
        <Text style={styles.heading}>Relief Network Console</Text>
        <Text style={styles.sub}>Coordinated response for NGOs, admins, and volunteers in one dark command center.</Text>

        <View style={styles.heroCard}>
          <Image source={{ uri: HERO_GIF }} style={styles.heroGif} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <Text style={styles.heroTitle}>Live Humanitarian Pulse</Text>
          <Text style={styles.heroText}>Track needs, add sources, assign volunteers, and close response loops faster.</Text>
        </View>

        <Text style={styles.welcomeTitle}>Welcome to NeedMap-AI</Text>

        <Pressable style={styles.primary} onPress={() => loginBypass("volunteer@needmap.ai", "vol123", "volunteer")}>
          <Text style={styles.primaryText}>Continue as Volunteer</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => loginBypass("admin@needmap.ai", "admin123", "admin")}>
          <Text style={styles.secondaryText}>Continue as Admin</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  container: { flex: 1, justifyContent: "center", padding: 24 },

  brand: { color: colors.accent, fontSize: 22, fontWeight: "900", marginBottom: 8, fontFamily: fonts.accent },
  heading: { color: colors.text, fontSize: 36, fontWeight: "900", marginBottom: 8, fontFamily: fonts.heading },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 22, marginBottom: 14, fontFamily: fonts.body },

  softLight: {
    position: "absolute",
    width: 340,
    height: 210,
    borderRadius: 180,
    top: 90,
    alignSelf: "center",
    backgroundColor: colors.accent,
  },

  blob: { position: "absolute", borderRadius: 999, opacity: 0.28 },
  blobA: { width: 230, height: 230, top: 80, left: -65, backgroundColor: colors.blobA },
  blobB: { width: 270, height: 270, right: -85, bottom: 120, backgroundColor: colors.blobB },

  heroCard: {
    height: 160,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "flex-end",
    padding: 12,
  },
  heroGif: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  heroOverlay: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0, backgroundColor: "rgba(5,14,20,0.56)" },
  heroTitle: { color: colors.textStrong, fontSize: 16, fontWeight: "900", marginBottom: 3, fontFamily: fonts.heading },
  heroText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: fonts.body },

  welcomeTitle: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 14, fontFamily: fonts.heading },

  secondary: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  secondaryText: { color: colors.textStrong, fontWeight: "800", fontFamily: fonts.body },

  label: { color: colors.textStrong, fontWeight: "800", marginBottom: 6, fontFamily: fonts.body },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontFamily: fonts.body,
  },
  hint: { color: colors.muted, fontSize: 12, marginBottom: 14, fontFamily: fonts.body },

  primary: {
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryText: { color: colors.textStrong, fontSize: 16, fontWeight: "900", fontFamily: fonts.body },

  secondary: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  secondaryText: { color: colors.textStrong, fontWeight: "800", fontFamily: fonts.body },
});
