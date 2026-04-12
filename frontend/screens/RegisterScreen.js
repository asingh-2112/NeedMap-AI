import React, { useRef, useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable, Dimensions, Animated, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Google from "expo-auth-session/providers/google";

const { width, height } = Dimensions.get("window");

const RegisterScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // --- YOUR GOOGLE AUTH LOGIC ---
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: "<YOUR_EXPO_CLIENT_ID>",
    webClientId: "<YOUR_WEB_CLIENT_ID>",
    androidClientId: "<YOUR_ANDROID_CLIENT_ID>",
    iosClientId: "<YOUR_IOS_CLIENT_ID>",
    scopes: ["profile", "email"],
  });

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
  }, []);

  return (
    <LinearGradient colors={['#0F172A', '#1E293B', '#1E1B4B']} style={styles.container}>
      <View style={[styles.circle, styles.circle1]} />
      
      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
        <View style={styles.header}>
          <Text style={styles.appName}>Join <Text style={styles.brandAccent}>Us</Text></Text>
          <Text style={styles.brandSub}>Start your impact journey today 🌍</Text>
        </View>

        <View style={styles.glassCardContainer}>
          <BlurView intensity={30} tint="dark" style={styles.blurView}>
            {loading ? (
              <ActivityIndicator size="large" color="#FF9F43" />
            ) : (
              <>
                <Text style={styles.title}>Register</Text>
                <Text style={styles.description}>Create an account using Google to sync your donations and volunteer history across devices.</Text>

                <Pressable style={styles.googleButton} onPress={() => promptAsync()}>
                  <Ionicons name="logo-google" size={20} color="#FFF" style={{ marginRight: 10 }} />
                  <Text style={styles.buttonText}>Sign up with Google</Text>
                </Pressable>

                {/* TOGGLE TO LOGIN */}
                <Pressable onPress={() => navigation.navigate("Login")} style={styles.toggleBtn}>
                  <Text style={styles.toggleText}>Already have an account? <Text style={styles.toggleLink}>Login</Text></Text>
                </Pressable>
              </>
            )}
          </BlurView>
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

// Use the same styles as LoginScreen for consistency
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
  contentContainer: { paddingHorizontal: 25 },
  header: { marginBottom: 30, alignItems: 'center' },
  appName: { fontSize: 34, fontWeight: "900", color: "#FFF" },
  brandAccent: { color: "#FF6B6B" },
  brandSub: { fontSize: 14, color: "#94A3B8", marginTop: 5 },
  circle: { position: 'absolute', borderRadius: 999 },
  circle1: { width: 300, height: 300, top: -50, right: -50, backgroundColor: 'rgba(255, 107, 107, 0.15)' },
  glassCardContainer: { overflow: 'hidden', borderRadius: 30, borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1 },
  blurView: { padding: 30, paddingVertical: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#FFF", marginBottom: 10 },
  description: { fontSize: 15, color: "#94A3B8", lineHeight: 22, marginBottom: 30 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: "#4285F4", paddingVertical: 18, borderRadius: 15 },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 17 },
  toggleBtn: { marginTop: 20, alignItems: 'center' },
  toggleText: { color: '#94A3B8', fontSize: 14 },
  toggleLink: { color: '#FF6B6B', fontWeight: 'bold' }
});

export default RegisterScreen;