import { useEffect, useMemo, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { moduleApi } from "../../services/api";
import type { Need } from "../../types/api";

type DistItem = {
  label: string;
  value: number;
  color: string;
};

const URGENCY_COLORS: Record<string, string> = {
  critical: "#FF4757",
  high: "#FF8C42",
  medium: "#FFD166",
  low: "#43E97B",
};
const STATUS_COLORS: Record<string, string> = {
  new: "#60A5FA",
  verified: "#93C5FD",
  assigned: "#A78BFA",
  proposed: "#C4B5FD",
  accepted: "#818CF8",
  in_progress: "#F59E0B",
  resolved: "#34D399",
  closed: "#10B981",
};
const CATEGORY_COLORS = ["#667EEA", "#8B5CF6", "#22C55E", "#F59E0B", "#EF4444", "#14B8A6"];

const buildConicGradient = (items: DistItem[]): string => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return "conic-gradient(#3B3F66 0deg 360deg)";

  let cursor = 0;
  const parts = items.map((item) => {
    const span = (item.value / total) * 360;
    const start = cursor;
    const end = cursor + span;
    cursor = end;
    return `${item.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
  });

  return `conic-gradient(${parts.join(", ")})`;
};

export const StatisticsScreen = () => {
  const { baseUrl, token, user } = useAuth();
  const { theme } = useThemeMode();
  const isLight = theme.mode === "light";
  const lightPrimary = isLight ? { color: "#0B1220", fontWeight: "800" as const } : null;
  const lightSecondary = isLight ? { color: "#111827", fontWeight: "700" as const } : null;
  const lightCard = isLight ? { borderColor: "#000000", borderWidth: 2, backgroundColor: "rgba(255,255,255,0.97)" } : null;
  const scopedOrganizationId = user?.role === "admin" ? user?.managed_branch_id ?? user?.organization_id : user?.organization_id;
  const [refreshing, setRefreshing] = useState(false);
  const [needs, setNeeds] = useState<Need[]>([]);

  const isOrgScope = user?.role === "owner" || user?.role === "admin";

  const load = async () => {
    setRefreshing(true);
    try {
      const needData = await moduleApi.needs(
        baseUrl,
        token,
        isOrgScope && scopedOrganizationId ? { organization_id: scopedOrganizationId } : undefined,
      );
      setNeeds(needData);
    } catch {
      setNeeds([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [baseUrl, token, isOrgScope, scopedOrganizationId]);

  const summary = useMemo(() => {
    const total = needs.length;
    const active = needs.filter((n) => !["resolved", "closed"].includes((n.status || "").toLowerCase())).length;
    const completed = needs.filter((n) => ["resolved", "closed"].includes((n.status || "").toLowerCase())).length;
    const critical = needs.filter((n) => (n.urgency || "").toLowerCase() === "critical").length;
    const criticalPercent = total > 0 ? Math.round((critical / total) * 100) : 0;

    return { total, active, completed, critical, criticalPercent };
  }, [needs]);

  const needsByUrgency = useMemo(() => {
    const order = ["critical", "high", "medium", "low"];
    const map = new Map<string, number>(order.map((k) => [k, 0]));
    needs.forEach((n) => {
      const key = (n.urgency || "").toLowerCase();
      if (map.has(key)) {
        map.set(key, (map.get(key) || 0) + 1);
      }
    });

    return order.map((label) => ({ label, value: map.get(label) || 0, color: URGENCY_COLORS[label] }));
  }, [needs]);

  const needsByStatus = useMemo(() => {
    const map = new Map<string, number>();
    needs.forEach((n) => {
      const key = (n.status || "unknown").toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([label, value], idx) => ({ label: label.replace(/_/g, " "), value, color: STATUS_COLORS[label] || CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [needs]);

  const needsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    needs.forEach((n) => {
      const key = (n.category || "other").toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    });

    const sorted = Array.from(map.entries())
      .map(([label, value], idx) => ({ label: label.replace(/_/g, " "), value, color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 5) return sorted;

    const top = sorted.slice(0, 5);
    const otherValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
    return [...top, { label: "others", value: otherValue, color: "#94A3B8" }];
  }, [needs]);

  const pieGradient = useMemo(() => buildConicGradient(needsByCategory), [needsByCategory]);
  const donutGradient = useMemo(() => {
    const total = summary.total;
    if (total === 0) return "conic-gradient(#3B3F66 0deg 360deg)";
    const activePercent = (summary.active / total) * 360;
    return `conic-gradient(#FF8C42 0deg ${activePercent}deg, #34D399 ${activePercent}deg 360deg)`;
  }, [summary.active, summary.total]);

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={theme.gradients.page}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#667EEA" />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, lightPrimary]}>Owner Analytics</Text>
        <Text style={[styles.subtitle, lightSecondary]}>Active, urgency, category and status insights for needs</Text>

        <View style={styles.kpiRow}>
          <Kpi label="Total Needs" value={summary.total} isLight={isLight} />
          <Kpi label="Active Needs" value={summary.active} isLight={isLight} />
          <Kpi label="Completed" value={summary.completed} isLight={isLight} />
          <Kpi label="Critical %" value={`${summary.criticalPercent}%`} isLight={isLight} />
        </View>

        <View style={[styles.card, lightCard]}>
          <Text style={[styles.cardTitle, lightPrimary]}>Donut Chart: Active vs Completed</Text>
          {summary.total > 0 ? (
            <View style={styles.pieSection}>
              {Platform.OS === "web" ? (
                <View style={[styles.donutCircle, { backgroundImage: donutGradient } as any]} />
              ) : (
                <View style={styles.pieFallbackCircle}>
                  <Text style={styles.pieFallbackText}>Donut on web</Text>
                </View>
              )}

              <View style={styles.legendCol}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: "#FF8C42" }]} />
                  <Text style={styles.legendText}>Active</Text>
                  <Text style={styles.legendValue}>{summary.active} ({Math.round((summary.active / summary.total) * 100)}%)</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: "#34D399" }]} />
                  <Text style={styles.legendText}>Completed</Text>
                  <Text style={styles.legendValue}>{summary.completed} ({Math.round((summary.completed / summary.total) * 100)}%)</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.empty}>No data available.</Text>
          )}
        </View>

        <View style={[styles.card, lightCard]}>
          <Text style={[styles.cardTitle, lightPrimary]}>Needs by Urgency</Text>
          <HorizontalBars data={needsByUrgency} isLight={isLight} />
        </View>

        <View style={[styles.card, lightCard]}>
          <Text style={[styles.cardTitle, lightPrimary]}>Pie Chart: Category Distribution</Text>
          {needsByCategory.length > 0 ? (
            <View style={styles.pieSection}>
              {Platform.OS === "web" ? (
                <View style={[styles.pieCircle, { backgroundImage: pieGradient } as any]} />
              ) : (
                <View style={styles.pieFallbackCircle}>
                  <Text style={styles.pieFallbackText}>Pie view on web</Text>
                </View>
              )}

              <View style={styles.legendCol}>
                {needsByCategory.map((item) => {
                  const percent = summary.total > 0 ? Math.round((item.value / summary.total) * 100) : 0;
                  return (
                    <View key={item.label} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendText}>{item.label}</Text>
                      <Text style={styles.legendValue}>{item.value} ({percent}%)</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <Text style={styles.empty}>No category data available.</Text>
          )}
        </View>

        <View style={[styles.card, lightCard]}>
          <Text style={[styles.cardTitle, lightPrimary]}>Status Distribution</Text>
          <HorizontalBars data={needsByStatus} isLight={isLight} />
        </View>
      </ScrollView>
    </View>
  );
};

const Kpi = ({ label, value, isLight }: { label: string; value: number | string; isLight: boolean }) => (
  <View style={[styles.kpiCard, isLight ? { borderColor: "#000", borderWidth: 2, backgroundColor: "#FFFFFF" } : null]}>
    <Text style={[styles.kpiValue, isLight ? { color: "#0B1220", fontWeight: "900" } : null]}>{value}</Text>
    <Text style={[styles.kpiLabel, isLight ? { color: "#111827", fontWeight: "800" } : null]}>{label}</Text>
  </View>
);

const HorizontalBars = ({ data, isLight }: { data: DistItem[]; isLight: boolean }) => {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.hBarList}>
      {data.map((d) => {
        const percent = Math.round((d.value / max) * 100);
        return (
          <View key={d.label} style={styles.hBarRow}>
            <Text style={[styles.hBarLabel, isLight ? { color: "#0B1220", fontWeight: "800" } : null]}>{d.label}</Text>
            <View style={[styles.hTrack, isLight ? { backgroundColor: "rgba(0,0,0,0.14)", borderColor: "#000", borderWidth: 1 } : null]}>
              <View style={[styles.hFill, { width: `${Math.max(4, percent)}%`, backgroundColor: d.color }]} />
            </View>
            <Text style={[styles.hValue, isLight ? { color: "#0B1220", fontWeight: "900" } : null]}>{d.value}</Text>
          </View>
        );
      })}
    </View>
  );
};

