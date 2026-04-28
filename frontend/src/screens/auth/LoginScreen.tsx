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

export const LoginScreen = ({ onBack }: Props) => {
  const { login, loading, baseUrl } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    ).start();
  }, [glow]);

  const disabled = loading || !email.trim() || !password.trim();

  const onSubmit = async () => {
    try {
      await login(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      Alert.alert("Login failed", `${msg}\n\nBackend URL: ${baseUrl}`);
    }
  };

  const pulse = glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.42] });

  return (
    <View style={styles.page}>
      <LinearGradient colors={[colors.bg, colors.bgSoft, colors.bgWarm]} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={[styles.glow, { opacity: pulse }]} />

      <View style={styles.container}>
        <Text style={styles.title}>Secure Login</Text>
        <Text style={styles.subtitle}>Return to your NGO coordination workspace.</Text>

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
          placeholder="Enter password"
          placeholderTextColor={colors.muted}
        />

        <Pressable style={[styles.primary, disabled && styles.disabled]} onPress={onSubmit} disabled={disabled}>
          {loading ? <ActivityIndicator color={colors.textStrong} /> : <Text style={styles.primaryText}>Login</Text>}
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
    width: 320,
    height: 220,
    borderRadius: 180,
    top: 120,
    alignSelf: "center",
    backgroundColor: colors.accent,
  },

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
