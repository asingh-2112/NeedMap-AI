import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { moduleApi } from "../../services/api";
import { colors } from "../../theme";

export const ProfileScreen = () => {
  const { user, baseUrl, token, refreshMe, logout } = useAuth();

  const [name, setName] = useState(user?.user_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [radius, setRadius] = useState(user?.organization_id ? "5" : "5");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");

  const pulse = useRef(new Animated.Value(0)).current;
  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setName(user?.user_name || "");
    setPhone(user?.phone || "");
  }, [user?.user_name, user?.phone]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatA, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(floatA, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 3100, useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 3100, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 9000, useNativeDriver: true }),
    ).start();
  }, [floatA, floatB, pulse, rotate]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const floatATranslate = floatA.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const floatBTranslate = floatB.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const ringRotate = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const initials = useMemo(() => {
    const fullName = (user?.user_name || "NeedMap User").trim();
    const parts = fullName.split(" ").filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "NU";
  }, [user?.user_name]);

  const saveProfile = async () => {
    try {
      const updated = await moduleApi.updateMyProfile(baseUrl, token, {
        user_name: name.trim(),
        phone: phone.trim() || null,
      });
      setMessage(`Profile updated for ${updated.user_name}`);
      await refreshMe();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to update profile");
    }
  };

  const saveLocation = async () => {
    try {
      await moduleApi.updateMyLocation(baseUrl, token, {
        latitude: latitude.trim() ? Number(latitude) : undefined,
        longitude: longitude.trim() ? Number(longitude) : undefined,
        radius_km: radius.trim() ? Number(radius) : undefined,
      });
      setMessage("Location updated successfully.");
      await refreshMe();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to update location");
    }
  };

  const useBrowserLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setMessage("Geolocation not supported in this environment.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
      },
      () => setMessage("Location permission denied or unavailable."),
    );
  };

  const changePassword = async () => {
    try {
      const res = await moduleApi.changeMyPassword(baseUrl, token, {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setOldPassword("");
      setNewPassword("");
      setMessage(res.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to change password");
    }
  };

  const deactivateAccount = async () => {
    const go = async () => {
      try {
        await moduleApi.deactivateMyAccount(baseUrl, token);
        logout();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Unable to deactivate account");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to deactivate your account?")) {
        await go();
      }
      return;
    }

    Alert.alert("Deactivate Account", "Are you sure you want to deactivate your account?", [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: () => void go() },
    ]);
  };

  return (
    <View style={styles.page}>
      <LinearGradient colors={[colors.bg, colors.bgSoft, colors.bgWarm]} style={StyleSheet.absoluteFillObject} />

      <Animated.View
        style={[
          styles.orb,
          styles.orbLeft,
          { transform: [{ translateY: floatATranslate }, { scale: pulseScale }] },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orbRight,
          { transform: [{ translateY: floatBTranslate }] },
        ]}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.subheading}>Manage your personal settings and account actions</Text>

        <View style={styles.heroCard}>
          <Animated.View style={[styles.avatarRing, { transform: [{ rotate: ringRotate }] }]} />
          <View style={styles.avatarCore}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.heroMeta}>
            <Text style={styles.name}>{user?.user_name || "NeedMap User"}</Text>
            <Text style={styles.email}>{user?.email || "No email"}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{(user?.role || "volunteer").toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.panelTitle}>Update Profile</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} />
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={colors.muted} />
          <Pressable style={styles.primaryBtn} onPress={saveProfile}>
            <Text style={styles.primaryBtnText}>Save Profile</Text>
          </Pressable>
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.panelTitle}>Update Location</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.col]} value={latitude} onChangeText={setLatitude} placeholder="Latitude" keyboardType="numeric" placeholderTextColor={colors.muted} />
            <TextInput style={[styles.input, styles.col]} value={longitude} onChangeText={setLongitude} placeholder="Longitude" keyboardType="numeric" placeholderTextColor={colors.muted} />
          </View>
          <TextInput style={styles.input} value={radius} onChangeText={setRadius} placeholder="Radius km" keyboardType="numeric" placeholderTextColor={colors.muted} />
          <View style={styles.row}>
            <Pressable style={[styles.secondaryBtn, styles.col]} onPress={useBrowserLocation}>
              <Text style={styles.secondaryBtnText}>Use Live Location</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, styles.col]} onPress={saveLocation}>
              <Text style={styles.primaryBtnText}>Save Location</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.panelTitle}>Change Password</Text>
          <TextInput style={styles.input} value={oldPassword} onChangeText={setOldPassword} placeholder="Old password" secureTextEntry placeholderTextColor={colors.muted} />
          <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry placeholderTextColor={colors.muted} />
          <Pressable style={styles.primaryBtn} onPress={changePassword}>
            <Text style={styles.primaryBtnText}>Change Password</Text>
          </Pressable>
        </View>

        <View style={styles.panelCard}>
          <Text style={styles.panelTitle}>Danger Zone</Text>
          <Pressable style={styles.dangerBtn} onPress={deactivateAccount}>
            <Text style={styles.dangerBtnText}>Deactivate Account</Text>
          </Pressable>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.panelCard}>
          <Text style={styles.panelTitle}>Connection</Text>
          <Text style={styles.backendText}>{baseUrl}</Text>
        </View>

        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, paddingBottom: 36 },

  orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.28,
  },
  orbLeft: {
    width: 220,
    height: 220,
    backgroundColor: colors.blobA,
    top: 90,
    left: -50,
  },
  orbRight: {
    width: 260,
    height: 260,
    backgroundColor: colors.blobB,
    top: 220,
    right: -90,
  },

  heading: { color: colors.text, fontSize: 32, fontWeight: "900", marginTop: 6 },
  subheading: { color: colors.muted, marginTop: 4, marginBottom: 16, fontSize: 14 },

  heroCard: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "#FF7A59",
    position: "absolute",
    left: 16,
  },
  avatarCore: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FF6B3D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFD8C9",
    marginRight: 16,
  },
  avatarText: { color: "white", fontSize: 26, fontWeight: "900" },

  heroMeta: { flex: 1 },
  name: { color: colors.textStrong, fontSize: 20, fontWeight: "900" },
  email: { color: colors.muted, fontSize: 13, marginTop: 2 },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#FFD7C2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeText: { color: "#5A3525", fontWeight: "900", fontSize: 11 },

  panelCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  panelTitle: { color: colors.textStrong, fontSize: 16, fontWeight: "900", marginBottom: 10 },

  row: { flexDirection: "row", gap: 8 },
  col: { flex: 1 },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.cardSoft,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },

  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.textStrong, fontWeight: "900", fontSize: 13 },

  secondaryBtn: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryBtnText: { color: colors.muted, fontWeight: "900", fontSize: 13 },

  dangerBtn: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  dangerBtnText: { color: colors.textStrong, fontWeight: "900", fontSize: 13 },

  message: { color: colors.muted, fontWeight: "700", marginBottom: 12 },

  backendText: { color: colors.muted, fontWeight: "700" },

  logoutBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 8,
  },
  logoutText: { color: colors.textStrong, fontWeight: "900", fontSize: 15 },
});


