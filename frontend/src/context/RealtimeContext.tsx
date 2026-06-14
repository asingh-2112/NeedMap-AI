import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "./AuthContext";
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

const RealtimeContext = createContext<RealtimeContextShape | undefined>(undefined);

const getWebSocketUrl = (baseUrl: string, token: string) => {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  const wsBase = normalized.replace(/^http/i, "ws");
  return `${wsBase}/ws/notifications?token=${encodeURIComponent(token)}`;
};

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const { baseUrl, token, user } = useAuth();
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const [proposal, setProposal] = useState<AssignmentProposal | null>(null);
  const [proposalBusy, setProposalBusy] = useState<"accepted" | "declined" | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

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

      setLastMessage(message);
      setRealtimeVersion((current) => current + 1);

      const eventName = message.event || message.type || "notification";
      const payload = message.payload ?? {};
      const assignmentId = asNumber(payload.assignment_id);

      if (eventName === "realtime.subscribed") return;

      if (user?.role === "volunteer" && eventName === "assignment_created" && assignmentId) {
        setProposal({
          assignmentId,
          title: message.title || "New assignment proposal",
          message: message.message || "A nearby need matches your skills.",
          needTitle: typeof payload.need_title === "string" ? payload.need_title : undefined,
          category: typeof payload.need_category === "string" ? payload.need_category : undefined,
          urgency: typeof payload.need_urgency === "string" ? payload.need_urgency : undefined,
          address: typeof payload.address === "string" ? payload.address : undefined,
          matchScore: asNumber(payload.match_score),
        });
        return;
      }

      if (user?.role === "admin" && eventName === "assignment_status_changed" && message.title) {
        Alert.alert(message.title, message.message || "Your branch data has changed.");
        return;
      }

      if (eventName === "general" && message.title) {
        Alert.alert(message.title, message.message || "Your data has changed.");
      }
    };

    socket.onerror = () => {
      socket.close();
    };

    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [baseUrl, token, user?.role]);

  const closeProposal = () => {
    setProposal(null);
    setProposalBusy(null);
  };

  const updateProposalStatus = async (status: "accepted" | "declined") => {
    if (!proposal) return;
    setProposalBusy(status);
    try {
      await moduleApi.updateAssignmentStatus(baseUrl, token, proposal.assignmentId, status);
      setRealtimeVersion((current) => current + 1);
      closeProposal();
    } catch (err) {
      Alert.alert("Assignment", err instanceof Error ? err.message : "Unable to update assignment");
      setProposalBusy(null);
    }
  };

  const value = useMemo(() => ({ realtimeVersion, lastMessage }), [realtimeVersion, lastMessage]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      <Modal visible={Boolean(proposal)} transparent animationType="fade" onRequestClose={closeProposal}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <Text style={styles.iconText}>!</Text>
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.title}>{proposal?.title ?? "New assignment proposal"}</Text>
                <Text style={styles.subtitle}>Assignment #{proposal?.assignmentId ?? "-"}</Text>
              </View>
            </View>

            <Text style={styles.message}>{proposal?.message}</Text>

            <View style={styles.detailBox}>
              <Text style={styles.needTitle}>{proposal?.needTitle || "Matching community need"}</Text>
              <Text style={styles.detailText} numberOfLines={2}>{proposal?.address || "Location details available on the assignment page"}</Text>
              <View style={styles.metaRow}>
                {proposal?.category ? <Text style={styles.metaChip}>{proposal.category.replace(/_/g, " ")}</Text> : null}
                {proposal?.urgency ? <Text style={[styles.metaChip, styles.urgentChip]}>{proposal.urgency}</Text> : null}
                {typeof proposal?.matchScore === "number" ? <Text style={styles.metaChip}>{proposal.matchScore.toFixed(0)}% match</Text> : null}
              </View>
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, styles.declineButton, proposalBusy !== null && styles.disabledButton]}
                disabled={proposalBusy !== null}
                onPress={() => void updateProposalStatus("declined")}
              >
                <Text style={styles.declineText}>{proposalBusy === "declined" ? "Declining..." : "Decline"}</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.laterButton, proposalBusy !== null && styles.disabledButton]}
                disabled={proposalBusy !== null}
                onPress={closeProposal}
              >
                <Text style={styles.laterText}>Do Later</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.acceptButton, proposalBusy !== null && styles.disabledButton]}
                disabled={proposalBusy !== null}
                onPress={() => void updateProposalStatus("accepted")}
              >
                <Text style={styles.acceptText}>{proposalBusy === "accepted" ? "Accepting..." : "Accept"}</Text>
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
