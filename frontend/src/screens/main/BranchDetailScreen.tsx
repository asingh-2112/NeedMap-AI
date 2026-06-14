import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { moduleApi } from "../../services/api";
import type { RootStackParamList } from "../../navigation/types";
import type { AuthUser, Organization } from "../../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "BranchDetail">;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export const BranchDetailScreen = ({ route }: Props) => {
  const nav = useNavigation<Nav>();
  const { branchId } = route.params;
  const { baseUrl, token, user } = useAuth();
  const { reduceMotion } = useAccessibility();
  const { theme } = useThemeMode();

  const [branch, setBranch] = useState<Organization | null>(null);
  const [branchAdmin, setBranchAdmin] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      fadeIn.setValue(1);
      return;
    }

    const animation = Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [fadeIn, reduceMotion]);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const branchData = await moduleApi.getOrganization(baseUrl, token, branchId);
      setBranch(branchData);

      const parentOrgId = branchData.parent_organization_id ?? user?.organization_id ?? null;
      if (parentOrgId) {
        const members = await moduleApi.organizationMembers(baseUrl, token, parentOrgId);
        const admin = members.find((m) => m.role === "admin" && m.managed_branch_id === branchData.id) ?? null;
        setBranchAdmin(admin);
      } else {
        setBranchAdmin(null);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load branch details");
      setBranch(null);
      setBranchAdmin(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [baseUrl, token, branchId]);

  const goBack = () => nav.goBack();

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={theme.gradients.page}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Branch Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeIn }}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#667EEA" />
            <Text style={styles.loadingText}>Loading branch details...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={goBack}>
              <Text style={styles.retryBtnText}>Go Back</Text>
            </Pressable>
          </View>
        ) : branch ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#667EEA" />}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.titleCard}>
              <View style={styles.titleRow}>
                <Text style={styles.branchTitle} numberOfLines={2}>{branch.organization_name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: branch.is_active ? "rgba(46,204,113,0.2)" : "rgba(255,71,87,0.2)", borderColor: branch.is_active ? "#2ED573" : "#FF4757" },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: branch.is_active ? "#2ED573" : "#FF6B6B" }]}>
                    {branch.is_active ? "ACTIVE" : "INACTIVE"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Branch Information</Text>
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Branch ID:</Text>
                <Text style={styles.refValue}>#{branch.id}</Text>
              </View>
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Location:</Text>
                <Text style={styles.refValue}>{branch.branch_location || "No location"}</Text>
              </View>
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Address:</Text>
                <Text style={styles.refValue}>{branch.address || "No address"}</Text>
              </View>
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Phone:</Text>
                <Text style={styles.refValue}>{branch.phone || "No phone"}</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Admin Details</Text>
              {branchAdmin ? (
                <>
                  <View style={styles.refRow}>
                    <Text style={styles.refLabel}>Name:</Text>
                    <Text style={styles.refValue}>{branchAdmin.user_name}</Text>
                  </View>
                  <View style={styles.refRow}>
                    <Text style={styles.refLabel}>Email:</Text>
                    <Text style={styles.refValue}>{branchAdmin.email}</Text>
                  </View>
                  <View style={styles.refRow}>
                    <Text style={styles.refLabel}>Phone:</Text>
                    <Text style={styles.refValue}>{branchAdmin.phone || "No phone"}</Text>
                  </View>
                  <View style={styles.refRow}>
                    <Text style={styles.refLabel}>User ID:</Text>
                    <Text style={styles.refValue}>#{branchAdmin.id}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.emptyText}>No admin assigned to this branch.</Text>
              )}
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Reference</Text>
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Parent Organization ID:</Text>
                <Text style={styles.refValue}>{branch.parent_organization_id ? `#${branch.parent_organization_id}` : "N/A"}</Text>
              </View>
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Owner User ID:</Text>
                <Text style={styles.refValue}>#{branch.user_id}</Text>
              </View>
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Created:</Text>
                <Text style={styles.refValue}>{new Date(branch.created_at).toLocaleString()}</Text>
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>Branch not found.</Text>
            <Pressable style={styles.retryBtn} onPress={goBack}>
              <Text style={styles.retryBtnText}>Go Back</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 56,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(102,126,234,0.15)",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.3)",
    minWidth: 50,
  },
  backBtnText: {
    color: "#667EEA",
    fontSize: 13,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: "#8B8DA3",
    fontSize: 14,
  },
  errorText: {
    color: "#FF4757",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(102,126,234,0.15)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.3)",
  },
  retryBtnText: {
    color: "#667EEA",
    fontSize: 13,
    fontWeight: "700",
  },

  titleCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  branchTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 28,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 70,
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  infoCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#667EEA",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  refRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 12,
  },
  refLabel: {
    color: "#8B8DA3",
    fontSize: 12,
    fontWeight: "600",
    flex: 0.9,
  },
  refValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    flex: 1.1,
    textAlign: "right",
  },
  emptyText: {
    color: "#E0E0E0",
    fontSize: 13,
  },
});
