import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAccessibility } from "./AccessibilityContext";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import { moduleApi } from "../services/api";

type RealtimeMessage = {
  id?: number;
  event?: string;
  type?: string;
  title?: string;
  message?: string | null;
  payload?: Record<string, unknown> | null;
};

type RealtimeContextShape = {
  realtimeVersion: number;
  needsVersion: number;
  assignmentsVersion: number;
  volunteerRatingVersion: number;
  statisticsVersion: number;
  lastMessage: RealtimeMessage | null;
};

type AssignmentProposal = {
  assignmentId: number;
  title: string;
  message: string;
  needTitle?: string;
  category?: string;
  urgency?: string;
  address?: string;
  matchScore?: number | null;
};

type AdminRatingPrompt = {
  assignmentId: number;
  volunteerId: number;
  title: string;
  message: string;
  needTitle?: string | null;
};

type RefreshDomain = "needs" | "assignments" | "volunteerRating" | "statistics";

const RealtimeContext = createContext<RealtimeContextShape | undefined>(undefined);

const getWebSocketUrl = (baseUrl: string, token: string) => {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  const wsBase = normalized.replace(/^http/i, "ws");
  return `${wsBase}/ws/notifications?token=${encodeURIComponent(token)}`;
};

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const { baseUrl, token, user } = useAuth();
  const { highContrast, screenReaderOptimized, textScale, touchTarget } = useAccessibility();
  const { t, translateAddress, translateCategory, translateText } = useLanguage();
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  const [needsVersion, setNeedsVersion] = useState(0);
  const [assignmentsVersion, setAssignmentsVersion] = useState(0);
  const [volunteerRatingVersion, setVolunteerRatingVersion] = useState(0);
  const [statisticsVersion, setStatisticsVersion] = useState(0);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const [proposal, setProposal] = useState<AssignmentProposal | null>(null);
  const [proposalBusy, setProposalBusy] = useState<"accepted" | "declined" | null>(null);
  const [adminRatingPrompt, setAdminRatingPrompt] = useState<AdminRatingPrompt | null>(null);
  const [adminRating, setAdminRating] = useState(0);
  const [adminRatingBusy, setAdminRatingBusy] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const refreshTimersRef = useRef<Partial<Record<RefreshDomain, ReturnType<typeof setTimeout>>>>({});

  const scheduleRefresh = (domains: RefreshDomain[]) => {
    domains.forEach((domain) => {
      const existingTimer = refreshTimersRef.current[domain];
      if (existingTimer) clearTimeout(existingTimer);

      refreshTimersRef.current[domain] = setTimeout(() => {
        delete refreshTimersRef.current[domain];
        setRealtimeVersion((current) => current + 1);
        if (domain === "needs") setNeedsVersion((current) => current + 1);
        if (domain === "assignments") setAssignmentsVersion((current) => current + 1);
        if (domain === "volunteerRating") setVolunteerRatingVersion((current) => current + 1);
        if (domain === "statistics") setStatisticsVersion((current) => current + 1);
      }, 650);
    });
  };

  useEffect(() => () => {
    Object.values(refreshTimersRef.current).forEach((timer) => {
      if (timer) clearTimeout(timer);
    });
    refreshTimersRef.current = {};
  }, []);

  useEffect(() => {
    if (!token || token === "dev-bypass-token") {
      socketRef.current?.close();
      socketRef.current = null;
      return;
    }

    const socket = new WebSocket(getWebSocketUrl(baseUrl, token));
    socketRef.current = socket;

    socket.onmessage = (event) => {
      let message: RealtimeMessage;
      try {
        message = JSON.parse(event.data) as RealtimeMessage;
      } catch {
        return;
      }

      const eventName = message.event || message.type || "notification";
      const payload = message.payload ?? {};
      const subject = typeof payload.subject === "string" ? payload.subject : "";
      const assignmentId = asNumber(payload.assignment_id);
      const volunteerId = asNumber(payload.volunteer_id);

      if (eventName === "realtime.subscribed") return;

      setLastMessage(message);

      if (eventName === "need_created") {
        scheduleRefresh(["needs", "statistics"]);
      } else if (eventName === "assignment_created") {
        scheduleRefresh(["assignments"]);
      } else if (eventName === "assignment_status_changed") {
        scheduleRefresh(["assignments", "needs", "statistics"]);
      } else if (eventName === "volunteer_rating_updated" || subject.includes("volunteer.rating.updated")) {
        scheduleRefresh(["volunteerRating", "statistics"]);
      }

      if (user?.role === "volunteer" && eventName === "assignment_created" && assignmentId) {
        setProposal({
          assignmentId,
          title: message.title || t("New assignment proposal"),
          message: message.message || t("A nearby need matches your skills."),
          needTitle: typeof payload.need_title === "string" ? payload.need_title : undefined,
          category: typeof payload.need_category === "string" ? payload.need_category : undefined,
          urgency: typeof payload.need_urgency === "string" ? payload.need_urgency : undefined,
          address: typeof payload.address === "string" ? payload.address : undefined,
          matchScore: asNumber(payload.match_score),
        });
        return;
      }

      if (
        user?.role === "admin" &&
        eventName === "assignment_status_changed" &&
        assignmentId &&
        volunteerId &&
        payload.status === "completed"
      ) {
        setAdminRatingPrompt({
          assignmentId,
          volunteerId,
          title: message.title || t("Assignment completed"),
          message: message.message || t("A volunteer completed an assignment. Please rate their work."),
          needTitle: typeof payload.need_title === "string" ? payload.need_title : null,
        });
        return;
      }

      if (user?.role === "admin" && eventName === "assignment_status_changed" && message.title) {
        Alert.alert(t(message.title), message.message ? t(message.message) : t("Your branch data has changed."));
        return;
      }

      if (eventName === "general" && message.title) {
        Alert.alert(t(message.title), message.message ? t(message.message) : t("Your data has changed."));
      }
    };

    socket.onerror = () => {
      socket.close();
    };

    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [baseUrl, t, token, user?.role]);

  const closeProposal = () => {
    setProposal(null);
    setProposalBusy(null);
  };

  const updateProposalStatus = async (status: "accepted" | "declined") => {
    if (!proposal) return;
    setProposalBusy(status);
    try {
      await moduleApi.updateAssignmentStatus(baseUrl, token, proposal.assignmentId, status);
      scheduleRefresh(["assignments", "needs", "statistics"]);
      closeProposal();
    } catch (err) {
      Alert.alert(t("Assignment"), err instanceof Error ? err.message : t("Unable to update assignment"));
      setProposalBusy(null);
    }
  };

  const closeAdminRating = () => {
    setAdminRatingPrompt(null);
    setAdminRating(0);
    setAdminRatingBusy(false);
  };

  const submitAdminRating = async () => {
    if (!adminRatingPrompt) return;
    if (adminRating < 1) {
      Alert.alert(t("Volunteer Rating"), t("Please select a rating from 1 to 5 stars."));
      return;
    }

    setAdminRatingBusy(true);
    try {
      await moduleApi.updateVolunteer(baseUrl, token, adminRatingPrompt.volunteerId, { rating: adminRating });
      scheduleRefresh(["assignments", "volunteerRating", "statistics"]);
      closeAdminRating();
    } catch (err) {
      Alert.alert(t("Volunteer Rating"), err instanceof Error ? err.message : t("Unable to update volunteer rating"));
      setAdminRatingBusy(false);
    }
  };

  const value = useMemo(
    () => ({ realtimeVersion, needsVersion, assignmentsVersion, volunteerRatingVersion, statisticsVersion, lastMessage }),
    [assignmentsVersion, lastMessage, needsVersion, realtimeVersion, statisticsVersion, volunteerRatingVersion]
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      <Modal visible={Boolean(proposal)} transparent animationType="fade" onRequestClose={closeProposal}>
        <View style={styles.overlay}>
          <View style={[styles.card, highContrast ? styles.highContrastCard : null]} accessibilityRole="alert">
            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <Text style={styles.iconText}>!</Text>
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, { fontSize: 17 * textScale, lineHeight: 22 * textScale }]}>{proposal?.title ? translateText(proposal.title) : t("New assignment proposal")}</Text>
                <Text style={[styles.subtitle, { fontSize: 12 * textScale, lineHeight: 16 * textScale }]}>{t("Assignment")} #{proposal?.assignmentId ?? "-"}</Text>
              </View>
            </View>

            <Text style={[styles.message, { fontSize: 13 * textScale, lineHeight: 19 * textScale }]}>{translateText(proposal?.message)}</Text>

            <View style={styles.detailBox}>
              <Text style={styles.needTitle}>{proposal?.needTitle ? translateText(proposal.needTitle) : t("Matching community need")}</Text>
              <Text style={styles.detailText} numberOfLines={2}>{proposal?.address ? translateAddress(proposal.address) : t("Location details available on the assignment page")}</Text>
              <View style={styles.metaRow}>
                {proposal?.category ? <Text style={styles.metaChip}>{translateCategory(proposal.category)}</Text> : null}
                {proposal?.urgency ? <Text style={[styles.metaChip, styles.urgentChip]}>{translateCategory(proposal.urgency)}</Text> : null}
                {typeof proposal?.matchScore === "number" ? <Text style={styles.metaChip}>{proposal.matchScore.toFixed(0)}% {t("match")}</Text> : null}
              </View>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, styles.declineButton, proposalBusy !== null && styles.disabledButton]}
                disabled={proposalBusy !== null}
                onPress={() => void updateProposalStatus("declined")}
                accessibilityRole="button"
                accessibilityLabel={screenReaderOptimized ? t("Decline assignment proposal") : undefined}
              >
                <Text style={styles.declineText}>{proposalBusy === "declined" ? t("Declining...") : t("Decline")}</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.laterButton, proposalBusy !== null && styles.disabledButton]}
                disabled={proposalBusy !== null}
                onPress={closeProposal}
                accessibilityRole="button"
                accessibilityLabel={screenReaderOptimized ? t("Decide later on assignment proposal") : undefined}
              >
                <Text style={styles.laterText}>{t("Do Later")}</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.acceptButton, proposalBusy !== null && styles.disabledButton]}
                disabled={proposalBusy !== null}
                onPress={() => void updateProposalStatus("accepted")}
                accessibilityRole="button"
                accessibilityLabel={screenReaderOptimized ? t("Accept assignment proposal") : undefined}
              >
                <Text style={styles.acceptText}>{proposalBusy === "accepted" ? t("Accepting...") : t("Accept")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(adminRatingPrompt)} transparent animationType="fade" onRequestClose={closeAdminRating}>
        <View style={styles.overlay}>
          <View style={[styles.card, highContrast ? styles.highContrastCard : null]} accessibilityRole="alert">
            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <Text style={styles.iconText}>★</Text>
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.title, { fontSize: 17 * textScale, lineHeight: 22 * textScale }]}>{adminRatingPrompt?.title ? translateText(adminRatingPrompt.title) : t("Assignment completed")}</Text>
                <Text style={[styles.subtitle, { fontSize: 12 * textScale, lineHeight: 16 * textScale }]}>{t("Assignment")} #{adminRatingPrompt?.assignmentId ?? "-"}</Text>
              </View>
            </View>

            <Text style={[styles.message, { fontSize: 13 * textScale, lineHeight: 19 * textScale }]}>{translateText(adminRatingPrompt?.message)}</Text>

            <View style={styles.detailBox}>
              <Text style={styles.needTitle}>{adminRatingPrompt?.needTitle ? translateText(adminRatingPrompt.needTitle) : t("Completed assignment")}</Text>
              <Text style={styles.detailText}>{t("Volunteer")} #{adminRatingPrompt?.volunteerId ?? "-"}</Text>
            </View>

            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  style={[styles.starButton, { width: touchTarget, height: touchTarget }]}
                  onPress={() => setAdminRating(star)}
                  disabled={adminRatingBusy}
                  accessibilityRole="button"
                  accessibilityLabel={screenReaderOptimized ? `${t("Rate volunteer")} ${star} ${t("out of 5 stars")}` : undefined}
                >
                  <Text style={[styles.starText, star <= adminRating && styles.starTextActive]}>{star <= adminRating ? "★" : "☆"}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, styles.laterButton, adminRatingBusy && styles.disabledButton]}
                disabled={adminRatingBusy}
                onPress={closeAdminRating}
                accessibilityRole="button"
                accessibilityLabel={screenReaderOptimized ? t("Rate this volunteer later") : undefined}
              >
                <Text style={styles.laterText}>{t("Do Later")}</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.acceptButton, adminRatingBusy && styles.disabledButton]}
                disabled={adminRatingBusy}
                onPress={() => void submitAdminRating()}
                accessibilityRole="button"
                accessibilityLabel={screenReaderOptimized ? t("Save volunteer rating") : undefined}
              >
                <Text style={styles.acceptText}>{adminRatingBusy ? t("Saving...") : t("Save Rating")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtime must be used inside RealtimeProvider");
  }
  return ctx;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,10,20,0.58)",
    padding: 18,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "#0B1A24",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  highContrastCard: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(102,126,234,0.2)",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.4)",
  },
  iconText: { color: "#AFC0FF", fontSize: 22, fontWeight: "900" },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { color: "#FFFFFF", fontSize: 17, fontWeight: "900", lineHeight: 22 },
  subtitle: { color: "#8B8DA3", fontSize: 12, fontWeight: "800", marginTop: 2 },
  message: { color: "#D8D9E3", fontSize: 13, fontWeight: "700", lineHeight: 19, marginBottom: 12 },
  detailBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 12,
    marginBottom: 14,
  },
  needTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", marginBottom: 5 },
  detailText: { color: "#B8B8D0", fontSize: 12, fontWeight: "700", lineHeight: 17 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  metaChip: {
    color: "#D8D9E3",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "capitalize",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  urgentChip: { color: "#FFD7A6", backgroundColor: "rgba(245,158,11,0.16)" },
  starRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 14 },
  starButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  starText: { color: "rgba(255,255,255,0.32)", fontSize: 30, fontWeight: "900", lineHeight: 34 },
  starTextActive: { color: "#F59E0B" },
  actionsRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  declineButton: { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.4)" },
  laterButton: { backgroundColor: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.13)" },
  acceptButton: { backgroundColor: "#43E97B", borderColor: "#43E97B" },
  declineText: { color: "#FFB4B4", fontSize: 12, fontWeight: "900" },
  laterText: { color: "#D8D9E3", fontSize: 12, fontWeight: "900" },
  acceptText: { color: "#072414", fontSize: 12, fontWeight: "900" },
  disabledButton: { opacity: 0.65 },
});
