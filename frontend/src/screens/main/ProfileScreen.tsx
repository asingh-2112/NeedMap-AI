import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
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
import { useThemeMode } from "../../context/ThemeModeContext";
import { moduleApi } from "../../services/api";
import type { Volunteer, VolunteerSkill } from "../../types/api";

const proficiencyOptions: VolunteerSkill["proficiency"][] = ["beginner", "intermediate", "expert"];

export const ProfileScreen = () => {
  const { user, baseUrl, token, refreshMe, logout } = useAuth();
  const { theme } = useThemeMode();
  const isVolunteer = user?.role === "volunteer";
  const isLight = theme.mode === "light";
  const lightPrimary = isLight ? { color: "#0B1220", fontWeight: "900" as const } : null;
  const lightSecondary = isLight ? { color: "#111827", fontWeight: "700" as const } : null;
  const lightCard = isLight ? { borderColor: "#000000", borderWidth: 2, backgroundColor: "rgba(255,255,255,0.97)" } : null;
  const lightInput = isLight ? { borderColor: "#000000", borderWidth: 2, color: "#0B1220", fontWeight: "700" as const, backgroundColor: "#FFFFFF" } : null;

  const [name, setName] = useState(user?.user_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [radius, setRadius] = useState(user?.organization_id ? "5" : "5");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [profileImage, setProfileImage] = useState<string>("");
  const [volunteerProfile, setVolunteerProfile] = useState<Volunteer | null>(null);
  const [skillName, setSkillName] = useState("");
  const [skillProficiency, setSkillProficiency] = useState<VolunteerSkill["proficiency"]>("beginner");
  const [skillsLoading, setSkillsLoading] = useState(false);

  const pulse = useRef(new Animated.Value(0)).current;
  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setName(user?.user_name || "");
    setPhone(user?.phone || "");
  }, [user?.user_name, user?.phone]);

  useEffect(() => {
    if (!isVolunteer || !token) {
      setVolunteerProfile(null);
      return;
    }

    let mounted = true;
    const loadVolunteerProfile = async () => {
      try {
        setSkillsLoading(true);
        const profile = await moduleApi.myVolunteerProfile(baseUrl, token);
        if (mounted) {
          setVolunteerProfile(profile);
        }
      } catch (err) {
        if (mounted) {
          setMessage(err instanceof Error ? err.message : "Unable to load volunteer skills");
        }
      } finally {
        if (mounted) {
          setSkillsLoading(false);
        }
      }
    };

    void loadVolunteerProfile();
    return () => {
      mounted = false;
    };
  }, [baseUrl, isVolunteer, token]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const key = `needmap-profile-image-${user?.id ?? "me"}`;
    const saved = window.localStorage.getItem(key);
    if (saved) {
      setProfileImage(saved);
    }
  }, [user?.id]);

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

  const reloadVolunteerProfile = async () => {
    if (!isVolunteer || !token) return;
    const profile = await moduleApi.myVolunteerProfile(baseUrl, token);
    setVolunteerProfile(profile);
  };

  const addSkill = async () => {
    if (!volunteerProfile) return;
    const normalizedSkill = skillName.trim().toLowerCase();
    if (!normalizedSkill) {
      setMessage("Enter a skill before saving.");
      return;
    }

    try {
      setSkillsLoading(true);
      await moduleApi.addVolunteerSkill(baseUrl, token, volunteerProfile.id, {
        skill_name: normalizedSkill,
        proficiency: skillProficiency,
      });
      setSkillName("");
      setSkillProficiency("beginner");
      await reloadVolunteerProfile();
      setMessage("Skill saved for volunteer matching.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to save skill");
    } finally {
      setSkillsLoading(false);
    }
  };

  const updateSkillProficiency = async (skill: VolunteerSkill, proficiency: VolunteerSkill["proficiency"]) => {
    if (!volunteerProfile || skill.proficiency === proficiency) return;

    try {
      setSkillsLoading(true);
      const updated = await moduleApi.updateVolunteerSkill(baseUrl, token, volunteerProfile.id, skill.id, { proficiency });
      setVolunteerProfile({
        ...volunteerProfile,
        skills: (volunteerProfile.skills ?? []).map((item) => (item.id === updated.id ? updated : item)),
      });
      setMessage("Skill proficiency updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to update skill");
    } finally {
      setSkillsLoading(false);
    }
  };

  const removeSkill = async (skill: VolunteerSkill) => {
    if (!volunteerProfile) return;

    try {
      setSkillsLoading(true);
      await moduleApi.deleteVolunteerSkill(baseUrl, token, volunteerProfile.id, skill.id);
      setVolunteerProfile({
        ...volunteerProfile,
        skills: (volunteerProfile.skills ?? []).filter((item) => item.id !== skill.id),
      });
      setMessage("Skill removed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to remove skill");
    } finally {
      setSkillsLoading(false);
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

  const pickProfileImage = () => {
    if (Platform.OS !== "web") {
      setMessage("Profile image upload from computer is available on web.");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) return;
        setProfileImage(dataUrl);
        if (typeof window !== "undefined") {
          const key = `needmap-profile-image-${user?.id ?? "me"}`;
          window.localStorage.setItem(key, dataUrl);
        }
        setMessage("Profile image updated.");
      };
      reader.onerror = () => setMessage("Unable to read selected image.");
      reader.readAsDataURL(file);
    };
    input.click();
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
      <LinearGradient
        colors={theme.gradients.page}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

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
        <Text style={[styles.heading, lightPrimary]}>Profile</Text>
        <Text style={[styles.subheading, lightSecondary]}>Manage your personal settings and account actions</Text>

        <View style={[styles.heroCard, lightCard]}>
          <Animated.View style={[styles.avatarRing, { transform: [{ rotate: ringRotate }] }]} />
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarCore}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}

          <View style={styles.heroMeta}>
            <Text style={[styles.name, lightPrimary]}>{user?.user_name || "NeedMap User"}</Text>
            <Text style={[styles.email, lightSecondary]}>{user?.email || "No email"}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{(user?.role || "volunteer").toUpperCase()}</Text>
            </View>
            <Pressable style={[styles.uploadBtn, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={pickProfileImage}>
              <Text style={[styles.uploadBtnText, lightPrimary]}>Upload Profile Photo</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.panelCard, lightCard]}>
          <Text style={[styles.panelTitle, lightPrimary]}>Update Profile</Text>
          <TextInput style={[styles.input, lightInput]} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          <TextInput style={[styles.input, lightInput]} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          <Pressable style={[styles.primaryBtn, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={saveProfile}>
            <Text style={[styles.primaryBtnText, lightPrimary]}>Save Profile</Text>
          </Pressable>
        </View>

        <View style={[styles.panelCard, lightCard]}>
          <Text style={[styles.panelTitle, lightPrimary]}>Update Location</Text>
          <View style={styles.locationRow}>
            <TextInput style={[styles.input, styles.col, styles.coordinateInput, lightInput]} value={latitude} onChangeText={setLatitude} placeholder="Latitude" keyboardType="numeric" placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
            <TextInput style={[styles.input, styles.col, styles.coordinateInput, lightInput]} value={longitude} onChangeText={setLongitude} placeholder="Longitude" keyboardType="numeric" placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          </View>
          <TextInput style={[styles.input, lightInput]} value={radius} onChangeText={setRadius} placeholder="Radius km" keyboardType="numeric" placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          <View style={styles.row}>
            <Pressable style={[styles.secondaryBtn, styles.col, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={useBrowserLocation}>
              <Text style={[styles.secondaryBtnText, lightPrimary]}>Use Live Location</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, styles.col, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={saveLocation}>
              <Text style={[styles.primaryBtnText, lightPrimary]}>Save Location</Text>
            </Pressable>
          </View>
        </View>

        {isVolunteer ? (
          <View style={[styles.panelCard, lightCard]}>
            <Text style={[styles.panelTitle, lightPrimary]}>Volunteer Skills</Text>
            <Text style={[styles.skillHint, lightSecondary]}>These skills are saved to your volunteer profile and used for need match scores.</Text>
            <TextInput
              style={[styles.input, lightInput]}
              value={skillName}
              onChangeText={setSkillName}
              placeholder="Skill, for example medical, cooking, logistics"
              placeholderTextColor={isLight ? "#374151" : "#BFC0CF"}
            />
            <View style={styles.proficiencyRow}>
              {proficiencyOptions.map((option) => {
                const selected = skillProficiency === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.proficiencyBtn, selected && styles.proficiencyBtnActive, isLight ? { borderColor: "#000", borderWidth: 2 } : null]}
                    onPress={() => setSkillProficiency(option)}
                  >
                    <Text style={[styles.proficiencyText, selected && styles.proficiencyTextActive, lightPrimary]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.primaryBtn, skillsLoading ? styles.disabledBtn : null, isLight ? { borderColor: "#000", borderWidth: 2 } : null]}
              onPress={addSkill}
              disabled={skillsLoading}
            >
              <Text style={[styles.primaryBtnText, lightPrimary]}>{skillsLoading ? "Saving..." : "Add Skill"}</Text>
            </Pressable>

            <View style={styles.skillList}>
              {(volunteerProfile?.skills ?? []).length === 0 ? (
                <Text style={[styles.emptySkillsText, lightSecondary]}>No skills added yet.</Text>
              ) : (
                (volunteerProfile?.skills ?? []).map((skill) => (
                  <View key={skill.id} style={[styles.skillCard, isLight ? { borderColor: "#000", borderWidth: 1 } : null]}>
                    <View style={styles.skillCardHeader}>
                      <Text style={[styles.skillNameText, lightPrimary]} numberOfLines={2}>{skill.skill_name.replace(/_/g, " ")}</Text>
                      <Pressable style={styles.removeSkillBtn} onPress={() => removeSkill(skill)} disabled={skillsLoading}>
                        <Text style={styles.removeSkillText}>Remove</Text>
                      </Pressable>
                    </View>
                    <View style={styles.proficiencyRowCompact}>
                      {proficiencyOptions.map((option) => {
                        const selected = skill.proficiency === option;
                        return (
                          <Pressable
                            key={`${skill.id}-${option}`}
                            style={[styles.proficiencyChip, selected && styles.proficiencyChipActive]}
                            onPress={() => updateSkillProficiency(skill, option)}
                            disabled={skillsLoading}
                          >
                            <Text style={[styles.proficiencyChipText, selected && styles.proficiencyChipTextActive]}>{option}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : null}

        <View style={[styles.panelCard, lightCard]}>
          <Text style={[styles.panelTitle, lightPrimary]}>Change Password</Text>
          <TextInput style={[styles.input, lightInput]} value={oldPassword} onChangeText={setOldPassword} placeholder="Old password" secureTextEntry placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          <TextInput style={[styles.input, lightInput]} value={newPassword} onChangeText={setNewPassword} placeholder="New password" secureTextEntry placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          <Pressable style={[styles.primaryBtn, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={changePassword}>
            <Text style={[styles.primaryBtnText, lightPrimary]}>Change Password</Text>
          </Pressable>
        </View>

        <View style={[styles.panelCard, lightCard]}>
          <Text style={[styles.panelTitle, lightPrimary]}>Danger Zone</Text>
          <Pressable style={[styles.dangerBtn, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={deactivateAccount}>
            <Text style={styles.dangerBtnText}>Deactivate Account</Text>
          </Pressable>
        </View>

        {message ? <Text style={[styles.message, lightSecondary]}>{message}</Text> : null}

        <Pressable style={[styles.logoutBtn, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={logout}>
          <Text style={[styles.logoutText, lightPrimary]}>Logout</Text>
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
    backgroundColor: "rgba(102,126,234,0.22)",
    top: 90,
    left: -50,
  },
  orbRight: {
    width: 260,
    height: 260,
    backgroundColor: "rgba(123,104,238,0.2)",
    top: 220,
    right: -90,
  },

  heading: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginTop: 6 },
  subheading: { color: "#BFC0CF", marginTop: 4, marginBottom: 16, fontSize: 14 },

  heroCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
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
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginRight: 16,
    borderWidth: 2,
    borderColor: "#FFD8C9",
  },
  avatarText: { color: "white", fontSize: 26, fontWeight: "900" },

  heroMeta: { flex: 1 },
  name: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  email: { color: "#BFC0CF", fontSize: 13, marginTop: 2 },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#FFD7C2",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeText: { color: "#5A3525", fontWeight: "900", fontSize: 11 },
  uploadBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(102,126,234,0.2)",
    borderColor: "rgba(102,126,234,0.45)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  uploadBtnText: { color: "#D9DEFF", fontWeight: "700", fontSize: 12 },

  panelCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  panelTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginBottom: 10 },
  skillHint: { color: "#BFC0CF", fontSize: 12, fontWeight: "700", marginBottom: 10 },

  row: { flexDirection: "row", gap: 8 },
  locationRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  col: { flex: 1 },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  coordinateInput: {
    height: 44,
    marginBottom: 8,
    minWidth: 0,
    paddingVertical: 0,
    textAlign: "left",
    textAlignVertical: "center",
  },

  primaryBtn: {
    backgroundColor: "#667EEA",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  disabledBtn: { opacity: 0.65 },

  proficiencyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  proficiencyBtn: {
    flexGrow: 1,
    minWidth: 96,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  proficiencyBtnActive: { backgroundColor: "#FFD7C2", borderColor: "#FF8A5B" },
  proficiencyText: { color: "#D0D2E4", fontWeight: "900", fontSize: 12, textTransform: "capitalize" },
  proficiencyTextActive: { color: "#5A3525" },
  skillList: { marginTop: 12, gap: 8 },
  emptySkillsText: { color: "#BFC0CF", fontWeight: "700", fontSize: 12 },
  skillCard: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  skillCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  skillNameText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", textTransform: "capitalize", flex: 1, minWidth: 0, lineHeight: 18 },
  removeSkillBtn: {
    backgroundColor: "rgba(227,108,106,0.18)",
    borderColor: "rgba(227,108,106,0.42)",
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    width: 82,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeSkillText: { color: "#FFB5B4", fontWeight: "900", fontSize: 12 },
  proficiencyRowCompact: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  proficiencyChip: {
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  proficiencyChipActive: { backgroundColor: "#667EEA", borderColor: "#667EEA" },
  proficiencyChipText: { color: "#D0D2E4", fontWeight: "800", fontSize: 11, textTransform: "capitalize" },
  proficiencyChipTextActive: { color: "#FFFFFF" },

  secondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#D0D2E4", fontWeight: "900", fontSize: 13 },

  dangerBtn: {
    backgroundColor: "#E36C6A",
    borderColor: "#E36C6A",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  dangerBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },

  message: { color: "#BFC0CF", fontWeight: "700", marginBottom: 12 },

  logoutBtn: {
    backgroundColor: "#667EEA",
    borderRadius: 14,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 8,
  },
  logoutText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
});


