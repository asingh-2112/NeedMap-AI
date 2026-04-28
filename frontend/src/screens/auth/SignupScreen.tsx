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
import { useAuth } from "../../context/AuthContext";
import { colors, fonts } from "../../theme";

type Props = {
  onBack: () => void;
};

export const SignupScreen = ({ onBack }: Props) => {
  const { signup, loading, baseUrl } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1700, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse, drift]);

  const disabled =
    loading || name.trim().length < 2 || !email.trim() || password.trim().length < 8;

  const onSubmit = async () => {
    try {
      await signup(name, email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      Alert.alert("Signup failed", `${msg}\n\nBackend URL: ${baseUrl}`);
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
        <Text style={styles.title}>Volunteer Signup</Text>
        <Text style={styles.subtitle}>Join your local response grid and start helping.</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Min 8 characters"
          placeholderTextColor={colors.muted}
        />

        <Pressable style={[styles.primary, disabled && styles.disabled]} disabled={disabled} onPress={onSubmit}>
          {loading ? <ActivityIndicator color={colors.textStrong} /> : <Text style={styles.primaryText}>Create and Continue</Text>}
        </Pressable>

        <Pressable style={styles.secondary} onPress={onBack}>
          <Text style={styles.secondaryText}>Back</Text>
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
    marginBottom: 12,
    fontFamily: fonts.body,
  },

  primary: {
    marginTop: 6,
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
