import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { moduleApi } from "../../services/api";
import type { Organization } from "../../types/api";
import { colors } from "../../theme";

export const OrganizationsScreen = () => {
  const { baseUrl, token, user } = useAuth();
  const [items, setItems] = useState<Organization[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deactivatingOrgId, setDeactivatingOrgId] = useState<number | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberMessage, setMemberMessage] = useState<string>("");

  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberRole, setMemberRole] = useState<"admin" | "volunteer">("volunteer");

  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await moduleApi.organizations(baseUrl, token);
      setItems(data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const myOrganization = items.find((o) => o.id === user?.organization_id) || null;
  const canManageMyOrg = !!(myOrganization && (user?.role === "owner" || user?.role === "admin"));
  const isMyOrgOwner = !!(myOrganization && user?.role === "owner" && user.id === myOrganization.user_id);

  const deactivateOrganization = async (organizationId: number) => {
    const doDeactivate = async () => {
      try {
        setDeactivatingOrgId(organizationId);
        const result = await moduleApi.deactivateOrganization(baseUrl, token, organizationId);
        await load();
        if (Platform.OS === "web") {
          window.alert(result.message);
        } else {
          Alert.alert("Done", result.message);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to deactivate organization";
        if (Platform.OS === "web") {
          window.alert(msg);
        } else {
          Alert.alert("Action failed", msg);
        }
      } finally {
        setDeactivatingOrgId(null);
      }
    };

    if (Platform.OS === "web") {
      const ok = window.confirm("Are you sure you want to deactivate this organization?");
      if (ok) {
        await doDeactivate();
      }
      return;
    }

    Alert.alert(
      "Deactivate Organization",
      "Only owner can deactivate. This will soft-disable the organization.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Deactivate", style: "destructive", onPress: () => void doDeactivate() },
      ],
    );
  };

  const addMember = async () => {
    if (!myOrganization) return;
    setMemberLoading(true);
    setMemberMessage("");
    try {
      const added = await moduleApi.addOrganizationMember(baseUrl, token, myOrganization.id, {
        user_name: memberName.trim(),
        email: memberEmail.trim(),
        password: memberPassword,
        role: memberRole,
        phone: memberPhone.trim() || undefined,
      });
      setMemberMessage(`Added ${added.user_name} as ${added.role}`);
      setMemberName("");
      setMemberEmail("");
      setMemberPassword("");
      setMemberPhone("");
    } catch (err) {
      setMemberMessage(err instanceof Error ? err.message : "Unable to add member");
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatA, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(floatA, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 3300, useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 3300, useNativeDriver: true }),
      ]),
    ).start();
  }, [floatA, floatB]);

  const yA = floatA.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const yB = floatB.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });

  return (
    <View style={styles.page}>
      <LinearGradient colors={[colors.bg, colors.bgSoft, colors.bgWarm]} style={StyleSheet.absoluteFillObject} />

      <Animated.View style={[styles.blob, styles.blobA, { transform: [{ translateY: yA }] }]} />
      <Animated.View style={[styles.blob, styles.blobB, { transform: [{ translateY: yB }] }]} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Organizations</Text>
        <Text style={styles.subtitle}>Connected groups and partner networks</Text>

        {canManageMyOrg && myOrganization ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your Organization Controls</Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaStrong}>Organization:</Text> {myOrganization.organization_name}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaStrong}>Your Role:</Text> {user?.role}
            </Text>

            <Text style={styles.formLabel}>Member Name</Text>
            <TextInput style={styles.input} value={memberName} onChangeText={setMemberName} placeholder="Priya Sharma" placeholderTextColor={colors.muted} />

            <Text style={styles.formLabel}>Member Email</Text>
            <TextInput style={styles.input} value={memberEmail} onChangeText={setMemberEmail} placeholder="priya@example.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} />

            <Text style={styles.formLabel}>Password</Text>
            <TextInput style={styles.input} value={memberPassword} onChangeText={setMemberPassword} placeholder="Min 8 chars" secureTextEntry placeholderTextColor={colors.muted} />

            <Text style={styles.formLabel}>Phone (optional)</Text>
            <TextInput style={styles.input} value={memberPhone} onChangeText={setMemberPhone} placeholder="+91XXXXXXXXXX" placeholderTextColor={colors.muted} />

            <View style={styles.roleRow}>
              <Pressable
                style={[styles.roleBtn, memberRole === "volunteer" && styles.roleBtnActive]}
                onPress={() => setMemberRole("volunteer")}
              >
                <Text style={[styles.roleBtnText, memberRole === "volunteer" && styles.roleBtnTextActive]}>Volunteer</Text>
              </Pressable>
              <Pressable
                style={[styles.roleBtn, memberRole === "admin" && styles.roleBtnActive]}
                onPress={() => setMemberRole("admin")}
              >
                <Text style={[styles.roleBtnText, memberRole === "admin" && styles.roleBtnTextActive]}>Admin</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.primaryBtn, memberLoading && styles.disabledBtn]}
              disabled={
                memberLoading ||
                memberName.trim().length < 2 ||
                !memberEmail.trim() ||
                memberPassword.length < 8
              }
              onPress={addMember}
            >
              <Text style={styles.primaryBtnText}>{memberLoading ? "Adding..." : "Add Member"}</Text>
            </Pressable>

            {memberMessage ? <Text style={styles.message}>{memberMessage}</Text> : null}

            {isMyOrgOwner && myOrganization.is_active ? (
              <Pressable
                style={[styles.deactivateBtn, deactivatingOrgId === myOrganization.id && styles.deactivateBtnDisabled]}
                disabled={deactivatingOrgId === myOrganization.id}
                onPress={() => deactivateOrganization(myOrganization.id)}
              >
                <Text style={styles.deactivateBtnText}>
                  {deactivatingOrgId === myOrganization.id ? "Deactivating..." : "Deactivate Organization"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {items.map((o) => (
          <View key={o.id} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>{o.organization_name}</Text>
              <View style={[styles.badge, o.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                <Text style={[styles.badgeText, o.is_active ? styles.activeText : styles.inactiveText]}>
                  {o.is_active ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>

            <Text style={styles.metaLine}>
              <Text style={styles.metaStrong}>Address:</Text> {o.address || "No address"}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaStrong}>Phone:</Text> {o.phone || "No phone"}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaStrong}>Owner ID:</Text> {o.user_id}
            </Text>
          </View>
        ))}

        {items.length === 0 && !refreshing ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No organizations found</Text>
            <Text style={styles.emptyMeta}>Pull to refresh and load organization records.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },

  blob: { position: "absolute", borderRadius: 999, opacity: 0.33 },
  blobA: { width: 220, height: 220, top: 80, left: -60, backgroundColor: colors.blobA },
  blobB: { width: 260, height: 260, right: -80, bottom: 120, backgroundColor: colors.blobB },

  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginBottom: 2 },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 12 },

  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  sectionTitle: { color: colors.textStrong, fontWeight: "900", fontSize: 16, marginBottom: 8 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },

  name: { flex: 1, color: colors.textStrong, fontWeight: "900", fontSize: 16 },

  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeBadge: { backgroundColor: "rgba(59,203,146,0.18)", borderColor: colors.success },
  inactiveBadge: { backgroundColor: "rgba(227,108,106,0.18)", borderColor: colors.danger },
  badgeText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  activeText: { color: colors.success },
  inactiveText: { color: colors.danger },

  metaLine: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  metaStrong: { color: colors.textStrong, fontWeight: "800" },

  formLabel: { color: colors.textStrong, fontWeight: "800", marginTop: 8, marginBottom: 4, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.cardSoft,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  roleRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  roleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  roleBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  roleBtnText: { color: colors.muted, fontWeight: "800" },
  roleBtnTextActive: { color: colors.textStrong },

  primaryBtn: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.textStrong, fontWeight: "900" },
  disabledBtn: { opacity: 0.6 },

  message: { marginTop: 8, color: colors.muted, fontSize: 12, fontWeight: "700" },

  deactivateBtn: {
    marginTop: 10,
    backgroundColor: colors.danger,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  deactivateBtnDisabled: { opacity: 0.6 },
  deactivateBtnText: { color: colors.textStrong, fontWeight: "800", fontSize: 13 },

  emptyCard: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
  },
  emptyTitle: { color: colors.textStrong, fontSize: 16, fontWeight: "900", marginBottom: 4 },
  emptyMeta: { color: colors.muted, fontSize: 13 },
});


