import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useRealtime } from "../../context/RealtimeContext";
import { moduleApi } from "../../services/api";
import type { Assignment, Organization } from "../../types/api";
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
  const { assignmentsVersion } = useRealtime();
  const { reduceMotion } = useAccessibility();
  const scopedOrganizationId = user?.role === "admin" ? user?.managed_branch_id ?? user?.organization_id : user?.organization_id;
  const [items, setItems] = useState<Assignment[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedbackAssignment, setFeedbackAssignment] = useState<Assignment | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [volunteerRatingAssignment, setVolunteerRatingAssignment] = useState<Assignment | null>(null);
  const [volunteerRating, setVolunteerRating] = useState(0);

  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setRefreshing(true);
    try {
      const [data, organizationData] = await Promise.all([
        moduleApi.assignments(
        baseUrl,
        token,
        scopedOrganizationId ? { organization_id: scopedOrganizationId } : undefined,
        ),
        moduleApi.organizations(baseUrl, token),
      ]);
      setItems(data);
      setOrganizations(organizationData);
    } catch {
      setItems([]);
      setOrganizations([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [assignmentsVersion, baseUrl, token, scopedOrganizationId]);

  useEffect(() => {
    if (reduceMotion) {
      floatA.setValue(0);
      floatB.setValue(0);
      return;
    }

    const animations = [
      Animated.loop(Animated.sequence([
        Animated.timing(floatA, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(floatA, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 3300, useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 3300, useNativeDriver: true }),
      ])),
    ];

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [floatA, floatB, reduceMotion]);

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

  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));

  const openFeedback = async (assignment: Assignment) => {
    setFeedbackAssignment(assignment);
    setFeedbackText(assignment.feedback ?? "");
    setFeedbackRating(assignment.rating ? Math.round(assignment.rating) : 0);

    if (!organizationById.has(assignment.organization_id)) {
      try {
        const organization = await moduleApi.getOrganization(baseUrl, token, assignment.organization_id);
        setOrganizations((current) => [...current.filter((item) => item.id !== organization.id), organization]);
      } catch {
      }
    }
  };

  const closeFeedback = () => {
    setFeedbackAssignment(null);
    setFeedbackText("");
    setFeedbackRating(0);
  };

  const submitFeedback = async () => {
    if (!feedbackAssignment) return;
    if (feedbackRating < 1) {
      Alert.alert("Feedback", "Please select a rating from 1 to 5 stars.");
      return;
    }

    setBusyId(feedbackAssignment.id);
    try {
      await moduleApi.submitAssignmentFeedback(baseUrl, token, feedbackAssignment.id, {
        feedback: feedbackText.trim() || undefined,
        rating: feedbackRating,
      });
      closeFeedback();
      await load();
    } catch (err) {
      Alert.alert("Assignment", err instanceof Error ? err.message : "Unable to submit feedback");
    } finally {
      setBusyId(null);
    }
  };

  const openVolunteerRating = (assignment: Assignment) => {
    setVolunteerRatingAssignment(assignment);
    setVolunteerRating(0);
  };

  const closeVolunteerRating = () => {
    setVolunteerRatingAssignment(null);
    setVolunteerRating(0);
  };

  const submitVolunteerRating = async () => {
    if (!volunteerRatingAssignment) return;
    if (volunteerRating < 1) {
      Alert.alert("Volunteer Rating", "Please select a rating from 1 to 5 stars.");
      return;
    }

    setBusyId(volunteerRatingAssignment.id);
    try {
      await moduleApi.updateVolunteer(baseUrl, token, volunteerRatingAssignment.volunteer_id, { rating: volunteerRating });
      closeVolunteerRating();
      await load();
    } catch (err) {
      Alert.alert("Volunteer Rating", err instanceof Error ? err.message : "Unable to update volunteer rating");
    } finally {
      setBusyId(null);
    }
  };

  const feedbackOrganization = feedbackAssignment ? organizationById.get(feedbackAssignment.organization_id) : null;

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

            {a.status === "completed" && a.rating ? (
              <View style={styles.savedFeedbackBox}>
                <Text style={styles.savedFeedbackRating}>{"★".repeat(Math.round(a.rating))}{"☆".repeat(5 - Math.round(a.rating))} {a.rating}/5</Text>
                {a.feedback ? <Text style={styles.savedFeedbackText}>{a.feedback}</Text> : null}
              </View>
            ) : null}

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
              {a.status === "completed" && user?.role === "volunteer" ? (
                <Pressable
                  style={[styles.feedbackBtn, busyId === a.id && styles.disabledBtn]}
                  disabled={busyId === a.id}
                  onPress={() => openFeedback(a)}
                >
                  <Text style={styles.feedbackText}>{a.rating ? "Edit Feedback" : "Submit Feedback"}</Text>
                </Pressable>
              ) : null}
              {a.status === "completed" && user?.role !== "volunteer" ? (
                <Pressable
                  style={[styles.feedbackBtn, busyId === a.id && styles.disabledBtn]}
                  disabled={busyId === a.id}
                  onPress={() => openVolunteerRating(a)}
                >
                  <Text style={styles.feedbackText}>Rate Volunteer</Text>
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

      <Modal visible={Boolean(feedbackAssignment)} transparent animationType="fade" onRequestClose={closeFeedback}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>Submit Feedback</Text>
                <Text style={styles.modalSubtitle}>Assignment #{feedbackAssignment?.id ?? "-"}</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={closeFeedback}>
                <Text style={styles.modalCloseText}>X</Text>
              </Pressable>
            </View>

            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Organization Branch</Text>
              <Text style={styles.detailValue}>{feedbackOrganization?.organization_name ?? `Branch #${feedbackAssignment?.organization_id ?? "-"}`}</Text>
              <Text style={styles.detailMeta}>{feedbackOrganization?.address || "Branch address not available"}</Text>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailTile}>
                <Text style={styles.detailLabel}>Branch Admin</Text>
                <Text style={styles.detailValue} numberOfLines={1}>{feedbackOrganization?.branch_admin_name || "Not assigned"}</Text>
              </View>
              <View style={styles.detailTile}>
                <Text style={styles.detailLabel}>Need</Text>
                <Text style={styles.detailValue}>#{feedbackAssignment?.need_id ?? "-"}</Text>
              </View>
            </View>

            <Text style={styles.ratingLabel}>Rating</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} style={styles.starBtn} onPress={() => setFeedbackRating(star)}>
                  <Text style={[styles.starText, feedbackRating >= star && styles.starTextActive]}>★</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.feedbackInput}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Write feedback for this organization branch"
              placeholderTextColor="#7F9AAA"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeFeedback} disabled={busyId === feedbackAssignment?.id}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitFeedbackBtn, busyId === feedbackAssignment?.id && styles.disabledBtn]}
                onPress={submitFeedback}
                disabled={busyId === feedbackAssignment?.id}
              >
                <Text style={styles.submitFeedbackText}>{busyId === feedbackAssignment?.id ? "Saving..." : "Submit Feedback"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(volunteerRatingAssignment)} transparent animationType="fade" onRequestClose={closeVolunteerRating}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>Rate Volunteer</Text>
                <Text style={styles.modalSubtitle}>Assignment #{volunteerRatingAssignment?.id ?? "-"}</Text>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={closeVolunteerRating}>
                <Text style={styles.modalCloseText}>X</Text>
              </Pressable>
            </View>

            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>Volunteer ID</Text>
              <Text style={styles.detailValue}>#{volunteerRatingAssignment?.volunteer_id ?? "-"}</Text>
              <Text style={styles.detailMeta}>This updates the volunteer rating shown on their Home screen.</Text>
            </View>

            <Text style={styles.ratingLabel}>Volunteer Rating</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setVolunteerRating(star)} style={styles.starBtn}>
                  <Text style={[styles.starText, star <= volunteerRating && styles.starTextActive]}>{star <= volunteerRating ? "★" : "☆"}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeVolunteerRating}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitFeedbackBtn, busyId === volunteerRatingAssignment?.id && styles.disabledBtn]}
                disabled={busyId === volunteerRatingAssignment?.id}
                onPress={submitVolunteerRating}
              >
                <Text style={styles.submitFeedbackText}>Save Rating</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  savedFeedbackBox: {
    backgroundColor: "rgba(59,203,146,0.1)",
    borderColor: "rgba(59,203,146,0.28)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 9,
  },
  savedFeedbackRating: { color: colors.warning, fontSize: 13, fontWeight: "900" },
  savedFeedbackText: { color: colors.textStrong, fontSize: 12, fontWeight: "700", lineHeight: 17, marginTop: 4 },

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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#0B1A24",
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  modalTitleWrap: { flex: 1, minWidth: 0 },
  modalTitle: { color: colors.textStrong, fontSize: 19, fontWeight: "900" },
  modalSubtitle: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: { color: colors.textStrong, fontSize: 13, fontWeight: "900" },
  detailBox: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  detailGrid: { flexDirection: "row", gap: 10, marginBottom: 12 },
  detailTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 11,
  },
  detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase", marginBottom: 5 },
  detailValue: { color: colors.textStrong, fontSize: 14, fontWeight: "900" },
  detailMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", lineHeight: 17, marginTop: 4 },
  ratingLabel: { color: colors.textStrong, fontSize: 13, fontWeight: "900", marginBottom: 7 },
  starRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  starBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  starText: { color: "#48616E", fontSize: 25, fontWeight: "900", lineHeight: 28 },
  starTextActive: { color: colors.warning },
  feedbackInput: {
    minHeight: 110,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: colors.card,
    color: colors.textStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "700",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 14 },
  cancelBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.cardSoft,
  },
  cancelText: { color: colors.muted, fontSize: 13, fontWeight: "900" },
  submitFeedbackBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  submitFeedbackText: { color: colors.textStrong, fontSize: 13, fontWeight: "900" },
});


