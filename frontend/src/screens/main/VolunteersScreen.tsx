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
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { moduleApi } from "../../services/api";
import type { Volunteer } from "../../types/api";
import { colors } from "../../theme";

export const VolunteersScreen = () => {
  const { baseUrl, token } = useAuth();
  const { highContrast, reduceMotion, textScale } = useAccessibility();
  const { t } = useLanguage();
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
    if (reduceMotion) {
      floatA.setValue(0);
      floatB.setValue(0);
      return;
    }

    const animations = [Animated.loop(
      Animated.sequence([
        Animated.timing(floatA, { toValue: 1, duration: 2800, useNativeDriver: true }),
        Animated.timing(floatA, { toValue: 0, duration: 2800, useNativeDriver: true }),
      ])
    ),

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 3300, useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 3300, useNativeDriver: true }),
      ])
    )];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [floatA, floatB, reduceMotion]);

  const textStyle = (fontSize: number, lineHeight?: number) => ({ fontSize: fontSize * textScale, ...(lineHeight ? { lineHeight: lineHeight * textScale } : {}) });

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
        <Text style={[styles.title, textStyle(32, 38)]}>{t("Volunteers")}</Text>
        <Text style={[styles.subtitle, textStyle(14, 20)]}>{t("Live volunteer roster and availability")}</Text>

        {items.map((v) => (
          <View key={v.id} style={[styles.card, highContrast ? styles.highContrastCard : null]}>
            <View style={styles.headerRow}>
              <Text style={[styles.name, textStyle(16, 21)]}>{t("Volunteer")} #{v.id}</Text>
              <View style={[styles.badge, v.availability ? styles.availableBadge : styles.unavailableBadge]}>
                <Text style={[styles.badgeText, v.availability ? styles.availableText : styles.unavailableText, textStyle(11, 15)]}>
                  {v.availability ? t("Available") : t("Busy")}
                </Text>
              </View>
            </View>

            <Text style={[styles.metaLine, textStyle(13, 19)]}>
              <Text style={styles.metaStrong}>{t("Verified")}:</Text> {v.verified ? t("Yes") : t("No")}
            </Text>
            <Text style={[styles.metaLine, textStyle(13, 19)]}>
              <Text style={styles.metaStrong}>{t("Tasks completed")}:</Text> {v.tasks_completed}
            </Text>
            <Text style={[styles.metaLine, textStyle(13, 19)]}>
              <Text style={styles.metaStrong}>{t("Active tasks")}:</Text> {v.active_tasks}
            </Text>
            <Text style={[styles.metaLine, textStyle(13, 19)]}>
              <Text style={styles.metaStrong}>{t("Organization ID")}:</Text> {v.organization_id ?? "-"}
            </Text>
          </View>
        ))}

        {items.length === 0 && !refreshing ? (
          <View style={[styles.emptyCard, highContrast ? styles.highContrastCard : null]}>
            <Text style={[styles.emptyTitle, textStyle(16, 21)]}>{t("No volunteers found")}</Text>
            <Text style={[styles.emptyMeta, textStyle(13, 18)]}>{t("Pull to refresh and load volunteer profiles.")}</Text>
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
  highContrastCard: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000" },

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


