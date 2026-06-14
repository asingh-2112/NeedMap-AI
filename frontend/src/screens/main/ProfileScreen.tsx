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
import { useAccessibility, type TextSize } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { moduleApi } from "../../services/api";
import type { Volunteer, VolunteerSkill } from "../../types/api";

const proficiencyOptions: VolunteerSkill["proficiency"][] = ["beginner", "intermediate", "expert"];
const textSizeOptions: { label: string; value: TextSize }[] = [
  { label: "Normal", value: "normal" },
  { label: "Large", value: "large" },
  { label: "Extra Large", value: "extraLarge" },
];

export const ProfileScreen = () => {
  const { user, baseUrl, token, refreshMe, logout } = useAuth();
  const { t, translateCategory } = useLanguage();
  const { theme } = useThemeMode();
  const {
    highContrast,
    largeTouchTargets,
    reduceMotion,
    resetAccessibility,
    screenReaderOptimized,
    setUseDeviceSettings,
    setHighContrast,
    setLargeTouchTargets,
    setReduceMotion,
    setScreenReaderOptimized,
    setTextSize,
    textScale,
    textSize,
    touchTarget,
    useDeviceSettings,
    device,
    announceForAccessibility,
  } = useAccessibility();
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
          setMessage(err instanceof Error ? err.message : t("Unable to load volunteer skills"));
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
  }, [baseUrl, isVolunteer, t, token]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const key = `needmap-profile-image-${user?.id ?? "me"}`;
    const saved = window.localStorage.getItem(key);
    if (saved) {
      setProfileImage(saved);
    }
  }, [user?.id]);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0);
      floatA.setValue(0);
      floatB.setValue(0);
      rotate.setValue(0);
      return;
    }

    const animations = [
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(floatA, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(floatA, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 3100, useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 3100, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 9000, useNativeDriver: true })),
    ];

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [floatA, floatB, pulse, reduceMotion, rotate]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const floatATranslate = floatA.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const floatBTranslate = floatB.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const ringRotate = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scaledText = (fontSize: number, lineHeight?: number) => ({
    fontSize: fontSize * textScale,
    ...(lineHeight ? { lineHeight: lineHeight * textScale } : {}),
  });
  const accessiblePressable = {
    minHeight: touchTarget,
    justifyContent: "center" as const,
  };
  const highContrastCard = highContrast ? styles.highContrastCard : null;
  const highContrastInput = highContrast ? styles.highContrastInput : null;

  const renderToggle = (label: string, enabled: boolean, onChange: (enabled: boolean) => void, hint: string) => (
    <Pressable
      style={[styles.accessibilityToggle, highContrast ? styles.highContrastToggle : null, accessiblePressable]}
      onPress={() => onChange(!enabled)}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={screenReaderOptimized ? label : undefined}
      accessibilityHint={screenReaderOptimized ? hint : undefined}
    >
      <View style={styles.accessibilityToggleTextWrap}>
        <Text style={[styles.accessibilityToggleTitle, lightPrimary, scaledText(14, 19)]}>{label}</Text>
        <Text style={[styles.accessibilityToggleHint, lightSecondary, scaledText(12, 17)]}>{hint}</Text>
      </View>
      <View style={[styles.toggleTrack, enabled ? styles.toggleTrackOn : null, highContrast ? styles.highContrastToggleTrack : null]}>
        <View style={[styles.toggleThumb, enabled ? styles.toggleThumbOn : null]} />
      </View>
    </Pressable>
  );

  const resetAccessibilitySettings = () => {
    resetAccessibility();
    announceForAccessibility(t("Accessibility settings reset to defaults"));
  };

  const initials = useMemo(() => {
    const fullName = (user?.user_name || t("NeedMap User")).trim();
    const parts = fullName.split(" ").filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "NU";
  }, [user?.user_name]);

  const saveProfile = async () => {
    try {
      const updated = await moduleApi.updateMyProfile(baseUrl, token, {
        user_name: name.trim(),
        phone: phone.trim() || null,
      });
      setMessage(`${t("Profile updated for")} ${updated.user_name}`);
      await refreshMe();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("Unable to update profile"));
    }
  };

  const saveLocation = async () => {
    try {
      await moduleApi.updateMyLocation(baseUrl, token, {
        latitude: latitude.trim() ? Number(latitude) : undefined,
        longitude: longitude.trim() ? Number(longitude) : undefined,
        radius_km: radius.trim() ? Number(radius) : undefined,
      });
      setMessage(t("Location updated successfully."));
      await refreshMe();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("Unable to update location"));
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
      setMessage(t("Enter a skill before saving."));
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
      setMessage(t("Skill saved for volunteer matching."));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("Unable to save skill"));
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
      setMessage(t("Skill proficiency updated."));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("Unable to update skill"));
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
      setMessage(t("Skill removed."));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("Unable to remove skill"));
    } finally {
      setSkillsLoading(false);
    }
  };

  const useBrowserLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setMessage(t("Geolocation not supported in this environment."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
      },
      () => setMessage(t("Location permission denied or unavailable.")),
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
      setMessage(err instanceof Error ? err.message : t("Unable to change password"));
    }
  };

  const pickProfileImage = () => {
    if (Platform.OS !== "web") {
      setMessage(t("Profile image upload from computer is available on web."));
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
        setMessage(t("Profile image updated."));
      };
      reader.onerror = () => setMessage(t("Unable to read selected image."));
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
        setMessage(err instanceof Error ? err.message : t("Unable to deactivate account"));
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(t("Are you sure you want to deactivate your account?"))) {
        await go();
      }
      return;
    }

    Alert.alert(t("Deactivate Account"), t("Are you sure you want to deactivate your account?"), [
      { text: t("Cancel"), style: "cancel" },
      { text: t("Deactivate"), style: "destructive", onPress: () => void go() },
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
        <Text style={[styles.heading, lightPrimary, scaledText(32, 38)]}>{t("Profile")}</Text>
        <Text style={[styles.subheading, lightSecondary, scaledText(14, 20)]}>{t("Manage your personal settings and account actions")}</Text>

        <View style={[styles.heroCard, lightCard, highContrastCard]} accessible accessibilityLabel={screenReaderOptimized ? `${t("Profile for")} ${user?.user_name || t("NeedMap User")}, ${t("role")} ${translateCategory(user?.role || "volunteer")}` : undefined}>
          {reduceMotion ? null : <Animated.View style={[styles.avatarRing, { transform: [{ rotate: ringRotate }] }]} />}
          {profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarCore}>
              <Text style={[styles.avatarText, scaledText(26, 30)]}>{initials}</Text>
            </View>
          )}

          <View style={styles.heroMeta}>
            <Text style={[styles.name, lightPrimary, scaledText(20, 25)]}>{user?.user_name || t("NeedMap User")}</Text>
            <Text style={[styles.email, lightSecondary, scaledText(13, 18)]}>{user?.email || t("No email")}</Text>
            <View style={styles.roleBadge}>
              <Text style={[styles.roleBadgeText, scaledText(11, 15)]}>{translateCategory(user?.role || "volunteer")}</Text>
            </View>
            <Pressable style={[styles.uploadBtn, accessiblePressable, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={pickProfileImage} accessibilityRole="button">
              <Text style={[styles.uploadBtnText, lightPrimary, scaledText(12, 16)]}>{t("Upload Profile Photo")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.panelCard, lightCard, highContrastCard]}>
          <Text style={[styles.panelTitle, lightPrimary, scaledText(16, 22)]}>{t("Accessibility")}</Text>
          <Text style={[styles.skillHint, lightSecondary, scaledText(12, 18)]}>{t("Choose display, motion, and assistive support that works best for you. These settings apply across every role and page.")}</Text>
          {renderToggle(t("Use device accessibility"), useDeviceSettings, setUseDeviceSettings, t("Follows screen reader, reduce motion, bold text, invert colors, and high contrast settings from your device."))}
          <View style={[styles.deviceStatusBox, highContrast ? styles.highContrastToggle : null]} accessible accessibilityLabel={screenReaderOptimized ? t("Current device accessibility status") : undefined}>
            <Text style={[styles.deviceStatusTitle, lightPrimary, scaledText(12, 17)]}>{t("Device status")}</Text>
            <Text style={[styles.deviceStatusText, lightSecondary, scaledText(11, 16)]}>{t("Screen reader")}: {device.screenReaderEnabled ? t("On") : t("Off")}</Text>
            <Text style={[styles.deviceStatusText, lightSecondary, scaledText(11, 16)]}>{t("Reduce motion")}: {device.reduceMotionEnabled ? t("On") : t("Off")}</Text>
            <Text style={[styles.deviceStatusText, lightSecondary, scaledText(11, 16)]}>{t("Bold text")}: {device.boldTextEnabled ? t("On") : t("Off")}</Text>
            <Text style={[styles.deviceStatusText, lightSecondary, scaledText(11, 16)]}>{t("Invert/high contrast")}: {device.invertColorsEnabled || device.highTextContrastEnabled ? t("On") : t("Off")}</Text>
          </View>
          <Text style={[styles.accessibilityLabel, lightPrimary, scaledText(13, 18)]}>{t("Text Size")}</Text>
          <View style={styles.accessibilitySegmentRow}>
            {textSizeOptions.map((option) => {
              const selected = textSize === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.accessibilitySegment, selected && styles.accessibilitySegmentActive, highContrast ? styles.highContrastToggle : null, accessiblePressable]}
                  onPress={() => setTextSize(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={screenReaderOptimized ? `${t("Set text size to")} ${t(option.label)}` : undefined}
                >
                  <Text style={[styles.accessibilitySegmentText, selected && styles.accessibilitySegmentTextActive, scaledText(12, 16)]}>{t(option.label)}</Text>
                </Pressable>
              );
            })}
          </View>
          {renderToggle(t("High contrast"), highContrast, setHighContrast, t("Uses stronger borders and brighter foreground colors."))}
          {renderToggle(t("Reduce motion"), reduceMotion, setReduceMotion, t("Stops decorative animations and rotating profile effects."))}
          {renderToggle(t("Screen reader support"), screenReaderOptimized, setScreenReaderOptimized, t("Adds clearer labels and hints for assistive technology."))}
          {renderToggle(t("Large touch targets"), largeTouchTargets, setLargeTouchTargets, t("Makes buttons easier to tap for motor accessibility."))}
          <Pressable style={[styles.resetAccessibilityBtn, accessiblePressable, highContrast ? styles.highContrastToggle : null]} onPress={resetAccessibilitySettings} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? t("Reset accessibility settings") : undefined} accessibilityHint={screenReaderOptimized ? t("Restores default accessibility preferences for all pages") : undefined}>
            <Text style={[styles.resetAccessibilityText, scaledText(12, 16)]}>{t("Reset Accessibility Settings")}</Text>
          </Pressable>
        </View>

        <View style={[styles.panelCard, lightCard, highContrastCard]}>
          <Text style={[styles.panelTitle, lightPrimary, scaledText(16, 22)]}>{t("Update Profile")}</Text>
          <TextInput style={[styles.input, lightInput, highContrastInput, scaledText(14, 19)]} value={name} onChangeText={setName} placeholder={t("Full name")} placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} accessibilityLabel={t("Full name")} />
          <TextInput style={[styles.input, lightInput, highContrastInput, scaledText(14, 19)]} value={phone} onChangeText={setPhone} placeholder={t("Phone")} placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} accessibilityLabel={t("Phone number")} />
          <Pressable style={[styles.primaryBtn, accessiblePressable, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={saveProfile} accessibilityRole="button">
            <Text style={[styles.primaryBtnText, lightPrimary, scaledText(13, 17)]}>{t("Save Profile")}</Text>
          </Pressable>
        </View>

        <View style={[styles.panelCard, lightCard]}>
          <Text style={[styles.panelTitle, lightPrimary]}>{t("Update Location")}</Text>
          <View style={styles.locationRow}>
            <TextInput style={[styles.input, styles.col, styles.coordinateInput, lightInput]} value={latitude} onChangeText={setLatitude} placeholder={t("Latitude")} keyboardType="numeric" placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
            <TextInput style={[styles.input, styles.col, styles.coordinateInput, lightInput]} value={longitude} onChangeText={setLongitude} placeholder={t("Longitude")} keyboardType="numeric" placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          </View>
          <TextInput style={[styles.input, lightInput]} value={radius} onChangeText={setRadius} placeholder={t("Radius km")} keyboardType="numeric" placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          <View style={styles.row}>
            <Pressable style={[styles.secondaryBtn, styles.col, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={useBrowserLocation}>
              <Text style={[styles.secondaryBtnText, lightPrimary]}>{t("Use Live Location")}</Text>
            </Pressable>
            <Pressable style={[styles.primaryBtn, styles.col, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={saveLocation}>
              <Text style={[styles.primaryBtnText, lightPrimary]}>{t("Save Location")}</Text>
            </Pressable>
          </View>
        </View>

        {isVolunteer ? (
          <View style={[styles.panelCard, lightCard]}>
            <Text style={[styles.panelTitle, lightPrimary]}>{t("Volunteer Skills")}</Text>
            <Text style={[styles.skillHint, lightSecondary]}>{t("These skills are saved to your volunteer profile and used for need match scores.")}</Text>
            <TextInput
              style={[styles.input, lightInput]}
              value={skillName}
              onChangeText={setSkillName}
              placeholder={t("Skill, for example medical, cooking, logistics")}
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
                    <Text style={[styles.proficiencyText, selected && styles.proficiencyTextActive, lightPrimary]}>{translateCategory(option)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={[styles.primaryBtn, skillsLoading ? styles.disabledBtn : null, isLight ? { borderColor: "#000", borderWidth: 2 } : null]}
              onPress={addSkill}
              disabled={skillsLoading}
            >
              <Text style={[styles.primaryBtnText, lightPrimary]}>{skillsLoading ? t("Saving...") : t("Add Skill")}</Text>
            </Pressable>

            <View style={styles.skillList}>
              {(volunteerProfile?.skills ?? []).length === 0 ? (
                <Text style={[styles.emptySkillsText, lightSecondary]}>{t("No skills added yet.")}</Text>
              ) : (
                (volunteerProfile?.skills ?? []).map((skill) => (
                  <View key={skill.id} style={[styles.skillCard, isLight ? { borderColor: "#000", borderWidth: 1 } : null]}>
                    <View style={styles.skillCardHeader}>
                      <Text style={[styles.skillNameText, lightPrimary]} numberOfLines={2}>{skill.skill_name.replace(/_/g, " ")}</Text>
                      <Pressable style={styles.removeSkillBtn} onPress={() => removeSkill(skill)} disabled={skillsLoading}>
                        <Text style={styles.removeSkillText}>{t("Remove")}</Text>
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
                            <Text style={[styles.proficiencyChipText, selected && styles.proficiencyChipTextActive]}>{translateCategory(option)}</Text>
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
          <Text style={[styles.panelTitle, lightPrimary]}>{t("Change Password")}</Text>
          <TextInput style={[styles.input, lightInput]} value={oldPassword} onChangeText={setOldPassword} placeholder={t("Old password")} secureTextEntry placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          <TextInput style={[styles.input, lightInput]} value={newPassword} onChangeText={setNewPassword} placeholder={t("New password")} secureTextEntry placeholderTextColor={isLight ? "#374151" : "#BFC0CF"} />
          <Pressable style={[styles.primaryBtn, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={changePassword}>
            <Text style={[styles.primaryBtnText, lightPrimary]}>{t("Change Password")}</Text>
          </Pressable>
        </View>

        <View style={[styles.panelCard, lightCard]}>
          <Text style={[styles.panelTitle, lightPrimary]}>{t("Danger Zone")}</Text>
          <Pressable style={[styles.dangerBtn, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={deactivateAccount}>
            <Text style={styles.dangerBtnText}>{t("Deactivate Account")}</Text>
          </Pressable>
        </View>

        {message ? <Text style={[styles.message, lightSecondary]}>{message}</Text> : null}

        <Pressable style={[styles.logoutBtn, isLight ? { borderColor: "#000", borderWidth: 2 } : null]} onPress={logout}>
          <Text style={[styles.logoutText, lightPrimary]}>{t("Logout")}</Text>
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
  highContrastCard: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000" },
  panelTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900", marginBottom: 10 },
  skillHint: { color: "#BFC0CF", fontSize: 12, fontWeight: "700", marginBottom: 10 },
  accessibilityLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "900", marginBottom: 8 },
  accessibilitySegmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  accessibilitySegment: {
    flexGrow: 1,
    minWidth: 92,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  accessibilitySegmentActive: { backgroundColor: "#FFD7C2", borderColor: "#FF8A5B" },
  accessibilitySegmentText: { color: "#D0D2E4", fontWeight: "900", fontSize: 12 },
  accessibilitySegmentTextActive: { color: "#5A3525" },
  accessibilityToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  accessibilityToggleTextWrap: { flex: 1, minWidth: 0 },
  accessibilityToggleTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  accessibilityToggleHint: { color: "#BFC0CF", fontSize: 12, fontWeight: "700", marginTop: 2 },
  deviceStatusBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  deviceStatusTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", marginBottom: 4 },
  deviceStatusText: { color: "#BFC0CF", fontSize: 11, fontWeight: "700", marginTop: 2 },
  resetAccessibilityBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resetAccessibilityText: { color: "#FFD7C2", fontSize: 12, fontWeight: "900" },
  highContrastToggle: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#050505" },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 3,
  },
  toggleTrackOn: { backgroundColor: "#3BCB92", borderColor: "#3BCB92" },
  highContrastToggleTrack: { borderColor: "#FFFFFF" },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF" },
  toggleThumbOn: { transform: [{ translateX: 22 }] },

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
  highContrastInput: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000", color: "#FFFFFF" },
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


