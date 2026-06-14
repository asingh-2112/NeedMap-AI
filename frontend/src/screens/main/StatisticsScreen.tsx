import { useEffect, useMemo, useState } from "react";
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useRealtime } from "../../context/RealtimeContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { moduleApi } from "../../services/api";
import type { Need, Organization } from "../../types/api";

type DistItem = {
  label: string;
  value: number;
  color: string;
};

type TrendItem = {
  label: string;
  value: number;
};

type AreaItem = {
  area: string;
  city: string;
  total: number;
  active: number;
  completed: number;
  urgent: number;
};

type BranchCompletionItem = {
  id: number;
  name: string;
  location: string;
  total: number;
  active: number;
  inProgress: number;
  completed: number;
  urgent: number;
  completionRate: number;
};

const URGENCY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#F59E0B",
  low: "#22C55E",
};

const STATUS_COLORS: Record<string, string> = {
  active: "#3B82F6",
  in_progress: "#F59E0B",
  completed: "#22C55E",
};

const CATEGORY_COLORS = ["#3B82F6", "#8B5CF6", "#14B8A6", "#F59E0B", "#EF4444", "#64748B"];

const formatLabel = (value: string) => value.replace(/_/g, " ");

const getStatusGroup = (status: string) => {
  const key = status.toLowerCase();
  if (["resolved", "closed"].includes(key)) return "completed";
  if (key === "in_progress") return "in_progress";
  return "active";
};

const getAreaFromNeed = (need: Need) => {
  const addressArea = (need.address || "").split(",").map((part) => part.trim()).filter(Boolean)[0];
  return (need.colony || need.street || addressArea || "Unknown Area").trim();
};

const getCityFromNeed = (need: Need) => {
  if (need.city?.trim()) return need.city.trim();
  const parts = (need.address || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 3];
  if (parts.length >= 2) return parts[parts.length - 2];
  return "Unknown City";
};

