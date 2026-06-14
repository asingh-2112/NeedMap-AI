import { useEffect, useMemo, useRef, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { moduleApi } from "../../services/api";
import type { RootStackParamList } from "../../navigation/types";
import type { AuthUser, Organization } from "../../types/api";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_FILTERS = ["all", "active", "inactive"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export const OrganizationsScreen = () => {
  const nav = useNavigation<Nav>();
  const { baseUrl, token, user } = useAuth();
  const { reduceMotion } = useAccessibility();
  const { theme } = useThemeMode();
  const isLight = theme.mode === "light";
  const lightPrimary = isLight ? { color: "#0B1220", fontWeight: "800" as const } : null;
  const lightSecondary = isLight ? { color: "#111827", fontWeight: "700" as const } : null;
  const lightCard = isLight ? { borderColor: "#000000", borderWidth: 2, backgroundColor: "rgba(255,255,255,0.97)" } : null;
  const lightInput = isLight ? { borderColor: "#000000", borderWidth: 2, color: "#0B1220", fontWeight: "700" as const, backgroundColor: "#FFFFFF" } : null;

  const [branches, setBranches] = useState<Organization[]>([]);
  const [members, setMembers] = useState<AuthUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showUpdateAdminForm, setShowUpdateAdminForm] = useState(false);
  const [showDeleteForm, setShowDeleteForm] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLocation, setNewBranchLocation] = useState("");
  const [newBranchAddress, setNewBranchAddress] = useState("");
  const [newBranchPhone, setNewBranchPhone] = useState("");

  const [adminBranchId, setAdminBranchId] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPhone, setAdminPhone] = useState("");

  const [deleteBranchId, setDeleteBranchId] = useState("");

  const fadeIn = useRef(new Animated.Value(0)).current;

  const canManage = user?.role === "owner" || user?.role === "admin";
  const canCreateOrDeleteBranch = user?.role === "owner";

  useEffect(() => {
    if (reduceMotion) {
      fadeIn.setValue(1);
      return;
    }

    const animation = Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [fadeIn, reduceMotion]);

  const load = async () => {
    if (!user?.organization_id) {
      setBranches([]);
      setMembers([]);
      return;
    }

    setRefreshing(true);
    try {
      const [branchData, memberData] = await Promise.all([
        moduleApi.organizationBranches(baseUrl, token, user.organization_id),
        moduleApi.organizationMembers(baseUrl, token, user.organization_id),
      ]);
      setBranches(branchData);
      setMembers(memberData);
    } catch {
      setBranches([]);
      setMembers([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [baseUrl, token, user?.organization_id]);

  const adminByBranch = useMemo(() => {
    const map = new Map<number, AuthUser>();
    members.forEach((m) => {
      if (m.role === "admin" && m.managed_branch_id) {
        map.set(m.managed_branch_id, m);
      }
    });
    return map;
  }, [members]);

  const filteredBranches = useMemo(() => {
    const q = filterText.trim().toLowerCase();

    return branches
      .filter((b) => {
        if (statusFilter === "active") return b.is_active;
        if (statusFilter === "inactive") return !b.is_active;
        return true;
      })
      .filter((b) => {
        if (!q) return true;
        return [b.organization_name, b.branch_location ?? "", b.address ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [branches, filterText, statusFilter]);

  const createBranch = async () => {
    if (!user?.organization_id) return;
    if (!newBranchName.trim() || !newBranchLocation.trim()) {
      setActionMessage("Branch name and location are required");
      return;
    }

    setActionLoading(true);
    setActionMessage("");
    try {
      await moduleApi.createOrganizationBranch(baseUrl, token, user.organization_id, {
        organization_name: newBranchName.trim(),
        branch_location: newBranchLocation.trim(),
        address: newBranchAddress.trim() || undefined,
        phone: newBranchPhone.trim() || undefined,
      });
      setActionMessage("Branch created successfully");
      setNewBranchName("");
      setNewBranchLocation("");
      setNewBranchAddress("");
      setNewBranchPhone("");
      await load();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Unable to create branch");
    } finally {
      setActionLoading(false);
    }
  };

  const updateBranchAdmin = async () => {
    if (!user?.organization_id) return;
    const organizationId = user.organization_id;

    const branchIdNum = Number(adminBranchId);
    if (!branchIdNum || !adminName.trim() || !adminEmail.trim() || adminPassword.length < 8) {
      setActionMessage("Branch id, admin name, email and password (min 8) are required");
      return;
    }

    setActionLoading(true);
    setActionMessage("");

    const overwriteAdminForBranch = async () => {
      await moduleApi.addOrganizationMember(baseUrl, token, organizationId, {
        user_name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
        role: "admin",
        managed_branch_id: branchIdNum,
        phone: adminPhone.trim() || undefined,
      });
    };

    const clearAdminForm = () => {
      setAdminBranchId("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setAdminPhone("");
    };

    try {
      await overwriteAdminForBranch();

      setActionMessage(`Admin updated for branch #${branchIdNum}`);
      clearAdminForm();
      await load();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Unable to update admin");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteBranch = async () => {
    const branchIdNum = Number(deleteBranchId);
    if (!branchIdNum) {
      setActionMessage("Enter a valid branch id");
      return;
    }

    const doDelete = async () => {
      setActionLoading(true);
      setActionMessage("");
      try {
        await moduleApi.deactivateOrganization(baseUrl, token, branchIdNum);
        setActionMessage("Branch deleted successfully");
        setDeleteBranchId("");
        await load();
      } catch (err) {
        setActionMessage(err instanceof Error ? err.message : "Unable to delete branch");
      } finally {
        setActionLoading(false);
      }
    };

    if (Platform.OS === "web") {
      const ok = window.confirm(`Delete branch #${branchIdNum}?`);
      if (ok) await doDelete();
      return;
    }

    Alert.alert("Delete Branch", `Delete branch #${branchIdNum}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void doDelete() },
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

      <Animated.View style={{ flex: 1, opacity: fadeIn }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#667EEA" />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.pageTitle, lightPrimary]}>Organizations</Text>
              <Text style={[styles.pageSubtitle, lightSecondary]}>Manage branches and branch admins</Text>
            </View>
          </View>

          {canManage ? (
            <View style={[styles.formCard, lightCard]}>
              <Text style={[styles.formTitle, lightPrimary]}>Branch Actions</Text>
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionBtn, showCreateForm && styles.actionBtnActive]}
                  onPress={() => {
                    setShowCreateForm((v) => !v);
                    setShowUpdateAdminForm(false);
                    setShowDeleteForm(false);
                    setActionMessage("");
                  }}
                >
                  <Text style={[styles.actionBtnText, lightPrimary]}>Create Branch</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, showUpdateAdminForm && styles.actionBtnActive]}
                  onPress={() => {
                    setShowUpdateAdminForm((v) => !v);
                    setShowCreateForm(false);
                    setShowDeleteForm(false);
                    setActionMessage("");
                  }}
                >
                  <Text style={[styles.actionBtnText, lightPrimary]}>Update Admin Details</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, showDeleteForm && styles.actionBtnDanger]}
                  onPress={() => {
                    setShowDeleteForm((v) => !v);
                    setShowCreateForm(false);
                    setShowUpdateAdminForm(false);
                    setActionMessage("");
                  }}
                >
                  <Text style={[styles.actionBtnText, lightPrimary]}>Delete Branch</Text>
                </Pressable>
              </View>

              {showCreateForm && canCreateOrDeleteBranch ? (
                <View style={styles.formFields}>
                  <Text style={[styles.label, lightSecondary]}>Branch Name</Text>
                  <TextInput style={[styles.input, lightInput]} value={newBranchName} onChangeText={setNewBranchName} placeholder="NeedMap East Branch" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Text style={[styles.label, lightSecondary]}>Branch Location</Text>
                  <TextInput style={[styles.input, lightInput]} value={newBranchLocation} onChangeText={setNewBranchLocation} placeholder="Naini, Prayagraj" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Text style={[styles.label, lightSecondary]}>Branch Address</Text>
                  <TextInput style={[styles.input, lightInput]} value={newBranchAddress} onChangeText={setNewBranchAddress} placeholder="Full branch address" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Text style={[styles.label, lightSecondary]}>Branch Phone</Text>
                  <TextInput style={[styles.input, lightInput]} value={newBranchPhone} onChangeText={setNewBranchPhone} placeholder="+91XXXXXXXXXX" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Pressable style={[styles.submitBtn, actionLoading && styles.disabledBtn]} disabled={actionLoading} onPress={createBranch}>
                    <LinearGradient colors={["#667EEA", "#764BA2"]} style={styles.submitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Text style={[styles.submitText, isLight ? { color: "#0B1220", fontWeight: "900" } : null]}>{actionLoading ? "Creating..." : "Create Branch"}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : null}

              {showUpdateAdminForm ? (
                <View style={styles.formFields}>
                  <Text style={[styles.label, lightSecondary]}>Branch ID</Text>
                  <TextInput style={[styles.input, lightInput]} value={adminBranchId} onChangeText={setAdminBranchId} keyboardType="numeric" placeholder="Enter branch id" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Text style={[styles.label, lightSecondary]}>Admin Name</Text>
                  <TextInput style={[styles.input, lightInput]} value={adminName} onChangeText={setAdminName} placeholder="Admin full name" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Text style={[styles.label, lightSecondary]}>Admin Email</Text>
                  <TextInput style={[styles.input, lightInput]} value={adminEmail} onChangeText={setAdminEmail} autoCapitalize="none" keyboardType="email-address" placeholder="admin@example.com" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Text style={[styles.label, lightSecondary]}>Admin Password</Text>
                  <TextInput style={[styles.input, lightInput]} value={adminPassword} onChangeText={setAdminPassword} secureTextEntry placeholder="Minimum 8 characters" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Text style={[styles.label, lightSecondary]}>Admin Phone (optional)</Text>
                  <TextInput style={[styles.input, lightInput]} value={adminPhone} onChangeText={setAdminPhone} placeholder="+91XXXXXXXXXX" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Pressable style={[styles.submitBtn, actionLoading && styles.disabledBtn]} disabled={actionLoading} onPress={updateBranchAdmin}>
                    <LinearGradient colors={["#667EEA", "#764BA2"]} style={styles.submitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Text style={[styles.submitText, isLight ? { color: "#0B1220", fontWeight: "900" } : null]}>{actionLoading ? "Updating..." : "Update Admin"}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              ) : null}

              {showDeleteForm && canCreateOrDeleteBranch ? (
                <View style={styles.formFields}>
                  <Text style={[styles.label, lightSecondary]}>Branch ID</Text>
                  <TextInput style={[styles.input, lightInput]} value={deleteBranchId} onChangeText={setDeleteBranchId} keyboardType="numeric" placeholder="Enter branch id to delete" placeholderTextColor={isLight ? "#374151" : "#6B6B8A"} />

                  <Pressable style={[styles.deleteBtn, actionLoading && styles.disabledBtn]} disabled={actionLoading} onPress={deleteBranch}>
                    <Text style={styles.deleteBtnText}>{actionLoading ? "Deleting..." : "Delete Branch"}</Text>
                  </Pressable>
                </View>
              ) : null}

              {actionMessage ? <Text style={[styles.message, lightSecondary]}>{actionMessage}</Text> : null}
            </View>
          ) : null}

          <View style={styles.listHeader}>
            <Text style={[styles.listTitle, lightPrimary]}>Branch List</Text>
            <Text style={[styles.listCount, lightSecondary]}>{filteredBranches.length} shown</Text>
          </View>

          <View style={styles.filterRow}>
            <View style={[styles.filterCol, { flex: 1.4 }]}> 
              <Text style={[styles.filterLabel, lightSecondary]}>Search</Text>
              <TextInput
                style={[styles.filterInput, lightInput]}
                value={filterText}
                onChangeText={setFilterText}
                placeholder="Name, location or address"
                placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
              />
            </View>

            <View style={styles.filterCol}>
              <Text style={[styles.filterLabel, lightSecondary]}>Status</Text>
              <Pressable
                style={[styles.filterSelectBtn, lightInput]}
                onPress={() => setShowStatusDropdown((prev) => !prev)}
              >
                <Text style={[styles.filterSelectText, lightPrimary]}>{statusFilter}</Text>
                <Text style={[styles.filterChevron, lightPrimary]}>▼</Text>
              </Pressable>
              {showStatusDropdown ? (
                <View style={[styles.filterDropdown, lightCard]}>
                  {STATUS_FILTERS.map((s) => (
                    <Pressable
                      key={s}
                      style={styles.filterOption}
                      onPress={() => {
                        setStatusFilter(s);
                        setShowStatusDropdown(false);
                      }}
                    >
                      <Text style={[styles.filterOptionText, lightPrimary]}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          {filteredBranches.map((branch) => {
            const admin = adminByBranch.get(branch.id);
            return (
              <Pressable key={branch.id} style={[styles.branchCard, lightCard]} onPress={() => nav.navigate("BranchDetail", { branchId: branch.id })}>
                <View style={styles.branchHeader}>
                  <Text style={[styles.branchTitle, lightPrimary]} numberOfLines={1}>{branch.organization_name}</Text>
                  <View style={[styles.statusBadge, branch.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                    <Text style={[styles.statusText, branch.is_active ? styles.activeText : styles.inactiveText]}>
                      {branch.is_active ? "ACTIVE" : "INACTIVE"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.branchMeta, lightSecondary]}><Text style={[styles.branchMetaStrong, lightPrimary]}>Branch ID:</Text> #{branch.id}</Text>
                <Text style={[styles.branchMeta, lightSecondary]}><Text style={[styles.branchMetaStrong, lightPrimary]}>Location:</Text> {branch.branch_location || "No location"}</Text>
                <Text style={[styles.branchMeta, lightSecondary]}><Text style={[styles.branchMetaStrong, lightPrimary]}>Address:</Text> {branch.address || "No address"}</Text>
                <Text style={[styles.branchMeta, lightSecondary]}><Text style={[styles.branchMetaStrong, lightPrimary]}>Admin:</Text> {admin ? `${admin.user_name} (${admin.email})` : "Not assigned"}</Text>
                <Text style={[styles.branchHint, lightPrimary]}>Tap to view branch details</Text>
              </Pressable>
            );
          })}

          {filteredBranches.length === 0 && !refreshing ? (
            <View style={[styles.emptyCard, lightCard]}>
              <Text style={[styles.emptyTitle, lightPrimary]}>No branches found</Text>
              <Text style={[styles.emptyMeta, lightSecondary]}>Try changing filters or create a new branch.</Text>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 36 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  pageTitle: { fontSize: 30, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.3 },
  pageSubtitle: { marginTop: 4, fontSize: 14, color: "#8B8DA3", lineHeight: 20 },

  formCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 16,
  },
  formTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700", marginBottom: 10 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  actionBtn: {
    backgroundColor: "rgba(102,126,234,0.14)",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionBtnActive: { backgroundColor: "rgba(102,126,234,0.28)" },
  actionBtnDanger: { backgroundColor: "rgba(255,75,75,0.18)", borderColor: "rgba(255,75,75,0.35)" },
  actionBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },

  formFields: { marginTop: 4 },
  label: { fontSize: 12, color: "#8B8DA3", marginBottom: 6, fontWeight: "600", marginTop: 6 },
  input: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ web: 10, default: 9 }),
    color: "#FFFFFF",
  },

  submitBtn: { borderRadius: 12, overflow: "hidden", marginTop: 12 },
  submitGradient: { alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  submitText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  deleteBtn: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,75,75,0.35)",
    backgroundColor: "rgba(255,75,75,0.16)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  deleteBtnText: { color: "#FF7D7D", fontSize: 12, fontWeight: "700" },

  disabledBtn: { opacity: 0.6 },
  message: { color: "#8B8DA3", marginTop: 10, fontSize: 12 },

  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  listTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  listCount: { color: "#8B8DA3", fontSize: 12, fontWeight: "600" },

  filterRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
    zIndex: 10,
  },
  filterCol: { flex: 1 },
  filterLabel: { fontSize: 11, color: "#8B8DA3", marginBottom: 6, fontWeight: "600" },
  filterInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.select({ web: 9, default: 8 }),
    color: "#FFFFFF",
  },
  filterSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: Platform.select({ web: 9, default: 8 }),
  },
  filterSelectText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  filterChevron: { color: "#8B8DA3", fontSize: 11 },
  filterDropdown: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#1A1640",
    overflow: "hidden",
  },
  filterOption: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  filterOptionText: { color: "#FFFFFF", fontSize: 13, textTransform: "capitalize" },

  branchCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
    marginBottom: 10,
  },
  branchHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  branchTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800", flex: 1 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  activeBadge: { backgroundColor: "rgba(46,204,113,0.18)", borderColor: "rgba(46,204,113,0.5)" },
  inactiveBadge: { backgroundColor: "rgba(231,76,60,0.18)", borderColor: "rgba(231,76,60,0.5)" },
  activeText: { color: "#9FFFC4" },
  inactiveText: { color: "#FFD0C8" },
  branchMeta: { color: "#CFCFE8", fontSize: 13, lineHeight: 20, marginTop: 3 },
  branchMetaStrong: { color: "#FFFFFF", fontWeight: "700" },
  branchHint: { color: "#667EEA", marginTop: 8, fontSize: 12, fontWeight: "700" },

  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 14,
  },
  emptyTitle: { color: "#FFFFFF", fontWeight: "800", marginBottom: 4 },
  emptyMeta: { color: "#8B8DA3" },
});
