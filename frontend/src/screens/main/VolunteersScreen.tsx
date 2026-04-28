import { useEffect, useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../context/AuthContext";
import { moduleApi } from "../../services/api";
import type { Volunteer } from "../../types/api";
import { colors } from "../../theme";

export const VolunteersScreen = () => {
  const { baseUrl, token } = useAuth();
  const [items, setItems] = useState<Volunteer[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await moduleApi.volunteers(baseUrl, token);
      setItems(data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatA, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(floatA, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 3300, useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 3300, useNativeDriver: true }),
      ])
    ).start();
  }, [floatA, floatB]);

  const yA = floatA.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const yB = floatB.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });

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
        <Text style={styles.title}>Volunteers</Text>
        <Text style={styles.subtitle}>Live volunteer roster and availability</Text>

        {items.map((v) => (
          <View key={v.id} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.name}>Volunteer #{v.id}</Text>
              <View style={[styles.badge, v.availability ? styles.availableBadge : styles.unavailableBadge]}>
                <Text style={[styles.badgeText, v.availability ? styles.availableText : styles.unavailableText]}>
                  {v.availability ? "Available" : "Busy"}
                </Text>
              </View>
            </View>

            <Text style={styles.metaLine}>
              <Text style={styles.metaStrong}>Verified:</Text> {v.verified ? "Yes" : "No"}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaStrong}>Tasks completed:</Text> {v.tasks_completed}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaStrong}>Active tasks:</Text> {v.active_tasks}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.metaStrong}>Organization ID:</Text> {v.organization_id ?? "-"}
            </Text>
          </View>
        ))}

        {items.length === 0 && !refreshing ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No volunteers found</Text>
            <Text style={styles.emptyMeta}>Pull to refresh and load volunteer profiles.</Text>
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

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  name: { flex: 1, color: colors.textStrong, fontWeight: "900", fontSize: 16 },

  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  availableBadge: { backgroundColor: "rgba(59,203,146,0.18)", borderColor: colors.success },
  unavailableBadge: { backgroundColor: "rgba(227,108,106,0.18)", borderColor: colors.danger },
  badgeText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  availableText: { color: colors.success },
  unavailableText: { color: colors.danger },

  metaLine: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  metaStrong: { color: colors.textStrong, fontWeight: "800" },

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