const buildConicGradient = (items: DistItem[]): string => {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return "conic-gradient(#E2E8F0 0deg 360deg)";

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
  const { statisticsVersion } = useRealtime();
  const { highContrast, textScale } = useAccessibility();
  const { theme } = useThemeMode();
  const isLight = theme.mode === "light";
  const isAdmin = user?.role === "admin";
  const isOwner = user?.role === "owner";
  const adminBranchId = isAdmin ? user?.managed_branch_id ?? null : null;
  const scopedOrganizationId = isAdmin ? adminBranchId : user?.organization_id;
  const hasScope = Boolean(scopedOrganizationId);

  const lightPrimary = isLight ? { color: "#0B1220", fontWeight: "900" as const } : null;
  const lightSecondary = isLight ? { color: "#111827", fontWeight: "700" as const } : null;
  const lightPanel = isLight ? { borderColor: "#000000", borderWidth: 2, backgroundColor: "#FFFFFF" } : null;

  const [refreshing, setRefreshing] = useState(false);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [scopeOrganizations, setScopeOrganizations] = useState<Organization[]>([]);

  const load = async () => {
    setRefreshing(true);
    try {
      if (isAdmin && !adminBranchId) {
        setNeeds([]);
        setScopeOrganizations([]);
        return;
      }

      if (isOwner && scopedOrganizationId) {
        const [rootOrg, branchList, needData] = await Promise.all([
          moduleApi.getOrganization(baseUrl, token, scopedOrganizationId),
          moduleApi.organizationBranches(baseUrl, token, scopedOrganizationId),
          moduleApi.needs(baseUrl, token),
        ]);
        const activeBranches = branchList.filter((branch) => branch.is_active !== false);
        const scopedOrgIds = new Set<number>([scopedOrganizationId, ...activeBranches.map((branch) => branch.id)]);
        setScopeOrganizations([rootOrg, ...activeBranches]);
        setNeeds(needData.filter((need) => scopedOrgIds.has(need.organization_id)));
        return;
      }

      const needData = await moduleApi.needs(
        baseUrl,
        token,
        isAdmin && scopedOrganizationId ? { organization_id: scopedOrganizationId } : undefined,
      );

      const scopedNeeds = isAdmin && adminBranchId
        ? needData.filter((need) => need.organization_id === adminBranchId)
        : needData;
      setScopeOrganizations([]);
      setNeeds(scopedNeeds);
    } catch {
      setNeeds([]);
      setScopeOrganizations([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [adminBranchId, baseUrl, isAdmin, isOwner, scopedOrganizationId, statisticsVersion, token]);

  const summary = useMemo(() => {
    const total = needs.length;
    const active = needs.filter((need) => getStatusGroup(need.status) === "active").length;
    const inProgress = needs.filter((need) => getStatusGroup(need.status) === "in_progress").length;
    const completed = needs.filter((need) => getStatusGroup(need.status) === "completed").length;
    const urgentOpen = needs.filter((need) => {
      const urgency = (need.urgency || "").toLowerCase();
      return ["critical", "high"].includes(urgency) && getStatusGroup(need.status) !== "completed";
    }).length;
    const affectedPeople = needs.reduce((sum, need) => sum + (need.affected_count ?? 0), 0);
    const scoredNeeds = needs.filter((need) => typeof need.priority_score === "number");
    const avgPriority = scoredNeeds.length > 0
      ? Math.round(scoredNeeds.reduce((sum, need) => sum + (need.priority_score ?? 0), 0) / scoredNeeds.length)
      : 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const activeLoadRate = total > 0 ? Math.round(((active + inProgress) / total) * 100) : 0;

    return { total, active, inProgress, completed, urgentOpen, affectedPeople, avgPriority, completionRate, activeLoadRate };
  }, [needs]);

  const statusMix = useMemo<DistItem[]>(() => [
    { label: "Active", value: summary.active, color: STATUS_COLORS.active },
    { label: "In Progress", value: summary.inProgress, color: STATUS_COLORS.in_progress },
    { label: "Completed", value: summary.completed, color: STATUS_COLORS.completed },
  ], [summary.active, summary.completed, summary.inProgress]);

  const needsByUrgency = useMemo(() => {
    const order = ["critical", "high", "medium", "low"];
    const map = new Map<string, number>(order.map((label) => [label, 0]));
    needs.forEach((need) => {
      const key = (need.urgency || "").toLowerCase();
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
    });
    return order.map((label) => ({ label, value: map.get(label) ?? 0, color: URGENCY_COLORS[label] }));
  }, [needs]);

  const needsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    needs.forEach((need) => {
      const key = (need.category || "other").toLowerCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    const sorted = Array.from(map.entries())
      .map(([label, value], index) => ({ label: formatLabel(label), value, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 5) return sorted;
    return [
      ...sorted.slice(0, 5),
      { label: "others", value: sorted.slice(5).reduce((sum, item) => sum + item.value, 0), color: "#94A3B8" },
    ];
  }, [needs]);

  const areaBreakdown = useMemo<AreaItem[]>(() => {
    const buckets = new Map<string, AreaItem>();
    needs.forEach((need) => {
      const area = getAreaFromNeed(need);
      const city = getCityFromNeed(need);
      const key = `${city.toLowerCase()}|${area.toLowerCase()}`;
      const current = buckets.get(key) ?? { area, city, total: 0, active: 0, completed: 0, urgent: 0 };
      const statusGroup = getStatusGroup(need.status);
      current.total += 1;
      if (statusGroup === "completed") current.completed += 1;
      else current.active += 1;
      if (["critical", "high"].includes((need.urgency || "").toLowerCase()) && statusGroup !== "completed") current.urgent += 1;
      buckets.set(key, current);
    });

    return Array.from(buckets.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [needs]);

  const branchCompletionBreakdown = useMemo<BranchCompletionItem[]>(() => {
    const organizations = scopeOrganizations.length > 0
      ? scopeOrganizations
      : scopedOrganizationId
        ? [{
            id: scopedOrganizationId,
            organization_name: isAdmin ? `Branch #${scopedOrganizationId}` : `Organization #${scopedOrganizationId}`,
            branch_location: null,
            address: null,
            phone: null,
            user_id: 0,
            is_active: true,
            created_at: "",
          }]
        : [];

    return organizations.map((organization) => {
      const branchNeeds = needs.filter((need) => need.organization_id === organization.id);
      const active = branchNeeds.filter((need) => getStatusGroup(need.status) === "active").length;
      const inProgress = branchNeeds.filter((need) => getStatusGroup(need.status) === "in_progress").length;
      const completed = branchNeeds.filter((need) => getStatusGroup(need.status) === "completed").length;
      const urgent = branchNeeds.filter((need) => {
        const urgency = (need.urgency || "").toLowerCase();
        return ["critical", "high"].includes(urgency) && getStatusGroup(need.status) !== "completed";
      }).length;
      const total = branchNeeds.length;

      return {
        id: organization.id,
        name: organization.organization_name,
        location: organization.branch_location || organization.address || "No location set",
        total,
        active,
        inProgress,
        completed,
        urgent,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }).sort((a, b) => b.completed - a.completed || b.total - a.total || a.name.localeCompare(b.name));
  }, [isAdmin, needs, scopedOrganizationId, scopeOrganizations]);

  const lastSevenDays = useMemo<TrendItem[]>(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }), value: 0 };
    });
    const lookup = new Map(days.map((day) => [day.key, day]));
    needs.forEach((need) => {
      const key = new Date(need.created_at).toISOString().slice(0, 10);
      const day = lookup.get(key);
      if (day) day.value += 1;
    });
    return days.map(({ label, value }) => ({ label, value }));
  }, [needs]);

  const statusGradient = useMemo(() => buildConicGradient(statusMix), [statusMix]);
  const categoryGradient = useMemo(() => buildConicGradient(needsByCategory), [needsByCategory]);
  const headerTitle = isAdmin ? "Branch Analytics" : isOwner ? "Owner Branch Analytics" : "Statistics";
  const headerSubtitle = isAdmin
    ? "Only needs from your assigned branch are included."
    : "All owner branches and completed need performance are included.";
  const scopeLabel = isAdmin
    ? adminBranchId ? `Branch #${adminBranchId}` : "No branch"
    : isOwner ? `${Math.max(scopeOrganizations.length - 1, 0)} branches` : null;
  const scopeNoun = isOwner ? "Organization" : "Branch";
  const scaledText = (fontSize: number, lineHeight?: number) => ({
    fontSize: fontSize * textScale,
    ...(lineHeight ? { lineHeight: lineHeight * textScale } : {}),
  });
  const highContrastPanel = highContrast ? styles.highContrastPanel : null;

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
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.title, lightPrimary, scaledText(26, 32)]}>{headerTitle}</Text>
            <Text style={[styles.subtitle, lightSecondary, scaledText(13, 19)]}>{headerSubtitle}</Text>
          </View>
          {scopeLabel ? <ScopeBadge label={scopeLabel} isLight={isLight} /> : null}
        </View>

        {!hasScope && isAdmin ? (
          <View style={[styles.emptyPanel, lightPanel, highContrastPanel]}>
            <Text style={[styles.emptyTitle, lightPrimary, scaledText(17, 22)]}>No branch assigned</Text>
            <Text style={[styles.empty, lightSecondary, scaledText(13, 19)]}>Ask the owner to assign this admin account to a branch before viewing branch statistics.</Text>
          </View>
        ) : (
          <>
            <View style={styles.kpiRow}>
              <Kpi label={isOwner ? "All Needs" : "Branch Needs"} value={summary.total} accent="#3B82F6" isLight={isLight} />
              <Kpi label="Open Load" value={`${summary.activeLoadRate}%`} accent="#F59E0B" isLight={isLight} />
              <Kpi label="Completed" value={`${summary.completionRate}%`} accent="#22C55E" isLight={isLight} />
              <Kpi label="Urgent Open" value={summary.urgentOpen} accent="#EF4444" isLight={isLight} />
            </View>

            <View style={styles.insightGrid}>
              <InsightPanel label="Affected People" value={summary.affectedPeople.toLocaleString()} detail={`From ${scopeNoun.toLowerCase()} need records`} color="#14B8A6" isLight={isLight} />
              <InsightPanel label="Average Priority" value={summary.avgPriority || "-"} detail="Based on scored needs" color="#8B5CF6" isLight={isLight} />
            </View>

            <View style={[styles.panel, lightPanel, highContrastPanel]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, lightPrimary, scaledText(15, 20)]}>{scopeNoun} Workload Mix</Text>
                <Text style={[styles.panelMeta, lightSecondary, scaledText(11, 15)]}>{summary.total} total</Text>
              </View>
              <View style={styles.chartSplit}>
                <Donut gradient={statusGradient} center={`${summary.activeLoadRate}%`} label="Open" />
                <View style={styles.legendCol}>
                  {statusMix.map((item) => <LegendItem key={item.label} item={item} total={summary.total} isLight={isLight} />)}
                </View>
              </View>
            </View>

            <View style={[styles.panel, lightPanel, highContrastPanel]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, lightPrimary, scaledText(15, 20)]}>{isOwner ? "Branch Completion Details" : "Branch Completion"}</Text>
                <Text style={[styles.panelMeta, lightSecondary, scaledText(11, 15)]}>{summary.completed} completed</Text>
              </View>
              {branchCompletionBreakdown.length > 0 ? (
                <View style={styles.branchCompletionList}>
                  {branchCompletionBreakdown.map((branch) => (
                    <BranchCompletionRow key={branch.id} branch={branch} isLight={isLight} />
                  ))}
                </View>
              ) : (
                <Text style={[styles.empty, lightSecondary]}>No branch completion data available.</Text>
              )}
            </View>

            <View style={[styles.panel, lightPanel, highContrastPanel]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, lightPrimary]}>Urgency Load</Text>
                <Text style={[styles.panelMeta, lightSecondary]}>{summary.urgentOpen} urgent open</Text>
              </View>
              <HorizontalBars data={needsByUrgency} isLight={isLight} />
            </View>

            <View style={[styles.panel, lightPanel, highContrastPanel]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, lightPrimary]}>New Needs This Week</Text>
                <Text style={[styles.panelMeta, lightSecondary]}>Last 7 days</Text>
              </View>
              <MiniTrend data={lastSevenDays} isLight={isLight} />
            </View>

            <View style={[styles.panel, lightPanel, highContrastPanel]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, lightPrimary]}>Category Distribution</Text>
                <Text style={[styles.panelMeta, lightSecondary]}>Top categories</Text>
              </View>
              {needsByCategory.length > 0 ? (
                <View style={styles.chartSplit}>
                  <Donut gradient={categoryGradient} center={String(summary.total)} label="Needs" />
                  <View style={styles.legendCol}>
                    {needsByCategory.map((item) => <LegendItem key={item.label} item={item} total={summary.total} isLight={isLight} />)}
                  </View>
                </View>
              ) : (
                <Text style={[styles.empty, lightSecondary]}>No category data available.</Text>
              )}
            </View>

            <View style={[styles.panel, lightPanel, highContrastPanel]}>
              <View style={styles.panelHeader}>
                <Text style={[styles.panelTitle, lightPrimary]}>{isOwner ? "Top Organization Areas" : "Top Branch Areas"}</Text>
                <Text style={[styles.panelMeta, lightSecondary]}>Need concentration</Text>
              </View>
              {areaBreakdown.length > 0 ? (
                <View style={styles.areaList}>
                  {areaBreakdown.map((area) => (
                    <AreaRow key={`${area.city}-${area.area}`} area={area} max={areaBreakdown[0]?.total ?? 1} isLight={isLight} />
                  ))}
                </View>
              ) : (
                <Text style={[styles.empty, lightSecondary]}>No area data available.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const ScopeBadge = ({ label, isLight }: { label: string; isLight: boolean }) => (
  <View style={[styles.scopeBadge, isLight ? { backgroundColor: "#EFF6FF", borderColor: "#000000" } : null]}>
    <Text style={[styles.scopeBadgeText, isLight ? { color: "#0B1220" } : null]}>{label}</Text>
  </View>
);

const Kpi = ({ label, value, accent, isLight }: { label: string; value: number | string; accent: string; isLight: boolean }) => (
  <View style={[styles.kpiCard, isLight ? { borderColor: "#000000", borderWidth: 2, backgroundColor: "#FFFFFF" } : null]}>
    <View style={[styles.kpiAccent, { backgroundColor: accent }]} />
    <Text style={[styles.kpiValue, isLight ? { color: "#0B1220", fontWeight: "900" } : null]}>{value}</Text>
    <Text style={[styles.kpiLabel, isLight ? { color: "#111827", fontWeight: "800" } : null]}>{label}</Text>
  </View>
);

const InsightPanel = ({ label, value, detail, color, isLight }: { label: string; value: number | string; detail: string; color: string; isLight: boolean }) => (
  <View style={[styles.insightPanel, isLight ? { backgroundColor: "#FFFFFF", borderColor: "#000000", borderWidth: 2 } : null]}>
    <View style={[styles.insightIcon, { backgroundColor: color }]} />
    <View style={styles.insightTextWrap}>
      <Text style={[styles.insightValue, isLight ? { color: "#0B1220" } : null]}>{value}</Text>
      <Text style={[styles.insightLabel, isLight ? { color: "#111827" } : null]}>{label}</Text>
      <Text style={[styles.insightDetail, isLight ? { color: "#374151" } : null]}>{detail}</Text>
    </View>
  </View>
);

const Donut = ({ gradient, center, label }: { gradient: string; center: string; label: string }) => (
  <View style={styles.donutWrap}>
    {Platform.OS === "web" ? (
      <View style={[styles.donutCircle, { backgroundImage: gradient } as any]}>
        <View style={styles.donutHole}>
          <Text style={styles.donutCenter}>{center}</Text>
          <Text style={styles.donutLabel}>{label}</Text>
        </View>
      </View>
    ) : (
      <View style={styles.donutFallback}>
        <Text style={styles.donutCenter}>{center}</Text>
        <Text style={styles.donutLabel}>{label}</Text>
      </View>
    )}
  </View>
);

const LegendItem = ({ item, total, isLight }: { item: DistItem; total: number; isLight: boolean }) => {
  const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
      <Text style={[styles.legendText, isLight ? { color: "#111827", fontWeight: "800" } : null]}>{item.label}</Text>
      <Text style={[styles.legendValue, isLight ? { color: "#0B1220", fontWeight: "900" } : null]}>{item.value} ({percent}%)</Text>
    </View>
  );
};

const HorizontalBars = ({ data, isLight }: { data: DistItem[]; isLight: boolean }) => {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <View style={styles.hBarList}>
      {data.map((item) => {
        const width = Math.round((item.value / max) * 100);
        return (
          <View key={item.label} style={styles.hBarRow}>
            <Text style={[styles.hBarLabel, isLight ? { color: "#0B1220", fontWeight: "800" } : null]}>{formatLabel(item.label)}</Text>
            <View style={[styles.hTrack, isLight ? { backgroundColor: "#E5E7EB", borderColor: "#000000", borderWidth: 1 } : null]}>
              <View style={[styles.hFill, { width: `${Math.max(item.value > 0 ? 5 : 0, width)}%`, backgroundColor: item.color }]} />
            </View>
            <Text style={[styles.hValue, isLight ? { color: "#0B1220", fontWeight: "900" } : null]}>{item.value}</Text>
          </View>
        );
      })}
    </View>
  );
};

