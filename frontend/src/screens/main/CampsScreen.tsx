import { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { moduleApi } from "../../services/api";
import { colors } from "../../theme";
import type { Need } from "../../types/api";

export const CampsScreen = () => {
  const { baseUrl, token } = useAuth();
  const { highContrast, reduceMotion, textScale } = useAccessibility();
  const [items, setItems] = useState<Need[]>([]);

  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const load = async () => {
      try {
        const needs = await moduleApi.needs(baseUrl, token);
        setItems(needs.filter((n) => n.status !== "closed").slice(0, 8));
      } catch {
        setItems([]);
      }
    };

    load();
  }, [baseUrl, token]);

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
      ]),
    ),

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 3300, useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 3300, useNativeDriver: true }),
      ]),
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, textStyle(32, 38)]}>Updated Camps</Text>
        <Text style={[styles.subtitle, textStyle(14, 20)]}>Recent active field camps and current urgency snapshot</Text>

        {items.map((n) => (
          <View key={n.id} style={[styles.card, highContrast ? styles.highContrastCard : null]}>
            <Text style={[styles.cardTitle, textStyle(16, 21)]}>{n.title}</Text>
            <Text style={[styles.meta, textStyle(13, 20)]}>{n.address}</Text>
            <Text style={[styles.meta, textStyle(13, 20)]}>Urgency: {n.urgency} | Status: {n.status}</Text>
          </View>
        ))}

        {items.length === 0 ? (
          <View style={[styles.emptyCard, highContrast ? styles.highContrastCard : null]}>
            <Text style={[styles.emptyTitle, textStyle(16, 21)]}>No camp updates available</Text>
            <Text style={[styles.emptyMeta, textStyle(13, 18)]}>Create or verify needs to surface active camps here.</Text>
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
  cardTitle: { color: colors.textStrong, fontSize: 16, fontWeight: "900", marginBottom: 6 },
  meta: { color: colors.muted, lineHeight: 20, fontSize: 13 },

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