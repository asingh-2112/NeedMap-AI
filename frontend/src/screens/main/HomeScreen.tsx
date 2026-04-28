import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { ImpactRibbon } from "../../components/ImpactRibbon";
import { useAuth } from "../../context/AuthContext";
import { moduleApi } from "../../services/api";
import { getLiveLocation } from "../../services/location";
import { CAMP_UPDATES, STORIES } from "./stories";
import type { RootStackParamList } from "../../navigation/types";
import { colors, fonts } from "../../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type MainTabRoute = "Profile" | "Volunteers" | "Needs" | "Organizations";

const NGO_GIF = "https://www.shutterstock.com/image-vector/ngo-nongovernmental-organization-serve-specific-260nw-2212923137.jpg";

export const HomeScreen = () => {
  const nav = useNavigation<Nav>();
  const { baseUrl, token, user } = useAuth();
  const FALLBACK_CAMP_IMAGE = "https://picsum.photos/seed/needmap-camp-fallback/400/250";
  const FALLBACK_STORY_IMAGE = "https://picsum.photos/seed/needmap-story-fallback/400/250";

  const [locationText, setLocationText] = useState("Fetching your address...");
  const [counts, setCounts] = useState({ needs: 0, volunteers: 0, organizations: 0 });
  const [campTitles, setCampTitles] = useState<string[]>([]);
  const [failedCampImages, setFailedCampImages] = useState<Record<string, boolean>>({});
  const [failedStoryImages, setFailedStoryImages] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    const load = async () => {
      try {
        const [needs, volunteers, organizations] = await Promise.all([
          moduleApi.needs(baseUrl, token),
          moduleApi.volunteers(baseUrl, token),
          moduleApi.organizations(baseUrl, token),
        ]);

        setCounts({
          needs: needs.length,
          volunteers: volunteers.length,
          organizations: organizations.length,
        });

        const latest = needs.slice(0, 4).map((n) => `${n.title} (${n.urgency})`);
        setCampTitles(latest);
      } catch {
        // Keep dashboard usable even if one endpoint fails.
      }
    };

    if (token) load();
  }, [baseUrl, token]);

  useEffect(() => {
    const loadAddress = async () => {
      try {
        const loc = await getLiveLocation();
        setLocationText(loc.address);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unable to fetch location.";
        setLocationText(msg);
        Alert.alert("Location", msg);
      }
    };

    if (user) loadAddress();
  }, [user]);

  const storyHighlights = useMemo(() => STORIES, []);

  const campCards = useMemo(() => {
    if (campTitles.length === 0) return CAMP_UPDATES;

    return campTitles.map((title, idx) => ({
      id: `dynamic-camp-${idx}`,
      title,
      urgency: CAMP_UPDATES[idx % CAMP_UPDATES.length].urgency,
      shortDescription: CAMP_UPDATES[idx % CAMP_UPDATES.length].shortDescription,
      image: CAMP_UPDATES[idx % CAMP_UPDATES.length].image,
      storyId: CAMP_UPDATES[idx % CAMP_UPDATES.length].storyId,
    }));
  }, [campTitles]);

  const goToMainTab = (screen: MainTabRoute) => {
    nav.navigate("MainTabs", { screen });
  };

  const yA = floatA.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const yB = floatB.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });

  return (
    <View style={styles.page}>
      <LinearGradient colors={[colors.bg, colors.bgSoft, colors.bgWarm]} style={StyleSheet.absoluteFillObject} />

      <Animated.View style={[styles.blob, styles.blobA, { transform: [{ translateY: yA }] }]} />
      <Animated.View style={[styles.blob, styles.blobB, { transform: [{ translateY: yB }] }]} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>NeedMap AI</Text>
        <Text style={styles.title}>Welcome, {user?.user_name || "Volunteer"}</Text>
        <ImpactRibbon needs={counts.needs} volunteers={counts.volunteers} organizations={counts.organizations} />
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>Role: {(user?.role || "volunteer").toUpperCase()}</Text>
        </View>
        <Text style={styles.subtitle}>Dark NGO mission control for rapid field decisions.</Text>

        <FadeInView delay={20} style={styles.heroVisualCard}>
          <Image source={{ uri: NGO_GIF }} style={styles.heroVisualImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <Text style={styles.heroVisualTitle}>Field Coordination Feed</Text>
          <Text style={styles.heroVisualText}>Visualize active response, volunteer motion, and source updates in one place.</Text>
        </FadeInView>

        <FadeInView delay={70} style={styles.card}>
          <Text style={styles.cardTitle}>Live Address</Text>
          <Text style={styles.meta}>{locationText}</Text>
        </FadeInView>

        <FadeInView delay={140} style={styles.cardRow}>
          <View style={styles.miniCard}>
            <Text style={styles.miniNum}>{counts.needs}</Text>
            <Text style={styles.meta}>Needs</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniNum}>{counts.volunteers}</Text>
            <Text style={styles.meta}>Volunteers</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniNum}>{counts.organizations}</Text>
            <Text style={styles.meta}>Organizations</Text>
          </View>
        </FadeInView>

        <FadeInView delay={220} style={styles.card}>
          <Text style={styles.cardTitle}>Modules</Text>
          <View style={styles.quickGrid}>
            <Pressable style={styles.quick} onPress={() => goToMainTab("Profile")}>
              <Text style={styles.quickText}>User</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => goToMainTab("Volunteers")}>
              <Text style={styles.quickText}>Volunteers</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => goToMainTab("Needs")}>
              <Text style={styles.quickText}>Needs</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => goToMainTab("Organizations")}>
              <Text style={styles.quickText}>Organizations</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => nav.navigate("Schemes")}>
              <Text style={styles.quickText}>Schemes</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => nav.navigate("Assignments")}>
              <Text style={styles.quickText}>Assignments</Text>
            </Pressable>
            <Pressable style={styles.quick} onPress={() => nav.navigate("Stories")}>
              <Text style={styles.quickText}>Stories</Text>
            </Pressable>
          </View>
        </FadeInView>

        <FadeInView delay={300} style={styles.card}>
          <Text style={styles.cardTitle}>Story Highlights</Text>
          {storyHighlights.map((item) => (
            <Pressable
              key={item.id}
              style={styles.storyCard}
              onPress={() => nav.navigate("StoryDetail", { storyId: item.id })}
            >
              <Image
                source={{ uri: failedStoryImages[item.id] ? FALLBACK_STORY_IMAGE : item.image }}
                style={styles.storyImage}
                onError={() =>
                  setFailedStoryImages((prev) => ({
                    ...prev,
                    [item.id]: true,
                  }))
                }
              />
              <View style={styles.storyTextWrap}>
                <Text style={styles.storyTitle}>{item.title}</Text>
                <Text style={styles.storyDesc} numberOfLines={1}>
                  {item.shortDescription}
                </Text>
              </View>
            </Pressable>
          ))}
        </FadeInView>

        <FadeInView delay={380} style={styles.card}>
          <Text style={styles.cardTitle}>Updated Camps</Text>
          {campCards.length === 0 ? (
            <Text style={styles.meta}>No latest camp data yet.</Text>
          ) : (
            campCards.map((camp) => (
              <Pressable
                key={camp.id}
                style={styles.campCard}
                onPress={() => nav.navigate("StoryDetail", { storyId: camp.storyId })}
              >
                <Image
                  source={{ uri: failedCampImages[camp.id] ? FALLBACK_CAMP_IMAGE : camp.image }}
                  style={styles.campImage}
                  onError={() =>
                    setFailedCampImages((prev) => ({
                      ...prev,
                      [camp.id]: true,
                    }))
                  }
                />
                <View style={styles.campTextWrap}>
                  <Text style={styles.campTitle}>{camp.title}</Text>
                  <Text style={styles.campDesc} numberOfLines={1}>
                    {camp.shortDescription}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </FadeInView>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 36 },

  brand: { color: colors.accent, fontSize: 22, fontWeight: "900", marginBottom: 4, fontFamily: fonts.accent },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginBottom: 2, fontFamily: fonts.heading },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: "rgba(39,176,125,0.18)",
    borderColor: "rgba(39,176,125,0.45)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  roleBadgeText: { color: colors.textStrong, fontSize: 12, fontWeight: "900", fontFamily: fonts.body },
  subtitle: { color: colors.muted, fontSize: 14, marginBottom: 12, fontFamily: fonts.body },

  blob: { position: "absolute", borderRadius: 999, opacity: 0.33 },
  blobA: { width: 220, height: 220, top: 80, left: -60, backgroundColor: colors.blobA },
  blobB: { width: 260, height: 260, right: -80, bottom: 120, backgroundColor: colors.blobB },

  heroVisualCard: {
    height: 170,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "flex-end",
    padding: 12,
  },
  heroVisualImage: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0 },
  heroOverlay: { width: "100%", height: "100%", position: "absolute", top: 0, left: 0, backgroundColor: "rgba(4,12,18,0.60)" },
  heroVisualTitle: { color: colors.textStrong, fontSize: 18, fontWeight: "900", marginBottom: 4, fontFamily: fonts.heading },
  heroVisualText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: fonts.body },

  card: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  cardRow: { flexDirection: "row", gap: 10, marginBottom: 12 },

  miniCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },

  miniNum: { color: colors.textStrong, fontSize: 24, fontWeight: "900", fontFamily: fonts.heading },
  cardTitle: { color: colors.textStrong, fontSize: 18, fontWeight: "900", marginBottom: 8, fontFamily: fonts.heading },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20, fontFamily: fonts.body },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quick: {
    width: "48%",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { color: colors.textStrong, fontWeight: "800", textAlign: "center", fontFamily: fonts.body },

  storyCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
  },
  storyImage: { width: 84, height: 64, borderRadius: 8 },
  storyTextWrap: { flex: 1, justifyContent: "center" },
  storyTitle: { color: colors.textStrong, fontWeight: "800", marginBottom: 4, fontFamily: fonts.body },
  storyDesc: { color: colors.muted, fontSize: 13, fontFamily: fonts.body },

  campCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    marginBottom: 10,
  },
  campImage: { width: 84, height: 64, borderRadius: 8 },
  campTextWrap: { flex: 1, justifyContent: "center" },
  campTitle: { color: colors.textStrong, fontWeight: "800", marginBottom: 4, fontFamily: fonts.body },
  campDesc: { color: colors.muted, fontSize: 13, fontFamily: fonts.body },
});
