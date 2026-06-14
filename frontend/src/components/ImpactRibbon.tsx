import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useAccessibility } from "../context/AccessibilityContext";
import { useLanguage } from "../context/LanguageContext";
import { colors, fonts } from "../theme";

export const ImpactRibbon = ({
  needs,
  volunteers,
  organizations,
}: {
  needs: number;
  volunteers: number;
  organizations: number;
}) => {
  const { reduceMotion, textScale } = useAccessibility();
  const { t } = useLanguage();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      shimmer.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [reduceMotion, shimmer]);

  const x = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-220, 240] });

  return (
    <View style={styles.ribbon}>
      {reduceMotion ? null : <Animated.View style={[styles.shimmer, { transform: [{ translateX: x }] }]} />}
      <Text style={[styles.tag, { fontSize: 11 * textScale, lineHeight: 15 * textScale }]}>{t("Impact Pulse")}</Text>
      <View style={styles.row}>
        <Text style={[styles.item, { fontSize: 12 * textScale, lineHeight: 17 * textScale }]}>{t("Needs")} {needs}</Text>
        <Text style={styles.dot}>|</Text>
        <Text style={[styles.item, { fontSize: 12 * textScale, lineHeight: 17 * textScale }]}>{t("Volunteers")} {volunteers}</Text>
        <Text style={styles.dot}>|</Text>
        <Text style={[styles.item, { fontSize: 12 * textScale, lineHeight: 17 * textScale }]}>{t("Orgs")} {organizations}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ribbon: {
    overflow: "hidden",
    backgroundColor: "rgba(39,176,125,0.16)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(39,176,125,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  shimmer: {
    position: "absolute",
    top: -20,
    bottom: -20,
    width: 120,
    backgroundColor: "rgba(246,252,255,0.10)",
    transform: [{ rotate: "18deg" }],
  },
  tag: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: 2,
    fontFamily: fonts.accent,
  },
  row: { flexDirection: "row", alignItems: "center" },
  item: { color: colors.textStrong, fontWeight: "800", fontSize: 12, fontFamily: fonts.body },
  dot: { color: colors.muted, marginHorizontal: 6, fontWeight: "900" },
});
