import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { colors, fonts } from "../../theme";

type Props = {
  onBack: () => void;
};

export const OrganizationSignupScreen = ({ onBack }: Props) => {
  const { registerOrganization, loading, baseUrl } = useAuth();
  const { highContrast, reduceMotion, screenReaderOptimized, textScale, touchTarget } = useAccessibility();

  const [organizationName, setOrganizationName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0);
      drift.setValue(0);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1700, useNativeDriver: true }),
      ]),
    );

    const driftAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ]),
    );

    pulseAnimation.start();
    driftAnimation.start();
    return () => {
      pulseAnimation.stop();
      driftAnimation.stop();
    };
  }, [drift, pulse, reduceMotion]);

  const textStyle = (fontSize: number, lineHeight?: number) => ({
    fontSize: fontSize * textScale,
    ...(lineHeight ? { lineHeight: lineHeight * textScale } : {}),
  });
  const touchStyle = { minHeight: touchTarget };
  const highContrastInput = highContrast ? styles.highContrastInput : null;

  const disabled =
    loading ||
    organizationName.trim().length < 2 ||
    ownerName.trim().length < 2 ||
    !ownerEmail.trim() ||
    ownerPassword.trim().length < 8;

  const onSubmit = async () => {
    try {
      await registerOrganization({
        organizationName,
        address,
        phone,
        ownerName,
        ownerEmail,
        ownerPassword,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Organization signup failed";
      Alert.alert("Organization signup failed", `${msg}\n\nBackend URL: ${baseUrl}`);
    }
  };

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.45] });
  const lift = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  return (
    <View style={styles.page}>
      <LinearGradient colors={[colors.bg, colors.bgSoft, colors.bgWarm]} style={StyleSheet.absoluteFillObject} />

      <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
      <Animated.View style={[styles.blob, styles.blobA, { transform: [{ translateY: lift }] }]} />
      <Animated.View style={[styles.blob, styles.blobB, { transform: [{ translateY: lift }] }]} />

      <View style={styles.container}>
        <Text style={[styles.title, textStyle(34, 40)]}>Register Organization</Text>
        <Text style={[styles.subtitle, textStyle(14, 20)]}>Create org + first owner account in one step.</Text>

        <Text style={[styles.label, textStyle(14, 19)]}>Organization Name</Text>
        <TextInput style={[styles.input, touchStyle, highContrastInput, textStyle(14, 19)]} value={organizationName} onChangeText={setOrganizationName} placeholder="Hope Foundation" placeholderTextColor={colors.muted} accessibilityLabel="Organization name" />

        <Text style={[styles.label, textStyle(14, 19)]}>Address (optional)</Text>
        <TextInput style={[styles.input, touchStyle, highContrastInput, textStyle(14, 19)]} value={address} onChangeText={setAddress} placeholder="12 Main Street" placeholderTextColor={colors.muted} accessibilityLabel="Organization address" />

        <Text style={[styles.label, textStyle(14, 19)]}>Phone (optional)</Text>
        <TextInput style={[styles.input, touchStyle, highContrastInput, textStyle(14, 19)]} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91XXXXXXXXXX" placeholderTextColor={colors.muted} accessibilityLabel="Organization phone" />

        <Text style={[styles.label, textStyle(14, 19)]}>Owner Name</Text>
        <TextInput style={[styles.input, touchStyle, highContrastInput, textStyle(14, 19)]} value={ownerName} onChangeText={setOwnerName} placeholder="Owner full name" placeholderTextColor={colors.muted} accessibilityLabel="Owner full name" />

        <Text style={[styles.label, textStyle(14, 19)]}>Owner Email</Text>
        <TextInput style={[styles.input, touchStyle, highContrastInput, textStyle(14, 19)]} value={ownerEmail} onChangeText={setOwnerEmail} autoCapitalize="none" keyboardType="email-address" placeholder="owner@example.com" placeholderTextColor={colors.muted} accessibilityLabel="Owner email" />

        <Text style={[styles.label, textStyle(14, 19)]}>Owner Password</Text>
        <TextInput style={[styles.input, touchStyle, highContrastInput, textStyle(14, 19)]} value={ownerPassword} onChangeText={setOwnerPassword} secureTextEntry placeholder="Min 8 characters" placeholderTextColor={colors.muted} accessibilityLabel="Owner password" />

        <Pressable style={[styles.primary, touchStyle, disabled && styles.disabled]} disabled={disabled} onPress={onSubmit} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? "Register organization" : undefined}>
          {loading ? <ActivityIndicator color={colors.textStrong} /> : <Text style={[styles.primaryText, textStyle(16, 21)]}>Register Organization</Text>}
        </Pressable>

        <Pressable style={[styles.secondary, touchStyle]} onPress={onBack} accessibilityRole="button">
          <Text style={[styles.secondaryText, textStyle(14, 19)]}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  container: { flex: 1, justifyContent: "center", padding: 24 },

  glow: {
    position: "absolute",
    width: 330,
    height: 240,
    borderRadius: 180,
    top: 120,
    alignSelf: "center",
    backgroundColor: colors.accent,
  },

  blob: { position: "absolute", borderRadius: 999, opacity: 0.3 },
  blobA: { width: 200, height: 200, top: 70, left: -55, backgroundColor: colors.blobA },
  blobB: { width: 240, height: 240, right: -70, bottom: 90, backgroundColor: colors.blobB },

  title: { color: colors.text, fontSize: 34, fontWeight: "900", marginBottom: 6, fontFamily: fonts.heading },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 16, fontFamily: fonts.body },

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
  highContrastInput: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000", color: "#FFFFFF" },

  primary: {
    marginTop: 8,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.55 },
  primaryText: { color: colors.textStrong, fontSize: 16, fontWeight: "900", fontFamily: fonts.body },

  secondary: {
    marginTop: 10,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: colors.textStrong, fontWeight: "800", fontFamily: fonts.body },
});
