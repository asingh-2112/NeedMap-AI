import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import { moduleApi } from "../../services/api";
import type { RootStackParamList } from "../../navigation/types";
import type { Assignment, Need, Volunteer } from "../../types/api";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = any;

export const NeedDetailScreen = () => {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { baseUrl, token, user } = useAuth();
  const { needId } = route.params || {};

  const [need, setNeed] = useState<Need | null>(null);
  const [needAssignments, setNeedAssignments] = useState<Assignment[]>([]);
  const [assignedVolunteers, setAssignedVolunteers] = useState<Map<number, Volunteer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [deletingNeed, setDeletingNeed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeIn]);

  useEffect(() => {
    const fetchNeed = async () => {
      if (!needId || !token) {
        setError("Invalid need ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [data, assignments, volunteers] = await Promise.all([
          moduleApi.needs(baseUrl, token),
          moduleApi.assignments(baseUrl, token, { need_id: needId }),
          moduleApi.volunteers(baseUrl, token),
        ]);
        const foundNeed = data.find((n: Need) => n.id === needId);
        if (foundNeed) {
          const assignedVolunteerIds = new Set(assignments.map((assignment) => assignment.volunteer_id));
          const volunteerById = new Map<number, Volunteer>();
          volunteers.forEach((volunteer) => {
            if (assignedVolunteerIds.has(volunteer.id)) {
              volunteerById.set(volunteer.id, volunteer);
            }
          });
          setNeed(foundNeed);
          setNeedAssignments(assignments);
          setAssignedVolunteers(volunteerById);
        } else {
          setError("Need not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load need details");
      } finally {
        setLoading(false);
      }
    };

    fetchNeed();
  }, [needId, token, baseUrl]);

  const sortedAssignments = [...needAssignments].sort(
    (a, b) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime(),
  );
  const activeAssignments = sortedAssignments.filter((a) => ["in_progress", "accepted", "assigned", "proposed"].includes(a.status));
  const completedAssignments = sortedAssignments.filter((a) => a.status === "completed");
  const assignedVolunteerAssignments = sortedAssignments.filter((a) => !["declined", "cancelled"].includes(a.status));

  const assignmentStatusColor = (status: Assignment["status"]) => {
    switch (status) {
      case "in_progress": return "#FFA502";
      case "accepted": return "#43E97B";
      case "completed": return "#2ED573";
      case "declined":
      case "cancelled": return "#FF6B6B";
      default: return "#667EEA";
    }
  };

  const confirmDeleteNeed = () => {
    if (!need) return;

    const performDelete = async () => {
      try {
        setDeletingNeed(true);
        await moduleApi.closeNeed(baseUrl, token, need.id);
        Alert.alert("Success", "Need deleted successfully.");
        nav.goBack();
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete need.");
      } finally {
        setDeletingNeed(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to delete this need?");
      if (confirmed) {
        void performDelete();
      }
      return;
    }

    Alert.alert(
      "Delete Need",
      "Are you sure you want to delete this need?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: () => { void performDelete(); },
        },
      ],
    );
  };

  const urgencyColor = (u: string) => {
    switch (u.toLowerCase()) {
      case "critical": return "#FF4757";
      case "high": return "#FF6B6B";
      case "medium": return "#FFA502";
      case "low": return "#2ED573";
      default: return "#667EEA";
    }
  };

  const statusColor = (s: string) => {
    switch (s.toLowerCase()) {
      case "new":
      case "verified": return "#667EEA";
      case "assigned":
      case "in_progress": return "#FFA502";
      case "resolved":
      case "closed": return "#2ED573";
      default: return "#8B8DA3";
    }
  };

  const goBack = () => {
    nav.goBack();
  };

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={["#0F0C29", "#302B63", "#24243E"]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header with Back Button */}
      <View style={styles.header}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Need Details</Text>
        <View style={{ width: 50 }} />
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeIn }}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#667EEA" />
            <Text style={styles.loadingText}>Loading need details...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={goBack}>
              <Text style={styles.retryBtnText}>Go Back</Text>
            </Pressable>
          </View>
        ) : need ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Need Title Card */}
            <View style={styles.titleCard}>
              <View style={styles.titleRow}>
                <Text style={styles.needTitle} numberOfLines={2}>{need.title}</Text>
                <View style={[styles.urgencyBadge, { backgroundColor: `${urgencyColor(need.urgency)}20`, borderColor: urgencyColor(need.urgency) }]}>
                  <Text style={[styles.urgencyText, { color: urgencyColor(need.urgency) }]}>
                    {need.urgency.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Status Card */}
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Status</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor(need.status)}20`, borderColor: statusColor(need.status) }]}>
                <Text style={[styles.statusText, { color: statusColor(need.status) }]}>
                  {need.status.replace("_", " ").toUpperCase()}
                </Text>
              </View>

              {(user?.role === "owner" || user?.role === "admin") && !(["closed", "resolved"].includes(need.status)) ? (
                <Pressable
                  style={[styles.closeNeedBtn, deletingNeed && styles.closeNeedBtnDisabled]}
                  onPress={confirmDeleteNeed}
                  disabled={deletingNeed}
                >
                  <Text style={styles.closeNeedBtnText}>{deletingNeed ? "Deleting..." : "Delete Need"}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Assignment Details */}
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Assignment Details</Text>
              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Active Assigned Volunteers:</Text>
                <Text style={styles.refValue}>{activeAssignments.length}</Text>
              </View>

              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Completed Assignments:</Text>
                <Text style={styles.refValue}>{completedAssignments.length}</Text>
              </View>

              <View style={styles.refRow}>
                <Text style={styles.refLabel}>Total Assignment Records:</Text>
                <Text style={styles.refValue}>{needAssignments.length}</Text>
              </View>
            </View>

            {/* Assigned Volunteers */}
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Assigned Volunteers</Text>

              {assignedVolunteerAssignments.length > 0 ? (
                <View style={styles.volunteerList}>
                  {assignedVolunteerAssignments.map((assignment) => {
                    const volunteer = assignedVolunteers.get(assignment.volunteer_id);
                    const volunteerName = volunteer?.user_name || `Volunteer #${assignment.volunteer_id}`;
                    const volunteerLocation = [volunteer?.colony, volunteer?.city].filter(Boolean).join(", ");
                    return (
                      <View key={assignment.id} style={styles.volunteerCard}>
                        <View style={styles.volunteerHeader}>
                          <View style={styles.volunteerTitleWrap}>
                            <Text style={styles.volunteerName}>{volunteerName}</Text>
                            <Text style={styles.volunteerSubline}>Volunteer ID #{assignment.volunteer_id}</Text>
                          </View>
                          <View style={[styles.assignmentStatusBadge, { borderColor: assignmentStatusColor(assignment.status), backgroundColor: `${assignmentStatusColor(assignment.status)}20` }]}>
                            <Text style={[styles.assignmentStatusText, { color: assignmentStatusColor(assignment.status) }]}>{assignment.status.replace("_", " ")}</Text>
                          </View>
                        </View>

                        <View style={styles.volunteerDetailGrid}>
                          <View style={styles.volunteerDetailItem}>
                            <Text style={styles.volunteerDetailLabel}>Phone</Text>
                            <Text style={styles.volunteerDetailValue}>{volunteer?.phone || "Not available"}</Text>
                          </View>
                          <View style={styles.volunteerDetailItem}>
                            <Text style={styles.volunteerDetailLabel}>Email</Text>
                            <Text style={styles.volunteerDetailValue}>{volunteer?.email || "Not available"}</Text>
                          </View>
                          <View style={styles.volunteerDetailItem}>
                            <Text style={styles.volunteerDetailLabel}>Location</Text>
                            <Text style={styles.volunteerDetailValue}>{volunteerLocation || "Not available"}</Text>
                          </View>
                          <View style={styles.volunteerDetailItem}>
                            <Text style={styles.volunteerDetailLabel}>Availability</Text>
                            <Text style={styles.volunteerDetailValue}>{volunteer ? (volunteer.availability ? "Available" : "Busy") : "Not available"}</Text>
                          </View>
                          <View style={styles.volunteerDetailItem}>
                            <Text style={styles.volunteerDetailLabel}>Tasks</Text>
                            <Text style={styles.volunteerDetailValue}>{volunteer ? `${volunteer.tasks_completed} completed · ${volunteer.active_tasks} active` : "Not available"}</Text>
                          </View>
                          <View style={styles.volunteerDetailItem}>
                            <Text style={styles.volunteerDetailLabel}>Verified</Text>
                            <Text style={styles.volunteerDetailValue}>{volunteer ? (volunteer.verified ? "Yes" : "No") : "Not available"}</Text>
                          </View>
                        </View>

                        <View style={styles.assignmentMetaRow}>
                          <Text style={styles.assignmentMetaText}>Assigned: {new Date(assignment.assigned_at).toLocaleString()}</Text>
                          {assignment.match_score != null ? <Text style={styles.assignmentMetaText}>Match: {assignment.match_score.toFixed(2)}</Text> : null}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyAssignmentText}>No volunteers assigned yet.</Text>
              )}
            </View>

            {/* Description */}
            {need.description ? (
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Description</Text>
                <Text style={styles.descriptionText}>{need.description}</Text>
              </View>
            ) : null}

            {/* Category */}
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Category</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoValue}>{need.category.replace("_", " ")}</Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Location</Text>
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>Address:</Text>
                <Text style={styles.locationValue}>{need.address}</Text>
              </View>
              {need.latitude && need.longitude ? (
                <View style={styles.coordInfo}>
                  <Text style={styles.coordText}>📍 {need.latitude.toFixed(4)}, {need.longitude.toFixed(4)}</Text>
                </View>
              ) : null}
            </View>

            {/* Priority Score */}
            {need.priority_score != null ? (
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Priority Score</Text>
                <View style={styles.scoreContainer}>
                  <View style={styles.scoreBar}>
                    <View
                      style={[
                        styles.scoreBarFill,
                        { width: `${Math.min(need.priority_score * 100, 100)}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.scoreValue}>{need.priority_score.toFixed(2)} / 1.0</Text>
                </View>
              </View>
            ) : null}

            {/* Created Date */}
            {need.created_at ? (
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Created</Text>
                <Text style={styles.dateText}>
                  {new Date(need.created_at).toLocaleDateString()} {new Date(need.created_at).toLocaleTimeString()}
                </Text>
              </View>
            ) : null}

            {/* Updated Date */}
            {need.updated_at ? (
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Last Updated</Text>
                <Text style={styles.dateText}>
                  {new Date(need.updated_at).toLocaleDateString()} {new Date(need.updated_at).toLocaleTimeString()}
                </Text>
              </View>
            ) : null}

            {/* Meta Information */}
            {(need.id || need.organization_id) ? (
              <View style={styles.infoCard}>
                <Text style={styles.cardTitle}>Reference</Text>
                {need.id ? (
                  <View style={styles.refRow}>
                    <Text style={styles.refLabel}>Need ID:</Text>
                    <Text style={styles.refValue}>#{need.id}</Text>
                  </View>
                ) : null}
                {need.organization_id ? (
                  <View style={styles.refRow}>
                    <Text style={styles.refLabel}>Organization ID:</Text>
                    <Text style={styles.refValue}>#{need.organization_id}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        ) : null}
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

  // Title Card
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
  needTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 28,
  },
  urgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
    alignItems: "center",
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Info Cards
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

  // Status Badge
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  closeNeedBtn: {
    marginTop: 12,
    backgroundColor: "rgba(255,75,75,0.16)",
    borderColor: "rgba(255,75,75,0.35)",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  closeNeedBtnDisabled: { opacity: 0.6 },
  closeNeedBtnText: { color: "#FF7D7D", fontSize: 12, fontWeight: "700" },

  volunteerList: { gap: 10 },
  volunteerCard: {
    backgroundColor: "rgba(255,255,255,0.045)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  volunteerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  volunteerTitleWrap: { flex: 1, minWidth: 0 },
  volunteerName: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  volunteerSubline: { color: "#8B8DA3", fontSize: 11, fontWeight: "600", marginTop: 2 },
  assignmentStatusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  assignmentStatusText: { fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  volunteerDetailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  volunteerDetailItem: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    minWidth: 130,
    flexGrow: 1,
  },
  volunteerDetailLabel: { color: "#8B8DA3", fontSize: 10, fontWeight: "800", marginBottom: 3, textTransform: "uppercase" },
  volunteerDetailValue: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  assignmentMetaRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
    paddingTop: 8,
  },
  assignmentMetaText: { color: "#B8B8D0", fontSize: 11, fontWeight: "600" },
  emptyAssignmentText: { color: "#8B8DA3", fontSize: 13, fontWeight: "600" },

  // Description
  descriptionText: {
    fontSize: 14,
    color: "#E0E0E0",
    lineHeight: 20,
  },

  // Info Row
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoValue: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
    textTransform: "capitalize",
  },

  // Location
  locationInfo: {
    marginBottom: 8,
  },
  locationLabel: {
    fontSize: 12,
    color: "#8B8DA3",
    marginBottom: 4,
  },
  locationValue: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  coordInfo: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "rgba(102,126,234,0.1)",
    borderRadius: 8,
    marginTop: 8,
  },
  coordText: {
    fontSize: 12,
    color: "#667EEA",
    fontWeight: "600",
  },

  // Score
  scoreContainer: {
    gap: 8,
  },
  scoreBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    backgroundColor: "#667EEA",
  },
  scoreValue: {
    fontSize: 13,
    color: "#667EEA",
    fontWeight: "700",
  },

  // Date
  dateText: {
    fontSize: 13,
    color: "#E0E0E0",
  },

  // Reference
  refRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  refLabel: {
    fontSize: 12,
    color: "#8B8DA3",
  },
  refValue: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
