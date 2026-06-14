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
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";

const SIGNUP_GIF = "https://cdn.dribbble.com/users/1162077/screenshots/4649464/media/5e5e1534f8c54799307b810dc7adff17.gif";

type Props = {
  onBack: () => void;
  onLogin?: () => void;
};

type FormErrors = {
  userName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export const SignupScreen = ({ onBack, onLogin }: Props) => {
  const { signup, loading } = useAuth();
  const { highContrast, reduceMotion, screenReaderOptimized, textScale, touchTarget } = useAccessibility();
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (reduceMotion) {
      fadeIn.setValue(1);
      slideUp.setValue(0);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fadeIn, reduceMotion, slideUp]);

  const textStyle = (fontSize: number, lineHeight?: number) => ({
    fontSize: fontSize * textScale,
    ...(lineHeight ? { lineHeight: lineHeight * textScale } : {}),
  });
  const touchStyle = { minHeight: touchTarget };
  const highContrastCard = highContrast ? styles.highContrastCard : null;
  const highContrastInput = highContrast ? styles.highContrastInput : null;

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!userName.trim()) {
      newErrors.userName = "Full name is required";
    } else if (userName.trim().length < 2) {
      newErrors.userName = "Name must be at least 2 characters";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(email.trim())) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = "Must contain at least one uppercase letter";
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = "Must contain at least one number";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    try {
      await signup(userName.trim(), email.trim(), password, "volunteer");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Signup failed";
      Alert.alert("Signup Failed", msg);
    }
  };

  const clearError = (field: keyof FormErrors) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.container, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

            {/* Animated GIF */}
            <View style={styles.gifWrap}>
              <Image source={{ uri: SIGNUP_GIF }} style={styles.gif} resizeMode="contain" />
            </View>

            {/* Title */}
            <Text style={[styles.title, textStyle(30, 36)]}>Create Account</Text>
            <Text style={[styles.subtitle, textStyle(14, 20)]}>Join us and start making an impact</Text>

            {/* Glass card */}
            <View style={[styles.glassCard, highContrastCard]}>
              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, textStyle(12, 17)]}>Full Name</Text>
                <View style={[styles.inputWrapper, touchStyle, highContrastInput, errors.userName ? styles.inputError : null]}>
                  <Text style={[styles.inputIcon, textStyle(15)]}>👤</Text>
                  <TextInput
                    style={[styles.input, textStyle(14, 19)]}
                    value={userName}
                    onChangeText={(t) => { setUserName(t); clearError("userName"); }}
                    placeholder="John Doe"
                    placeholderTextColor="#8B8DA3"
                    autoCapitalize="words"
                    accessibilityLabel="Full name"
                  />
                </View>
                {errors.userName && <Text style={[styles.errorText, textStyle(11, 16)]}>{errors.userName}</Text>}
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, textStyle(12, 17)]}>Email</Text>
                <View style={[styles.inputWrapper, touchStyle, highContrastInput, errors.email ? styles.inputError : null]}>
                  <Text style={[styles.inputIcon, textStyle(15)]}>✉️</Text>
                  <TextInput
                    style={[styles.input, textStyle(14, 19)]}
                    value={email}
                    onChangeText={(t) => { setEmail(t); clearError("email"); }}
                    placeholder="you@email.com"
                    placeholderTextColor="#8B8DA3"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    accessibilityLabel="Email address"
                  />
                </View>
                {errors.email && <Text style={[styles.errorText, textStyle(11, 16)]}>{errors.email}</Text>}
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, textStyle(12, 17)]}>Password</Text>
                <View style={[styles.inputWrapper, touchStyle, highContrastInput, errors.password ? styles.inputError : null]}>
                  <Text style={[styles.inputIcon, textStyle(15)]}>🔒</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }, textStyle(14, 19)]}
                    value={password}
                    onChangeText={(t) => { setPassword(t); clearError("password"); }}
                    secureTextEntry={!showPassword}
                    placeholder="Min 8 chars, uppercase + number"
                    placeholderTextColor="#8B8DA3"
                    accessibilityLabel="Password"
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={[styles.toggleBtn, touchStyle]} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? `${showPassword ? "Hide" : "Show"} password` : undefined}>
                    <Text style={[styles.toggleText, textStyle(12, 17)]}>{showPassword ? "Hide" : "Show"}</Text>
                  </Pressable>
                </View>
                {errors.password && <Text style={[styles.errorText, textStyle(11, 16)]}>{errors.password}</Text>}
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, textStyle(12, 17)]}>Confirm Password</Text>
                <View style={[styles.inputWrapper, touchStyle, highContrastInput, errors.confirmPassword ? styles.inputError : null]}>
                  <Text style={[styles.inputIcon, textStyle(15)]}>🔐</Text>
                  <TextInput
                    style={[styles.input, textStyle(14, 19)]}
                    value={confirmPassword}
                    onChangeText={(t) => { setConfirmPassword(t); clearError("confirmPassword"); }}
                    secureTextEntry={!showPassword}
                    placeholder="Re-enter password"
                    placeholderTextColor="#8B8DA3"
                    accessibilityLabel="Confirm password"
                  />
                </View>
                {errors.confirmPassword && <Text style={[styles.errorText, textStyle(11, 16)]}>{errors.confirmPassword}</Text>}
              </View>

              {/* Buttons */}
              <View style={styles.btnRow}>
                <Pressable style={[styles.outlinedBtn, touchStyle]} onPress={onLogin || onBack} accessibilityRole="button">
                  <Text style={[styles.outlinedBtnText, textStyle(15, 20)]}>Login</Text>
                </Pressable>
                <Pressable style={[styles.filledBtn, loading && styles.disabled]} onPress={onSubmit} disabled={loading} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? "Create volunteer account" : undefined}>
                  <LinearGradient
                    colors={["#667EEA", "#764BA2"]}
                    style={[styles.btnGradient, touchStyle]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.filledBtnText, textStyle(15, 20)]}>Sign Up</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
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
  container: { paddingHorizontal: 24, paddingVertical: 30 },

  // Blobs
  blob: { position: "absolute", borderRadius: 999 },
  blob1: { width: 180, height: 180, top: -40, left: -60, backgroundColor: "rgba(102,126,234,0.12)" },
  blob2: { width: 140, height: 140, bottom: 60, right: -40, backgroundColor: "rgba(118,75,162,0.1)" },

  // GIF
  gifWrap: { alignItems: "center", marginBottom: 20 },
  gif: { width: 200, height: 160, borderRadius: 16 },

  // Title
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginBottom: 24,
  },

  // Glass card
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  highContrastCard: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000" },

  // Fields
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.6)", marginBottom: 8, marginLeft: 4 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputError: { borderColor: "#FF6B6B" },
  highContrastInput: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000" },
  inputIcon: { fontSize: 15, marginRight: 10 },
  input: {
    flex: 1,
    height: 52,
    color: "#FFFFFF",
    fontSize: 14,
    backgroundColor: "transparent",
  },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  toggleText: { fontSize: 12, fontWeight: "600", color: "#667EEA" },
  errorText: { color: "#FF6B6B", fontSize: 11, marginTop: 5, marginLeft: 16 },

  // Buttons
  btnRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  outlinedBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(102,126,234,0.6)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(102,126,234,0.08)",
  },
  outlinedBtnText: { color: "#667EEA", fontSize: 15, fontWeight: "700" },
  filledBtn: { flex: 1, borderRadius: 14, overflow: "hidden" },
  btnGradient: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  filledBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  disabled: { opacity: 0.6 },
});