type LineDataPoint = {
  label: string;
  value: number;
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },

  title: { color: "#FFF", fontSize: 26, fontWeight: "800" },
  subtitle: { color: "#8B8DA3", marginTop: 6, marginBottom: 12 },

  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  kpiCard: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
  },
  kpiValue: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  kpiLabel: { color: "#8B8DA3", marginTop: 4, fontSize: 12, fontWeight: "600" },

  card: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
  },
  cardTitle: { color: "#FFF", fontSize: 15, fontWeight: "700", marginBottom: 10 },

  hBarList: { gap: 10 },
  hBarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  hBarLabel: { color: "#D8D9E3", width: 96, fontSize: 12, textTransform: "capitalize" },
  hTrack: { flex: 1, height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  hFill: { height: "100%", borderRadius: 999 },
  hValue: { color: "#FFF", minWidth: 28, textAlign: "right", fontWeight: "700", fontSize: 12 },

  pieSection: { flexDirection: "row", gap: 14, alignItems: "center" },
  pieCircle: { width: 180, height: 180, borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)" },
  donutCircle: { width: 160, height: 160, borderRadius: 999, borderWidth: 18, borderColor: "#667EEA" },
  pieFallbackCircle: {
    width: 180,
    height: 180,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  pieFallbackText: { color: "#8B8DA3", fontSize: 12 },
  legendCol: { flex: 1, gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 999 },
  legendText: { color: "#D8D9E3", fontSize: 12, textTransform: "capitalize", flex: 1 },
  legendValue: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  empty: { color: "#8B8DA3", fontSize: 13 },
});
