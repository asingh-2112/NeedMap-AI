import { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FadeInView } from "../../components/FadeInView";
import { STORIES } from "./stories";
import type { RootStackParamList } from "../../navigation/types";
import { colors } from "../../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const StoriesScreen = () => {
  const nav = useNavigation<Nav>();
  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;

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
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>NeedMap AI</Text>
        <Text style={styles.title}>Story Highlights</Text>
        <Text style={styles.subtitle}>Image + one-line summary. Tap to open full details.</Text>

        {STORIES.map((story, idx) => (
          <FadeInView key={story.id} delay={60 + idx * 70} style={styles.card}>
            <Pressable onPress={() => nav.navigate("StoryDetail", { storyId: story.id })}>
              <Image source={{ uri: story.image }} style={styles.image} />
              <Text style={styles.cardTitle}>{story.title}</Text>
              <Text numberOfLines={1} style={styles.meta}>
                {story.shortDescription}
              </Text>
              <Text style={styles.location}>
                {story.location} • {story.updatedAt}
              </Text>
              <Text style={styles.readMore}>Read full story</Text>
            </Pressable>
          </FadeInView>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 36 },

  brand: { color: colors.accent, fontSize: 22, fontWeight: "900", marginBottom: 4 },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginBottom: 2 },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 12 },

  blob: { position: "absolute", borderRadius: 999, opacity: 0.33 },
  blobA: { width: 220, height: 220, top: 90, left: -60, backgroundColor: colors.blobA },
  blobB: { width: 260, height: 260, right: -80, bottom: 120, backgroundColor: colors.blobB },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  image: { width: "100%", height: 180, borderRadius: 12, marginBottom: 10 },
  cardTitle: { color: colors.textStrong, fontSize: 18, fontWeight: "900", marginBottom: 6 },
  meta: { color: colors.muted, fontSize: 14, marginBottom: 4 },
  location: { color: colors.muted, fontSize: 12 },
  readMore: { color: colors.accent, marginTop: 8, fontWeight: "800" },
});
