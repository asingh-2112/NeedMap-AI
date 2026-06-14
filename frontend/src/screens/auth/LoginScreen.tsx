import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";

const LOGIN_GIF = "https://cdn.dribbble.com/users/1162077/screenshots/3848914/programmer.gif";

type Props = {
  onBack: () => void;
  onSignup?: () => void;
};

export const LoginScreen = ({ onBack, onSignup }: Props) => {
  const { login, loading } = useAuth();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();

    // Subtle pulse on the GIF container
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, [fadeIn, slideUp, pulse]);

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!emailOrUsername.trim()) {
      newErrors.email = "Email or username is required";
    }
    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    try {
      await login(emailOrUsername.trim(), password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      Alert.alert("Login Failed", msg);
    }
  };

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={["#0F0C29", "#302B63", "#24243E"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating glassmorphism blobs */}
      <View style={[styles.blob, styles.blob1]} />
      <View style={[styles.blob, styles.blob2]} />
      <View style={[styles.blob, styles.blob3]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.container, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

            {/* Animated GIF illustration */}
            <Animated.View style={[styles.gifWrap, { transform: [{ scale: pulse }] }]}>
              <Image source={{ uri: LOGIN_GIF }} style={styles.gif} resizeMode="contain" />
            </Animated.View>

            {/* Title */}
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

            {/* Glass card */}
            <View style={styles.glassCard}>
              {/* Email Input */}
              <View style={styles.fieldGroup}>
                <View style={[styles.inputWrapper, errors.email ? styles.inputError : null]}>
                  <Text style={styles.inputIcon}>✉️</Text>
                  <TextInput
                    style={styles.input}
                    value={emailOrUsername}
                    onChangeText={(t) => { setEmailOrUsername(t); setErrors((e) => ({ ...e, email: undefined })); }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="Email or Username"
                    placeholderTextColor="#8B8DA3"
                  />
                </View>
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              {/* Password Input */}
              <View style={styles.fieldGroup}>
                <View style={[styles.inputWrapper, errors.password ? styles.inputError : null]}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })); }}
                    secureTextEntry={!showPassword}
                    placeholder="Password"
                    placeholderTextColor="#8B8DA3"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.toggleBtn}>
                    <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
                  </Pressable>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              {/* Forgot password */}
              <Pressable style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>

              {/* Login Button */}
              <Pressable style={[styles.loginBtn, loading && styles.disabled]} onPress={onSubmit} disabled={loading}>
                <LinearGradient
                  colors={["#667EEA", "#764BA2"]}
                  style={styles.btnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loginBtnText}>Sign In</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            {/* Sign Up link */}
            <View style={styles.bottomLink}>
              <Text style={styles.bottomLinkText}>Don't have an account? </Text>
              <Pressable onPress={onSignup || onBack}>
                <Text style={styles.bottomLinkAction}>Sign Up</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  container: { paddingHorizontal: 24, paddingVertical: 40 },

  // Floating blobs
  blob: { position: "absolute", borderRadius: 999 },
  blob1: { width: 200, height: 200, top: -40, right: -60, backgroundColor: "rgba(102,126,234,0.15)" },
  blob2: { width: 160, height: 160, bottom: 100, left: -50, backgroundColor: "rgba(118,75,162,0.12)" },
  blob3: { width: 100, height: 100, top: "40%", right: 20, backgroundColor: "rgba(240,147,251,0.08)" },

  // GIF
  gifWrap: {
    alignItems: "center",
    marginBottom: 24,
  },
  gif: {
    width: 220,
    height: 180,
    borderRadius: 20,
  },

  // Title
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 28,
  },

  // Glass card
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  // Input fields
  fieldGroup: { marginBottom: 16 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputError: { borderColor: "#FF6B6B" },
  inputIcon: { fontSize: 16, marginRight: 12 },
  input: {
    flex: 1,
    height: 56,
    color: "#FFFFFF",
    fontSize: 15,
    backgroundColor: "transparent",
  },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  toggleText: { fontSize: 13, fontWeight: "600", color: "#667EEA" },
  errorText: { color: "#FF6B6B", fontSize: 12, marginTop: 6, marginLeft: 18 },

  // Forgot
  forgotBtn: { alignSelf: "flex-end", marginBottom: 20 },
  forgotText: { color: "rgba(255,255,255,0.5)", fontSize: 13 },

  // Login button
  loginBtn: { borderRadius: 16, overflow: "hidden" },
  btnGradient: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  disabled: { opacity: 0.6 },

  // Bottom link
  bottomLink: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  bottomLinkText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  bottomLinkAction: { color: "#667EEA", fontSize: 14, fontWeight: "700" },
});