const MiniTrend = ({ data, isLight }: { data: TrendItem[]; isLight: boolean }) => {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <View style={styles.trendWrap}>
      {data.map((item) => {
        const height = item.value > 0 ? 18 + Math.round((item.value / max) * 82) : 4;
        return (
          <View key={item.label} style={styles.trendItem}>
            <View style={[styles.trendBarTrack, isLight ? { backgroundColor: "#EEF2FF" } : null]}>
              <View style={[styles.trendBar, { height }]} />
            </View>
            <Text style={[styles.trendValue, isLight ? { color: "#0B1220" } : null]}>{item.value}</Text>
            <Text style={[styles.trendLabel, isLight ? { color: "#374151" } : null]}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
};

const AreaRow = ({ area, max, isLight }: { area: AreaItem; max: number; isLight: boolean }) => {
  const percent = Math.round((area.total / Math.max(max, 1)) * 100);
  return (
    <View style={[styles.areaRow, isLight ? { backgroundColor: "#F8FAFC", borderColor: "#000000" } : null]}>
      <View style={styles.areaTopLine}>
        <View style={styles.areaNameWrap}>
          <Text style={[styles.areaName, isLight ? { color: "#0B1220" } : null]} numberOfLines={1}>{area.area}</Text>
          <Text style={[styles.areaCity, isLight ? { color: "#374151" } : null]} numberOfLines={1}>{area.city}</Text>
        </View>
        <Text style={[styles.areaTotal, isLight ? { color: "#0B1220" } : null]}>{area.total}</Text>
      </View>
      <View style={[styles.areaTrack, isLight ? { backgroundColor: "#E5E7EB" } : null]}>
        <View style={[styles.areaFill, { width: `${Math.max(6, percent)}%` }]} />
      </View>
      <View style={styles.areaMetaRow}>
        <Text style={[styles.areaMeta, isLight ? { color: "#374151" } : null]}>Open {area.active}</Text>
        <Text style={[styles.areaMeta, isLight ? { color: "#374151" } : null]}>Urgent {area.urgent}</Text>
        <Text style={[styles.areaMeta, isLight ? { color: "#374151" } : null]}>Done {area.completed}</Text>
      </View>
    </View>
  );
};

const BranchCompletionRow = ({ branch, isLight }: { branch: BranchCompletionItem; isLight: boolean }) => (
  <View style={[styles.branchRow, isLight ? { backgroundColor: "#F8FAFC", borderColor: "#000000" } : null]}>
    <View style={styles.branchTopLine}>
      <View style={styles.branchNameWrap}>
        <Text style={[styles.branchName, isLight ? { color: "#0B1220" } : null]} numberOfLines={1}>{branch.name}</Text>
        <Text style={[styles.branchLocation, isLight ? { color: "#374151" } : null]} numberOfLines={1}>{branch.location}</Text>
      </View>
      <View style={styles.branchRatePill}>
        <Text style={styles.branchRateText}>{branch.completionRate}% done</Text>
      </View>
    </View>
    <View style={[styles.branchProgressTrack, isLight ? { backgroundColor: "#E5E7EB" } : null]}>
      <View style={[styles.branchProgressFill, { width: `${Math.max(branch.completionRate > 0 ? 6 : 0, branch.completionRate)}%` }]} />
    </View>
    <View style={styles.branchStatsRow}>
      <Text style={[styles.branchStat, isLight ? { color: "#374151" } : null]}>All {branch.total}</Text>
      <Text style={[styles.branchStat, isLight ? { color: "#374151" } : null]}>Open {branch.active}</Text>
      <Text style={[styles.branchStat, isLight ? { color: "#374151" } : null]}>Progress {branch.inProgress}</Text>
      <Text style={[styles.branchStatDone, isLight ? { color: "#166534" } : null]}>Completed {branch.completed}</Text>
      <Text style={[styles.branchStatUrgent, isLight ? { color: "#991B1B" } : null]}>Urgent {branch.urgent}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { color: "#FFFFFF", fontSize: 26, fontWeight: "900" },
  subtitle: { color: "#B8B8D0", marginTop: 6, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  scopeBadge: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(59,130,246,0.16)", paddingHorizontal: 10, paddingVertical: 7 },
  scopeBadgeText: { color: "#BFDBFE", fontSize: 11, fontWeight: "900" },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { width: "48%", minHeight: 92, backgroundColor: "rgba(15,23,42,0.52)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 12, overflow: "hidden" },
  kpiAccent: { width: 34, height: 4, borderRadius: 999, marginBottom: 12 },
  kpiValue: { color: "#FFFFFF", fontSize: 23, fontWeight: "900" },
  kpiLabel: { color: "#B8B8D0", marginTop: 4, fontSize: 12, fontWeight: "800" },
  insightGrid: { flexDirection: "row", gap: 10, marginTop: 12 },
  insightPanel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 12 },
  insightIcon: { width: 10, alignSelf: "stretch", borderRadius: 999 },
  insightTextWrap: { flex: 1, minWidth: 0 },
  insightValue: { color: "#FFFFFF", fontSize: 19, fontWeight: "900" },
  insightLabel: { color: "#D8D9E3", fontSize: 12, fontWeight: "900", marginTop: 2 },
  insightDetail: { color: "#8B8DA3", fontSize: 10, fontWeight: "700", marginTop: 3 },
  panel: { marginTop: 12, backgroundColor: "rgba(15,23,42,0.52)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 14 },
  highContrastPanel: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000" },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  panelTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  panelMeta: { color: "#B8B8D0", fontSize: 11, fontWeight: "800" },
  chartSplit: { flexDirection: "row", alignItems: "center", gap: 16 },
  donutWrap: { alignItems: "center", justifyContent: "center" },
  donutCircle: { width: 146, height: 146, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  donutHole: { width: 92, height: 92, borderRadius: 999, backgroundColor: "#10172A", alignItems: "center", justifyContent: "center" },
  donutFallback: { width: 146, height: 146, borderRadius: 999, borderWidth: 14, borderColor: "#3B82F6", alignItems: "center", justifyContent: "center" },
  donutCenter: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  donutLabel: { color: "#B8B8D0", fontSize: 10, fontWeight: "900", marginTop: 2, textTransform: "uppercase" },
  legendCol: { flex: 1, gap: 8, minWidth: 0 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 999 },
  legendText: { color: "#D8D9E3", fontSize: 12, textTransform: "capitalize", flex: 1, fontWeight: "800" },
  legendValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  hBarList: { gap: 11 },
  hBarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  hBarLabel: { color: "#D8D9E3", width: 86, fontSize: 12, textTransform: "capitalize", fontWeight: "800" },
  hTrack: { flex: 1, height: 12, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  hFill: { height: "100%", borderRadius: 999 },
  hValue: { color: "#FFFFFF", minWidth: 28, textAlign: "right", fontWeight: "900", fontSize: 12 },
  trendWrap: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, minHeight: 140 },
  trendItem: { flex: 1, alignItems: "center", gap: 5 },
  trendBarTrack: { width: "100%", height: 104, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "flex-end", overflow: "hidden" },
  trendBar: { width: "100%", borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: "#667EEA" },
  trendValue: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  trendLabel: { color: "#B8B8D0", fontSize: 10, fontWeight: "800" },
  areaList: { gap: 10 },
  areaRow: { backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 8, padding: 11 },
  areaTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  areaNameWrap: { flex: 1, minWidth: 0 },
  areaName: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  areaCity: { color: "#B8B8D0", fontSize: 10, fontWeight: "800", marginTop: 2 },
  areaTotal: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  areaTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, overflow: "hidden", marginTop: 9 },
  areaFill: { height: "100%", backgroundColor: "#14B8A6", borderRadius: 999 },
  areaMetaRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  areaMeta: { color: "#B8B8D0", fontSize: 10, fontWeight: "800" },
  branchCompletionList: { gap: 10 },
  branchRow: { backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 8, padding: 11 },
  branchTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  branchNameWrap: { flex: 1, minWidth: 0 },
  branchName: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  branchLocation: { color: "#B8B8D0", fontSize: 10, fontWeight: "800", marginTop: 2 },
  branchRatePill: { borderRadius: 999, backgroundColor: "rgba(34,197,94,0.14)", borderWidth: 1, borderColor: "rgba(34,197,94,0.32)", paddingHorizontal: 9, paddingVertical: 5 },
  branchRateText: { color: "#86EFAC", fontSize: 10, fontWeight: "900" },
  branchProgressTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 999, overflow: "hidden", marginTop: 10 },
  branchProgressFill: { height: "100%", backgroundColor: "#22C55E", borderRadius: 999 },
  branchStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  branchStat: { color: "#B8B8D0", fontSize: 10, fontWeight: "800" },
  branchStatDone: { color: "#86EFAC", fontSize: 10, fontWeight: "900" },
  branchStatUrgent: { color: "#FCA5A5", fontSize: 10, fontWeight: "900" },
  emptyPanel: { backgroundColor: "rgba(15,23,42,0.52)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 16 },
  emptyTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", marginBottom: 6 },
  empty: { color: "#B8B8D0", fontSize: 13, fontWeight: "700", lineHeight: 19 },
});
