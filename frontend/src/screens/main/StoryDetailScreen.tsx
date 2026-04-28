import { ScrollView, StyleSheet, Text, View, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { RouteProp, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../../navigation/types";
import { STORIES } from "./stories";
import { colors } from "../../theme";

type StoryDetailRoute = RouteProp<RootStackParamList, "StoryDetail">;

export const StoryDetailScreen = () => {
  const route = useRoute<StoryDetailRoute>();
  const story = STORIES.find((s) => s.id === route.params.storyId);

  if (!story) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Story not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <LinearGradient colors={[colors.bg, colors.bgSoft, colors.bgWarm]} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{story.title}</Text>
        <Image source={{ uri: story.image }} style={styles.hero} />
        <Text style={styles.section}>{story.shortDescription}</Text>
        <Text style={styles.body}>{story.fullDescription}</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", marginBottom: 12 },
  hero: { width: "100%", height: 220, borderRadius: 14, marginBottom: 12 },
  section: { color: colors.textStrong, fontSize: 16, fontWeight: "800", marginBottom: 10 },
  body: { color: colors.muted, lineHeight: 22, fontSize: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  notFound: { color: colors.textStrong, fontSize: 16, fontWeight: "700" },
});
