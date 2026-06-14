import { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { apiRequest } from "../../services/api";

type FeedTab = "articles" | "campaigns";

type Story = {
  id: number;
  organization_id: number;
  title: string;
  narrative: string;
  image_url?: string | null;
  media_urls?: string | null;
  created_at: string;
};

type Campaign = {
  id: number;
  organization_id: number;
  title: string;
  description: string | null;
  image_url?: string | null;
  goals?: string | null;
  status: string;
  created_at: string;
};

export const FeedsScreen = () => {
  const { baseUrl, token, user } = useAuth();
  const { highContrast, screenReaderOptimized, textScale, touchTarget } = useAccessibility();
  const { t, translateStatus, translateText } = useLanguage();
  const { theme } = useThemeMode();
  const scopedOrganizationId =
    user?.role === "admin"
      ? user?.managed_branch_id ?? user?.organization_id
      : user?.organization_id;
  const isOrgManager = user?.role === "owner" || user?.role === "admin";

  const [tab, setTab] = useState<FeedTab>("articles");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    narrative: "",
    imageData: "",
    imageName: "",
  });
  const scaledText = (fontSize: number, lineHeight?: number) => ({
    fontSize: fontSize * textScale,
    ...(lineHeight ? { lineHeight: lineHeight * textScale } : {}),
  });
  const touchStyle = { minHeight: touchTarget };
  const highContrastCard = highContrast ? styles.highContrastCard : null;
  const highContrastInput = highContrast ? styles.highContrastInput : null;

  const load = async () => {
    setRefreshing(true);
    try {
      const [storyData, campaignData] = await Promise.all([
        apiRequest<Story[]>(
          baseUrl,
          `/api/stories/${
            scopedOrganizationId ? `?org_id=${scopedOrganizationId}&limit=20` : "?limit=20"
          }`,
          { method: "GET" },
          token
        ),
        apiRequest<Campaign[]>(
          baseUrl,
          `/api/campaigns/${
            scopedOrganizationId ? `?org_id=${scopedOrganizationId}&limit=20` : "?limit=20"
          }`,
          { method: "GET" },
          token
        ),
      ]);
      setStories(storyData);
      setCampaigns(campaignData);
    } catch {
      setStories([]);
      setCampaigns([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [baseUrl, token, scopedOrganizationId]);

  const deleteStory = async (storyId: number) => {
    Alert.alert(t("Delete") + " " + t("Article"), t("Are you sure you want to delete this article?"), [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(
              baseUrl,
              `/api/stories/${storyId}`,
              { method: "DELETE" },
              token
            );
            setStories((prev) => prev.filter((s) => s.id !== storyId));
            Alert.alert(t("Success"), t("Article deleted successfully"));
          } catch {
            Alert.alert(t("Error"), t("Failed to delete article"));
          }
        },
      },
    ]);
  };

  const deleteCampaign = async (campaignId: number) => {
    Alert.alert(
      t("Delete") + " " + t("Campaign"),
      t("Are you sure you want to delete this campaign?"),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest(
                baseUrl,
                `/api/campaigns/${campaignId}`,
                { method: "DELETE" },
                token
              );
              setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
              Alert.alert(t("Success"), t("Campaign deleted successfully"));
            } catch {
              Alert.alert(t("Error"), t("Failed to delete campaign"));
            }
          },
        },
      ]
    );
  };

  const openCreateModal = () => {
    setModalType("create");
    setEditingId(null);
    setFormData({ title: "", narrative: "", imageData: "", imageName: "" });
    setShowModal(true);
  };

  const openEditModal = (item: Story | Campaign) => {
    setModalType("edit");
    setEditingId(item.id);
    const narrative =
      "narrative" in item ? item.narrative : item.description || "";
    const imageData =
      "narrative" in item
        ? getStoryImage(item)
        : getCampaignImage(item);
    setFormData({
      title: item.title,
      narrative,
      imageData,
      imageName: imageData ? "existing-image" : "",
    });
    setShowModal(true);
  };

  const pickImageFile = () => {
    if (Platform.OS !== "web") {
      Alert.alert(t("Web only"), t("Please use web to pick an image from your computer."));
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        setFormData((prev) => ({
          ...prev,
          imageData: dataUrl,
          imageName: file.name,
        }));
      };
      reader.onerror = () => {
        Alert.alert(t("Error"), t("Failed to read selected image file."));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const getStoryImage = (story: Story): string => {
    if (story.image_url) {
      return story.image_url;
    }
    if (!story.media_urls) {
      return "";
    }
    try {
      const parsed = JSON.parse(story.media_urls);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
        return parsed[0];
      }
      return "";
    } catch {
      return "";
    }
  };

  const getCampaignImage = (campaign: Campaign): string => {
    if (campaign.image_url) {
      return campaign.image_url;
    }
    if (!campaign.goals) {
      return "";
    }
    try {
      const parsed = JSON.parse(campaign.goals) as { image_url?: string };
      return typeof parsed.image_url === "string" ? parsed.image_url : "";
    } catch {
      return "";
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.narrative.trim()) {
      Alert.alert(t("Validation"), t("Please fill in title and description"));
      return;
    }

    if (!scopedOrganizationId) {
      Alert.alert(t("Error"), t("Organization not found for this user"));
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        tab === "articles"
          ? modalType === "create"
            ? "/api/stories/"
            : `/api/stories/${editingId}`
          : modalType === "create"
            ? "/api/campaigns/"
            : `/api/campaigns/${editingId}`;

      const method = modalType === "create" ? "POST" : "PUT";
      const payload =
        tab === "articles"
          ? {
              organization_id: scopedOrganizationId,
              title: formData.title,
              narrative: formData.narrative,
              media_urls: formData.imageData
                ? JSON.stringify([formData.imageData])
                : null,
              image_url: formData.imageData || null,
            }
          : {
              organization_id: scopedOrganizationId,
              title: formData.title,
              description: formData.narrative,
              goals: formData.imageData
                ? JSON.stringify({ image_url: formData.imageData })
                : null,
              image_url: formData.imageData || null,
            };

      const result = await apiRequest<Story | Campaign>(
        baseUrl,
        endpoint,
        { method, body: JSON.stringify(payload) },
        token
      );

      if (tab === "articles") {
        const next = result as Story;
        setStories((prev) =>
          modalType === "create"
            ? [next, ...prev]
            : prev.map((s) => (s.id === editingId ? next : s))
        );
      } else {
        const next = result as Campaign;
        setCampaigns((prev) =>
          modalType === "create"
            ? [next, ...prev]
            : prev.map((c) => (c.id === editingId ? next : c))
        );
      }

      Alert.alert(
        t("Success"),
        `${tab === "articles" ? t("Article") : t("Campaign")} ${
          modalType === "create" ? t("created") : t("updated")
        } ${t("successfully")}`
      );
      setShowModal(false);
      setFormData({ title: "", narrative: "", imageData: "", imageName: "" });
    } catch {
      Alert.alert(
        t("Error"),
        `${t("Failed to")} ${modalType === "create" ? t("Create") : t("Update")} ${
          tab === "articles" ? t("Article") : t("Campaign")
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={theme.gradients.page}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={load}
            tintColor="#667EEA"
          />
        }
      >
        <Text style={[styles.title, scaledText(24, 30)]}>{t("Feeds")}</Text>
        <Text style={[styles.subtitle, scaledText(14, 20)]}>
          {t("Articles and campaigns for your organization")}
        </Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabBtn, touchStyle, tab === "articles" && styles.tabBtnActive, highContrast ? styles.highContrastTab : null]}
            onPress={() => setTab("articles")}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === "articles" }}
          >
            <Text style={[styles.tabText, scaledText(13, 18), tab === "articles" && styles.tabTextActive]}>
              {t("Articles")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, touchStyle, tab === "campaigns" && styles.tabBtnActive, highContrast ? styles.highContrastTab : null]}
            onPress={() => setTab("campaigns")}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === "campaigns" }}
          >
            <Text style={[styles.tabText, scaledText(13, 18), tab === "campaigns" && styles.tabTextActive]}>
              {t("Campaigns")}
            </Text>
          </Pressable>
        </View>

        {isOrgManager && (
          <Pressable style={[styles.createBtn, touchStyle]} onPress={openCreateModal} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? `${t("Create")} ${tab === "articles" ? t("Article") : t("Campaign")}` : undefined}>
            <Text style={[styles.createBtnText, scaledText(14, 19)]}>
              + {t("Create")} {tab === "articles" ? t("Article") : t("Campaign")}
            </Text>
          </Pressable>
        )}

        {tab === "articles" ? (
          <>
            {stories.map((story) => (
              <View key={story.id} style={[styles.card, highContrastCard]}>
                {getStoryImage(story) ? (
                  <Image source={{ uri: getStoryImage(story) }} style={styles.cardImage} />
                ) : null}
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, scaledText(15, 20)]}>{translateText(story.title)}</Text>
                  <Text style={[styles.cardBody, scaledText(13, 18)]} numberOfLines={3}>
                    {t("Description")}: {translateText(story.narrative)}
                  </Text>
                  <Text style={[styles.meta, scaledText(11, 16)]}>
                    {t("Story")} #{story.id} · {t("Date")}: {new Date(story.created_at).toLocaleDateString()}
                  </Text>
                  {isOrgManager && (
                    <View style={styles.cardActions}>
                      <Pressable style={[styles.actionBtn, touchStyle]} onPress={() => openEditModal(story)} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? `${t("Edit")} ${t("Article")} ${translateText(story.title)}` : undefined}>
                        <Text style={[styles.actionBtnText, scaledText(12, 17)]}>{t("Edit")}</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, styles.dangerBtn, touchStyle]}
                        onPress={() => deleteStory(story.id)}
                        accessibilityRole="button"
                        accessibilityLabel={screenReaderOptimized ? `${t("Delete")} ${t("Article")} ${translateText(story.title)}` : undefined}
                      >
                        <Text style={[styles.dangerBtnText, scaledText(12, 17)]}>{t("Delete")}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {stories.length === 0 ? <Text style={[styles.empty, scaledText(14, 20)]}>{t("No articles found.")}</Text> : null}
          </>
        ) : (
          <>
            {campaigns.map((campaign) => (
              <View key={campaign.id} style={[styles.card, highContrastCard]}>
                {getCampaignImage(campaign) ? (
                  <Image source={{ uri: getCampaignImage(campaign) }} style={styles.cardImage} />
                ) : null}
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, scaledText(15, 20)]}>{translateText(campaign.title)}</Text>
                  <Text style={[styles.cardBody, scaledText(13, 18)]} numberOfLines={3}>
                    {t("Description")}: {campaign.description ? translateText(campaign.description) : t("No description")}
                  </Text>
                  <Text style={[styles.meta, scaledText(11, 16)]}>{t("Campaign")} #{campaign.id} · {t("Status")}: {translateStatus(campaign.status)}</Text>
                  {isOrgManager && (
                    <View style={styles.cardActions}>
                      <Pressable style={[styles.actionBtn, touchStyle]} onPress={() => openEditModal(campaign)} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? `${t("Edit")} ${t("Campaign")} ${translateText(campaign.title)}` : undefined}>
                        <Text style={[styles.actionBtnText, scaledText(12, 17)]}>{t("Edit")}</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, styles.dangerBtn, touchStyle]}
                        onPress={() => deleteCampaign(campaign.id)}
                        accessibilityRole="button"
                        accessibilityLabel={screenReaderOptimized ? `${t("Delete")} ${t("Campaign")} ${translateText(campaign.title)}` : undefined}
                      >
                        <Text style={[styles.dangerBtnText, scaledText(12, 17)]}>{t("Delete")}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ))}
            {campaigns.length === 0 ? <Text style={[styles.empty, scaledText(14, 20)]}>{t("No campaigns found.")}</Text> : null}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, highContrastCard]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, scaledText(18, 23)]}>
                {modalType === "create" ? t("Create") : t("Edit")} {tab === "articles" ? t("Article") : t("Campaign")}
              </Text>
              <Pressable onPress={() => setShowModal(false)} style={touchStyle} accessibilityRole="button" accessibilityLabel={screenReaderOptimized ? t("Close editor") : undefined}>
                <Text style={[styles.closeBtn, scaledText(24, 28)]}>X</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, scaledText(13, 18)]}>{t("Title")}</Text>
              <TextInput
                style={[styles.input, touchStyle, highContrastInput, scaledText(14, 19)]}
                placeholder={t("Enter title")}
                placeholderTextColor="#8B8DA3"
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                accessibilityLabel={t("Title")}
              />

              <Text style={[styles.label, scaledText(13, 18)]}>{t("Description")}</Text>
              <TextInput
                style={[styles.input, styles.textArea, highContrastInput, scaledText(14, 19)]}
                placeholder={t("Enter description")}
                placeholderTextColor="#8B8DA3"
                value={formData.narrative}
                onChangeText={(text) => setFormData({ ...formData, narrative: text })}
                multiline
                numberOfLines={4}
                accessibilityLabel={t("Description")}
              />

              <Text style={[styles.label, scaledText(13, 18)]}>{t("Image (Optional)")}</Text>
              <Pressable style={[styles.filePickerBtn, touchStyle]} onPress={pickImageFile} accessibilityRole="button">
                <Text style={[styles.filePickerBtnText, scaledText(13, 18)]}>{t("Choose image from computer")}</Text>
              </Pressable>
              <Text style={[styles.fileNameText, scaledText(12, 17)]}>
                {formData.imageName || t("No image selected")}
              </Text>

              {formData.imageData ? (
                <Image source={{ uri: formData.imageData }} style={styles.previewImage} />
              ) : null}

              <Pressable
                style={[styles.submitBtn, touchStyle, loading && styles.submitBtnDisabled]}
                onPress={handleSave}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={[styles.submitBtnText, scaledText(14, 19)]}>{modalType === "create" ? t("Create") : t("Update")}</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },

  title: { color: "#FFF", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#8B8DA3", marginTop: 4, marginBottom: 14 },

  tabRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  tabBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    paddingVertical: 10,
  },
  tabBtnActive: {
    backgroundColor: "rgba(102,126,234,0.18)",
    borderColor: "rgba(102,126,234,0.4)",
  },
  highContrastTab: { borderColor: "#FFFFFF", borderWidth: 2 },
  tabText: { color: "#8B8DA3", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#667EEA" },

  createBtn: {
    marginVertical: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#667EEA",
    borderRadius: 8,
    alignItems: "center",
  },
  createBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginBottom: 10,
  },
  highContrastCard: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000" },
  cardImage: { width: "100%", height: 160, backgroundColor: "rgba(255,255,255,0.05)" },
  cardContent: { padding: 12 },
  cardTitle: { color: "#FFF", fontSize: 15, fontWeight: "700", marginBottom: 6 },
  cardBody: { color: "#BFC0CF", fontSize: 13, lineHeight: 18 },
  meta: { color: "#8B8DA3", fontSize: 11, marginTop: 8, marginBottom: 10 },
  cardActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "rgba(102,126,234,0.2)",
    borderRadius: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#667EEA",
  },
  dangerBtn: { backgroundColor: "rgba(255,71,87,0.2)", borderColor: "#FF4757" },
  actionBtnText: { color: "#667EEA", fontWeight: "600", fontSize: 12 },
  dangerBtnText: { color: "#FF4757", fontWeight: "600", fontSize: 12 },
  empty: { color: "#8B8DA3", marginTop: 20, textAlign: "center", fontSize: 14 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0F0C29",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: "#FFF", fontSize: 18, fontWeight: "700" },
  closeBtn: { color: "#8B8DA3", fontSize: 24, fontWeight: "bold" },

  formContainer: { marginBottom: 16 },
  label: { color: "#D8D9E3", fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFF",
    fontSize: 14,
  },
  highContrastInput: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000", color: "#FFFFFF" },
  textArea: { textAlignVertical: "top", minHeight: 100 },

  filePickerBtn: {
    marginTop: 2,
    backgroundColor: "rgba(102,126,234,0.2)",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.5)",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  filePickerBtnText: { color: "#CBD5FF", fontWeight: "600", fontSize: 13 },
  fileNameText: { color: "#A8ABBE", fontSize: 12, marginTop: 8 },

  previewImage: { width: "100%", height: 120, borderRadius: 8, marginTop: 10, marginBottom: 10 },

  submitBtn: {
    backgroundColor: "#667EEA",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
