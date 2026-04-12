import React, { useRef, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, Dimensions, Animated, StatusBar, Easing } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get("window");

const LoginScreen = () => {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(height * 0.3)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(translateYAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient colors={['#0F172A', '#1E293B', '#4C1D95']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.circle, styles.circle1]} />
      <View style={[styles.circle, styles.circle2]} />

      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Text style={styles.appName}>NGO<Text style={styles.brandAccent}>Connect</Text></Text>
          <Text style={styles.brandSub}>Small acts, big impact ✨</Text>
        </View>

        <Animated.View style={[styles.glassCardContainer, { transform: [{ translateY: translateYAnim }] }]}>
          <BlurView intensity={25} tint="dark" style={styles.blurView}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.description}>Log in to continue your journey of making the world a better place.</Text>

            <Pressable style={styles.button} onPress={() => navigation.navigate("Home")}>
              <Text style={styles.buttonText}>Login to Dashboard</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" style={{ marginLeft: 8 }} />
            </Pressable>

            {/* TOGGLE TO REGISTER */}
            <Pressable onPress={() => navigation.navigate("Register")} style={styles.toggleBtn}>
              <Text style={styles.toggleText}>New here? <Text style={styles.toggleLink}>Create an Account</Text></Text>
            </Pressable>
          </BlurView>
        </Animated.View>
      </Animated.View>
    </LinearGradient>
  );
};

// ... keep previous styles, adding these:
const styles = StyleSheet.create({
  // (Paste your previous styles here)
  container: { flex: 1, justifyContent: "flex-end" },
  contentContainer: { paddingHorizontal: 25, paddingBottom: 40, width: "100%" },
  header: { marginBottom: 40, alignItems: 'center' },
  appName: { fontSize: 34, fontWeight: "900", color: "#FFF" },
  brandAccent: { color: "#FF9F43" },
  brandSub: { fontSize: 14, color: "#94A3B8", marginTop: 5 },
  circle: { position: 'absolute', borderRadius: 999 },
  circle1: { width: 250, height: 250, top: height * 0.1, left: width * -0.2, backgroundColor: 'rgba(76, 29, 149, 0.4)' },
  circle2: { width: 300, height: 300, bottom: height * 0.1, right: width * -0.2, backgroundColor: 'rgba(255, 159, 67, 0.2)' },
  glassCardContainer: { overflow: 'hidden', borderRadius: 30, borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1 },
  blurView: { padding: 30, paddingVertical: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#FFF", marginBottom: 10 },
  description: { fontSize: 15, color: "#94A3B8", lineHeight: 22, marginBottom: 30 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: "#4285F4", paddingVertical: 18, borderRadius: 15 },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 17 },
  toggleBtn: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: '#94A3B8', fontSize: 14 },
  toggleLink: { color: '#FF9F43', fontWeight: 'bold' }
});

export default LoginScreen;