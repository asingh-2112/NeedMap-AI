import { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme";

const schemes = [
  { title: "Emergency Food Support", desc: "Rapid food kit allocation for critical families.", tone: "#EF4444" },
  { title: "Safe Shelter Aid", desc: "Temporary shelter and relocation support.", tone: "#0EA5E9" },
  { title: "Women Health Outreach", desc: "Monthly camp for health and awareness.", tone: "#F59E0B" },
];

export const SchemesScreen = () => {
  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;

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

  return (
    <View style={styles.page}>
      <LinearGradient colors={[colors.bg, colors.bgSoft, colors.bgWarm]} style={StyleSheet.absoluteFillObject} />

      <Animated.View style={[styles.blob, styles.blobA, { transform: [{ translateY: yA }] }]} />
      <Animated.View style={[styles.blob, styles.blobB, { transform: [{ translateY: yB }] }]} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Schemes</Text>
        <Text style={styles.subtitle}>Support programs mapped for quick action</Text>

        {schemes.map((s) => (
          <View key={s.title} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.dot, { backgroundColor: s.tone }]} />
              <Text style={styles.cardTitle}>{s.title}</Text>
            </View>
            <Text style={styles.meta}>{s.desc}</Text>
          </View>
        ))}
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

  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { color: colors.textStrong, fontSize: 17, fontWeight: "900" },
  meta: { color: colors.muted, lineHeight: 20, fontSize: 13 },
});