import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import type { Need } from "../../types/api";
import { colors } from "../../theme";

const NEED_CATEGORIES = [
  "water_access",
  "food",
  "shelter",
  "health",
  "education",
  "sanitation",
  "clothing",
  "legal_aid",
  "mental_health",
  "transportation",
  "other",
] as const;

const URGENCIES = ["critical", "high", "medium", "low"] as const;
const STATUSES = ["new", "verified", "assigned", "in_progress", "resolved", "closed"] as const;

export const NeedsScreen = () => {
  const { baseUrl, token, user } = useAuth();
  const [items, setItems] = useState<Need[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceLoadingId, setSourceLoadingId] = useState<number | null>(null);
  const [actionMessageByNeed, setActionMessageByNeed] = useState<Record<number, { text: string; type: "success" | "error" }>>({});

  const [creating, setCreating] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createCategory, setCreateCategory] = useState<(typeof NEED_CATEGORIES)[number]>("water_access");
  const [createUrgency, setCreateUrgency] = useState<(typeof URGENCIES)[number]>("medium");
  const [createLat, setCreateLat] = useState("25.4358");
  const [createLng, setCreateLng] = useState("81.8463");
  const [createAddress, setCreateAddress] = useState("");
  const [createMessage, setCreateMessage] = useState("");

  const [sourceTypeByNeed, setSourceTypeByNeed] = useState<Record<number, "voice_note" | "paper_survey" | "csv_upload">>({});
  const [sourceLocationByNeed, setSourceLocationByNeed] = useState<Record<number, string>>({});
  const [sourceTextByNeed, setSourceTextByNeed] = useState<Record<number, string>>({});

  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;

  const isOrgManager = user?.role === "owner" || user?.role === "admin";

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await moduleApi.needs(
        baseUrl,
        token,
        isOrgManager && user?.organization_id
          ? { organization_id: user.organization_id }
          : undefined,
      );
      setItems(data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [baseUrl, token, user?.role, user?.organization_id]);

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

  const urgencyColor = (u: string) => {
    const x = (u || "").toLowerCase();
    if (x === "critical") return "#DC2626";
    if (x === "high") return "#EA580C";
    if (x === "medium") return "#CA8A04";
    return "#16A34A";
  };

  const createNeed = async () => {
    if (!user?.organization_id) return;
    setCreating(true);
    setCreateMessage("");
    try {
      const newNeed = await moduleApi.createNeed(baseUrl, token, {
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        category: createCategory,
        urgency: createUrgency,
        organization_id: user.organization_id,
        latitude: Number(createLat),
        longitude: Number(createLng),
        address: createAddress.trim(),
      });
      setItems((prev) => [newNeed, ...prev]);
      setCreateTitle("");
      setCreateDesc("");
      setCreateAddress("");
      setCreateMessage("Need created successfully.");
    } catch (err) {
      setCreateMessage(err instanceof Error ? err.message : "Unable to create need");
    } finally {
      setCreating(false);
    }
  };

  const updateNeed = async (need: Need, body: { status?: string; urgency?: string }) => {
    try {
      const updated = await moduleApi.updateNeed(baseUrl, token, need.id, body);
      setItems((prev) => prev.map((x) => (x.id === need.id ? updated : x)));
      setActionMessageByNeed((prev) => ({
        ...prev,
        [need.id]: { text: "Need updated.", type: "success" },
      }));
    } catch (err) {
      setActionMessageByNeed((prev) => ({
        ...prev,
        [need.id]: { text: err instanceof Error ? err.message : "Unable to update need.", type: "error" },
      }));
    }
  };

  const closeNeed = async (need: Need) => {
    try {
      await moduleApi.closeNeed(baseUrl, token, need.id);
      await load();
      setActionMessageByNeed((prev) => ({
        ...prev,
        [need.id]: { text: "Need closed.", type: "success" },
      }));
    } catch (err) {
      setActionMessageByNeed((prev) => ({
        ...prev,
        [need.id]: { text: err instanceof Error ? err.message : "Unable to close need.", type: "error" },
      }));
    }
  };

  const addSource = async (need: Need) => {
    const needId = need.id;
    const sourceType = sourceTypeByNeed[needId] || "voice_note";
    const canUploadSurveyForNeed =
      (user?.role === "admin" || user?.role === "owner") &&
      user?.organization_id === need.organization_id;

    if ((sourceType === "paper_survey" || sourceType === "csv_upload") && !canUploadSurveyForNeed) {
      setActionMessageByNeed((prev) => ({
        ...prev,
        [needId]: { text: "Survey upload allowed only for your organization admin/owner.", type: "error" },
      }));
      return;
    }

    setSourceLoadingId(needId);
    try {
      await moduleApi.addNeedSource(baseUrl, token, needId, {
        source_type: sourceType,
        location: sourceLocationByNeed[needId]?.trim() || "Frontend source",
        multimedia_txt:
          sourceTextByNeed[needId]?.trim() ||
          (sourceType === "voice_note" ? "Voice source submitted" : "Survey source submitted"),
        ai_extraction: `{"source":"${sourceType}","submitted_by":"${user?.role || "unknown"}"}`,
      });
      setActionMessageByNeed((prev) => ({
        ...prev,
        [needId]: { text: "Source added successfully.", type: "success" },
      }));
      setSourceTextByNeed((prev) => ({ ...prev, [needId]: "" }));
    } catch (err) {
      setActionMessageByNeed((prev) => ({
        ...prev,
        [needId]: { text: err instanceof Error ? err.message : "Unable to add source.", type: "error" },
      }));
    } finally {
      setSourceLoadingId(null);
    }
  };

  const cycleUrgency = (current: string) => {
    const idx = URGENCIES.indexOf((current as (typeof URGENCIES)[number]) || "low");
    return URGENCIES[(idx + 1) % URGENCIES.length];
  };

  const cycleStatus = (current: string) => {
    const idx = STATUSES.indexOf((current as (typeof STATUSES)[number]) || "new");
    return STATUSES[(idx + 1) % STATUSES.length];
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
        <Text style={styles.title}>Needs</Text>
        <Text style={styles.subtitle}>Live requirement stream with warm visual theme</Text>

        {isOrgManager && user?.organization_id ? (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Create Need</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={createTitle} onChangeText={setCreateTitle} placeholder="Need title" placeholderTextColor={colors.muted} />

            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} value={createDesc} onChangeText={setCreateDesc} placeholder="Need description" placeholderTextColor={colors.muted} />

            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={createAddress} onChangeText={setCreateAddress} placeholder="Full address" placeholderTextColor={colors.muted} />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Latitude</Text>
                <TextInput style={styles.input} value={createLat} onChangeText={setCreateLat} keyboardType="numeric" placeholderTextColor={colors.muted} />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Longitude</Text>
                <TextInput style={styles.input} value={createLng} onChangeText={setCreateLng} keyboardType="numeric" placeholderTextColor={colors.muted} />
              </View>
            </View>

            <View style={styles.row}>
              <Pressable style={styles.selectBtn} onPress={() => setCreateCategory(NEED_CATEGORIES[(NEED_CATEGORIES.indexOf(createCategory) + 1) % NEED_CATEGORIES.length])}>
                <Text style={styles.selectText}>Category: {createCategory}</Text>
              </Pressable>
              <Pressable style={styles.selectBtn} onPress={() => setCreateUrgency(URGENCIES[(URGENCIES.indexOf(createUrgency) + 1) % URGENCIES.length])}>
                <Text style={styles.selectText}>Urgency: {createUrgency}</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.primaryBtn, creating && styles.disabledBtn]}
              disabled={
                creating ||
                createTitle.trim().length < 2 ||
                createAddress.trim().length < 2 ||
                Number.isNaN(Number(createLat)) ||
                Number.isNaN(Number(createLng))
              }
              onPress={createNeed}
            >
              <Text style={styles.primaryBtnText}>{creating ? "Creating..." : "Create Need"}</Text>
            </Pressable>

            {createMessage ? <Text style={styles.message}>{createMessage}</Text> : null}
          </View>
        ) : null}

        {items.map((n) => {
          const canManageNeed = isOrgManager && user?.organization_id === n.organization_id;
          const actionMessage = actionMessageByNeed[n.id];
          const srcType = sourceTypeByNeed[n.id] || "voice_note";
          return (
            <View key={n.id} style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>{n.title}</Text>
                <View style={[styles.badge, { backgroundColor: `${urgencyColor(n.urgency)}22`, borderColor: urgencyColor(n.urgency) }]}>
                  <Text style={[styles.badgeText, { color: urgencyColor(n.urgency) }]}>{n.urgency}</Text>
                </View>
              </View>

              <Text style={styles.metaLine}>
                <Text style={styles.metaStrong}>Category:</Text> {n.category}
              </Text>
              <Text style={styles.metaLine}>
                <Text style={styles.metaStrong}>Status:</Text> {n.status}
              </Text>
              <Text style={styles.address}>{n.address}</Text>

              {canManageNeed ? (
                <View style={styles.actionRow}>
                  <Pressable style={styles.actionBtn} onPress={() => updateNeed(n, { urgency: cycleUrgency(n.urgency) })}>
                    <Text style={styles.actionBtnText}>Cycle Urgency</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => updateNeed(n, { status: cycleStatus(n.status) })}>
                    <Text style={styles.actionBtnText}>Cycle Status</Text>
                  </Pressable>
                  <Pressable style={[styles.actionBtn, styles.closeBtn]} onPress={() => closeNeed(n)}>
                    <Text style={[styles.actionBtnText, styles.closeBtnText]}>Close Need</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.label}>Add Source</Text>
              <View style={styles.row}>
                <Pressable
                  style={[styles.roleBtn, srcType === "voice_note" && styles.roleBtnActive]}
                  onPress={() => setSourceTypeByNeed((prev) => ({ ...prev, [n.id]: "voice_note" }))}
                >
                  <Text style={[styles.roleBtnText, srcType === "voice_note" && styles.roleBtnTextActive]}>Voice</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleBtn, srcType === "paper_survey" && styles.roleBtnActive]}
                  onPress={() => setSourceTypeByNeed((prev) => ({ ...prev, [n.id]: "paper_survey" }))}
                >
                  <Text style={[styles.roleBtnText, srcType === "paper_survey" && styles.roleBtnTextActive]}>Survey</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleBtn, srcType === "csv_upload" && styles.roleBtnActive]}
                  onPress={() => setSourceTypeByNeed((prev) => ({ ...prev, [n.id]: "csv_upload" }))}
                >
                  <Text style={[styles.roleBtnText, srcType === "csv_upload" && styles.roleBtnTextActive]}>CSV</Text>
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                value={sourceLocationByNeed[n.id] || ""}
                onChangeText={(v) => setSourceLocationByNeed((prev) => ({ ...prev, [n.id]: v }))}
                placeholder="Source location"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                style={styles.input}
                value={sourceTextByNeed[n.id] || ""}
                onChangeText={(v) => setSourceTextByNeed((prev) => ({ ...prev, [n.id]: v }))}
                placeholder="Source text"
                placeholderTextColor={colors.muted}
              />

              <Pressable
                style={[styles.primaryBtn, sourceLoadingId === n.id && styles.disabledBtn]}
                disabled={sourceLoadingId === n.id}
                onPress={() => addSource(n)}
              >
                <Text style={styles.primaryBtnText}>{sourceLoadingId === n.id ? "Submitting..." : "Submit Source"}</Text>
              </Pressable>

              {actionMessage ? (
                <Text style={[styles.actionMsg, actionMessage.type === "success" ? styles.actionMsgSuccess : styles.actionMsgError]}>
                  {actionMessage.text}
                </Text>
              ) : null}
            </View>
          );
        })}

        {items.length === 0 && !refreshing ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No needs found</Text>
            <Text style={styles.emptyMeta}>Pull to refresh and check latest requests.</Text>
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

  cardHeading: { color: colors.textStrong, fontWeight: "900", fontSize: 16, marginBottom: 8 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  name: { flex: 1, color: colors.textStrong, fontWeight: "900", fontSize: 16 },

  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },

  label: { color: colors.textStrong, fontWeight: "800", marginTop: 8, marginBottom: 4, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.cardSoft,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },

  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  col: { flex: 1 },

  selectBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardSoft,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  selectText: { color: colors.muted, fontWeight: "800", fontSize: 12 },

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

  metaLine: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  metaStrong: { color: colors.textStrong, fontWeight: "800" },
  address: { color: colors.muted, fontSize: 13, marginTop: 6, lineHeight: 19 },

  actionRow: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 6 },
  actionBtn: {
    backgroundColor: colors.cardSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  closeBtn: { backgroundColor: colors.danger, borderColor: colors.danger },
  actionBtnText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  closeBtnText: { color: colors.textStrong },

  primaryBtn: {
    marginTop: 2,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: colors.textStrong, fontWeight: "900", fontSize: 13 },
  disabledBtn: { opacity: 0.55 },

  message: { marginTop: 8, color: colors.muted, fontSize: 12, fontWeight: "700" },
  actionMsg: { marginTop: 8, fontSize: 12, fontWeight: "700" },
  actionMsgSuccess: { color: colors.success },
  actionMsgError: { color: colors.danger },

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


