import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { moduleApi } from "../../services/api";
import type { Assignment } from "../../types/api";
import { colors } from "../../theme";

const NEXT_TRANSITIONS: Record<Assignment["status"], Assignment["status"][]> = {
  proposed: ["accepted", "declined", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  declined: ["cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["cancelled"],
  cancelled: [],
};

export const AssignmentsScreen = () => {
  const { baseUrl, token, user } = useAuth();
  const scopedOrganizationId = user?.role === "admin" ? user?.managed_branch_id ?? user?.organization_id : user?.organization_id;
  const [items, setItems] = useState<Assignment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await moduleApi.assignments(
        baseUrl,
        token,
        scopedOrganizationId ? { organization_id: scopedOrganizationId } : undefined,
      );
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [baseUrl, token, scopedOrganizationId]);

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

  const statusColor = (status: Assignment["status"]) => {
    if (status === "completed") return colors.success;
    if (status === "in_progress") return "#047857";
    if (status === "accepted") return "#2563EB";
    if (status === "declined") return "#6B7280";
    if (status === "cancelled") return colors.danger;
    return "#CA8A04";
  };

  const updateStatus = async (assignmentId: number, nextStatus: Assignment["status"]) => {
    setBusyId(assignmentId);
    try {
      await moduleApi.updateAssignmentStatus(baseUrl, token, assignmentId, nextStatus);
      await load();
    } catch (err) {
      Alert.alert("Assignment", err instanceof Error ? err.message : "Unable to update status");
    } finally {
      setBusyId(null);
    }
  };

  const addFeedback = async (assignmentId: number) => {
    setBusyId(assignmentId);
    try {
      await moduleApi.submitAssignmentFeedback(baseUrl, token, assignmentId, {
        feedback: "Frontend feedback submission completed.",
        rating: 4.5,
      });
      await load();
    } catch (err) {
      Alert.alert("Assignment", err instanceof Error ? err.message : "Unable to submit feedback");
    } finally {
      setBusyId(null);
    }
  };

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
        <Text style={styles.title}>Assignments</Text>
        <Text style={styles.subtitle}>Lifecycle actions, status transitions, and feedback</Text>

        {items.map((a) => (
          <View key={a.id} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.cardTitle}>Assignment #{a.id}</Text>
              <View style={[styles.statusBadge, { borderColor: statusColor(a.status), backgroundColor: `${statusColor(a.status)}22` }]}>
                <Text style={[styles.statusText, { color: statusColor(a.status) }]}>{a.status}</Text>
              </View>
            </View>

            <Text style={styles.meta}><Text style={styles.metaStrong}>Need ID:</Text> {a.need_id}</Text>
            <Text style={styles.meta}><Text style={styles.metaStrong}>Volunteer ID:</Text> {a.volunteer_id}</Text>
            <Text style={styles.meta}><Text style={styles.metaStrong}>Org ID:</Text> {a.organization_id}</Text>
            <Text style={styles.meta}><Text style={styles.metaStrong}>Match Score:</Text> {a.match_score ?? "-"}</Text>

            <View style={styles.actionsWrap}>
              {NEXT_TRANSITIONS[a.status].map((next) => (
                <Pressable
                  key={next}
                  style={[styles.actionBtn, busyId === a.id && styles.disabledBtn]}
                  disabled={busyId === a.id}
                  onPress={() => updateStatus(a.id, next)}
                >
                  <Text style={styles.actionText}>{next}</Text>
                </Pressable>
              ))}
              {a.status === "completed" ? (
                <Pressable
                  style={[styles.feedbackBtn, busyId === a.id && styles.disabledBtn]}
                  disabled={busyId === a.id}
                  onPress={() => addFeedback(a.id)}
                >
                  <Text style={styles.feedbackText}>Submit Feedback</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}

        {items.length === 0 && !refreshing ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No assignments available</Text>
            <Text style={styles.emptyMeta}>Create assignments from backend/admin panel first.</Text>
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 },
  cardTitle: { color: colors.textStrong, fontSize: 16, fontWeight: "900" },
  statusBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },

  meta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  metaStrong: { color: colors.textStrong, fontWeight: "800" },

  actionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  actionBtn: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionText: { color: colors.muted, fontWeight: "800", fontSize: 12, textTransform: "capitalize" },

  feedbackBtn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  feedbackText: { color: colors.textStrong, fontWeight: "800", fontSize: 12 },
  disabledBtn: { opacity: 0.55 },

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


