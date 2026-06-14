import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { apiRequest, moduleApi } from "../../services/api";
import type { RootStackParamList } from "../../navigation/types";
import { getLiveLocation } from "../../services/location";
import type { Assignment, Need } from "../../types/api";

const CATEGORIES = [
  "water_access", "food", "shelter", "health", "education",
  "sanitation", "clothing", "legal_aid", "mental_health", "transportation", "other",
] as const;

const URGENCIES = ["critical", "high", "medium", "low"] as const;
const FILTER_URGENCIES = ["all", ...URGENCIES] as const;
const FILTER_CATEGORIES = ["all", ...CATEGORIES] as const;

const displayCategory = (value: string) => {
  if (value === "other") return "others";
  return value.replace("_", " ");
};

const SOURCE_TYPES = [
  { key: "text", label: "Text / Field Notes", icon: "📝" },
  { key: "voice", label: "Voice Note", icon: "🎙️" },
  { key: "image", label: "Image / OCR", icon: "📷" },
  { key: "pdf", label: "PDF Document", icon: "📄" },
  { key: "csv", label: "CSV Upload", icon: "📊" },
  { key: "manual", label: "Manual Form", icon: "✍️" },
] as const;

type SourceKey = (typeof SOURCE_TYPES)[number]["key"];
type Nav = NativeStackNavigationProp<RootStackParamList>;

type IngestResponse = {
  category: string;
  urgency: string;
  location: string | null;
  description: string;
  skills_required: string[];
  affected_count: number | null;
  confidence: number;
  model_used: string;
  need_id: number | null;
  source_id: number | null;
  raw_text: string;
};

type PickedUpload = {
  uri: string;
  name: string;
  type: string;
  file?: Blob;
};

export const NeedsScreen = () => {
  const nav = useNavigation<Nav>();
  const { baseUrl, token, user } = useAuth();
  const { theme } = useThemeMode();
  const isLight = theme.mode === "light";
  const lightPrimary = isLight ? { color: "#0B1220", fontWeight: "800" as const } : null;
  const lightSecondary = isLight ? { color: "#111827", fontWeight: "700" as const } : null;
  const lightCard = isLight ? { borderColor: "#000000", borderWidth: 2, backgroundColor: "rgba(255,255,255,0.97)" } : null;
  const lightInput = isLight ? { borderColor: "#000000", borderWidth: 2, color: "#0B1220", fontWeight: "700" as const, backgroundColor: "#FFFFFF" } : null;
  const scopedOrganizationId = user?.role === "admin" ? user?.managed_branch_id ?? user?.organization_id : user?.organization_id;
  const isOwner = user?.role === "owner";
  const [items, setItems] = useState<Need[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSource, setActiveSource] = useState<SourceKey>("manual");
  const [createNeedFile, setCreateNeedFile] = useState<PickedUpload | null>(null);
  const [showCreateCategoryDropdown, setShowCreateCategoryDropdown] = useState(false);
  const [showCreateUrgencyDropdown, setShowCreateUrgencyDropdown] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState<(typeof FILTER_URGENCIES)[number]>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<(typeof FILTER_CATEGORIES)[number]>("all");
  const [showUrgencyDropdown, setShowUrgencyDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Manual form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("water_access");
  const [urgency, setUrgency] = useState<(typeof URGENCIES)[number]>("medium");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  // Ingest fields
  const [rawText, setRawText] = useState("");
  const [voiceTranscription, setVoiceTranscription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [csvText, setCsvText] = useState("");
  const [voiceFile, setVoiceFile] = useState<PickedUpload | null>(null);
  const [imageFile, setImageFile] = useState<PickedUpload | null>(null);
  const [pdfFile, setPdfFile] = useState<PickedUpload | null>(null);
  const [csvFile, setCsvFile] = useState<PickedUpload | null>(null);

  // State
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResponse | null>(null);

  const isOrgManager = user?.role === "owner" || user?.role === "admin";

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeIn]);

  const load = async () => {
    setRefreshing(true);
    try {
      const needFilters = isOrgManager
        ? (isOwner ? undefined : (scopedOrganizationId ? { organization_id: scopedOrganizationId } : undefined))
        : undefined;

      const assignmentFilters = isOrgManager
        ? (isOwner ? undefined : (scopedOrganizationId ? { organization_id: scopedOrganizationId } : undefined))
        : undefined;

      const [data, assignmentData] = await Promise.all([
        moduleApi.needs(
          baseUrl,
          token,
          needFilters,
        ),
        moduleApi.assignments(
          baseUrl,
          token,
          assignmentFilters,
        ),
      ]);
      setItems(data);
      setAssignments(assignmentData);
    } catch {
      setItems([]);
      setAssignments([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [baseUrl, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [baseUrl, token, user?.role, scopedOrganizationId]),
  );

  const fetchMyLocation = async () => {
    try {
      const loc = await getLiveLocation();
      setLatitude(String(loc.latitude));
      setLongitude(String(loc.longitude));
      setAddress(loc.address);
    } catch {
      Alert.alert("Location Error", "Could not fetch your location.");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCustomCategory("");
    setAddress("");
    setLatitude("");
    setLongitude("");
    setCreateNeedFile(null);
    setRawText("");
    setVoiceTranscription("");
    setImageUrl("");
    setPdfUrl("");
    setCsvText("");
    setVoiceFile(null);
    setImageFile(null);
    setPdfFile(null);
    setCsvFile(null);
    setIngestResult(null);
    setSubmitMessage(null);
  };

  const pickFile = async (
    source: "voice" | "image" | "pdf" | "csv",
    mimeTypes: string[],
  ) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes,
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];
      const picked: PickedUpload = {
        uri: asset.uri,
        name: asset.name ?? `${source}-${Date.now()}`,
        type: asset.mimeType ?? "application/octet-stream",
        file: (asset as { file?: Blob }).file,
      };

      if (source === "voice") setVoiceFile(picked);
      if (source === "image") setImageFile(picked);
      if (source === "pdf") setPdfFile(picked);
      if (source === "csv") setCsvFile(picked);

      setSubmitMessage({ text: `Selected file: ${picked.name}`, type: "success" });
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : "File selection failed.", type: "error" });
    }
  };

  const pickCreateNeedFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*", "audio/*"],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets.length) return;

      const asset = result.assets[0];
      const picked: PickedUpload = {
        uri: asset.uri,
        name: asset.name ?? `need-file-${Date.now()}`,
        type: asset.mimeType ?? "application/octet-stream",
        file: (asset as { file?: Blob }).file,
      };
      setCreateNeedFile(picked);
      setSubmitMessage({ text: `Selected file: ${picked.name}`, type: "success" });
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : "File selection failed.", type: "error" });
    }
  };

  // Submit manual need creation
  const submitManualNeed = async () => {
    if (!scopedOrganizationId) return;
    if (!description.trim() || !address.trim()) {
      setSubmitMessage({ text: "Description and Address are required.", type: "error" });
      return;
    }
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const generatedTitle = title.trim() || description.trim().split(/\s+/).slice(0, 8).join(" ");
      const finalDescription = category === "other" && customCategory.trim()
        ? `${description.trim()}\n\nCustom Category: ${customCategory.trim()}`
        : description.trim();

      const createdNeed = await moduleApi.createNeed(baseUrl, token, {
        title: generatedTitle,
        description: finalDescription || undefined,
        category,
        urgency,
        organization_id: scopedOrganizationId,
        latitude: Number(latitude) || 0,
        longitude: Number(longitude) || 0,
        address: address.trim(),
      });

      if (createNeedFile) {
        const sourceType: "image" | "voice_note" | "document" =
          createNeedFile.type.startsWith("image/")
            ? "image"
            : createNeedFile.type.startsWith("audio/")
              ? "voice_note"
              : "document";

        await moduleApi.addNeedSourceUpload(baseUrl, token, createdNeed.id, {
          source_type: sourceType,
          file: createNeedFile,
          location: address.trim() || undefined,
        });
      }

      setSubmitMessage({ text: "Need created successfully!", type: "success" });
      resetForm();
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : "Failed to create need.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit text ingest
  const submitTextIngest = async () => {
    if (!scopedOrganizationId || !rawText.trim()) {
      setSubmitMessage({ text: "Please enter field notes or text.", type: "error" });
      return;
    }
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const result = await apiRequest<IngestResponse>(
        baseUrl,
        "/needs/ingest/text",
        { method: "POST", body: JSON.stringify({
          raw_text: rawText.trim(),
          organization_id: scopedOrganizationId,
          latitude: Number(latitude) || 0,
          longitude: Number(longitude) || 0,
          address: address.trim() || "Auto-extracted",
          create_need: true,
        })},
        token,
      );
      setIngestResult(result);
      setSubmitMessage({ text: `AI extracted need (confidence: ${(result.confidence * 100).toFixed(0)}%). Need #${result.need_id} created.`, type: "success" });
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : "Text ingest failed.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit voice ingest
  const submitVoiceIngest = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: "Organization context is required.", type: "error" });
      return;
    }
    if (!voiceFile && !voiceTranscription.trim()) {
      setSubmitMessage({ text: "Upload an audio file or enter transcription.", type: "error" });
      return;
    }
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const result = voiceFile
        ? await moduleApi.ingestUploadFile(baseUrl, token, {
            source_type: "voice_note",
            file: voiceFile,
            organization_id: scopedOrganizationId,
            latitude: Number(latitude) || 0,
            longitude: Number(longitude) || 0,
            address: address.trim() || "Auto-extracted",
            create_need: true,
          })
        : await apiRequest<IngestResponse>(
            baseUrl,
            "/needs/ingest/voice",
            {
              method: "POST",
              body: JSON.stringify({
                transcription: voiceTranscription.trim(),
                organization_id: scopedOrganizationId,
                latitude: Number(latitude) || 0,
                longitude: Number(longitude) || 0,
                address: address.trim() || "Auto-extracted",
                create_need: true,
              }),
            },
            token,
          );
      setIngestResult(result);
      setSubmitMessage({ text: `Voice processed (confidence: ${(result.confidence * 100).toFixed(0)}%). Need #${result.need_id} created.`, type: "success" });
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : "Voice ingest failed.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit image OCR
  const submitImageOCR = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: "Organization context is required.", type: "error" });
      return;
    }
    if (!imageFile && !imageUrl.trim()) {
      setSubmitMessage({ text: "Upload an image file or provide an image URL.", type: "error" });
      return;
    }
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      if (imageFile) {
        const result = await moduleApi.ingestUploadFile(baseUrl, token, {
          source_type: "image",
          file: imageFile,
          organization_id: scopedOrganizationId,
          latitude: Number(latitude) || 0,
          longitude: Number(longitude) || 0,
          address: address.trim() || "Auto-extracted",
          create_need: true,
        });
        setIngestResult(result);
        setSubmitMessage({ text: `Image processed (confidence: ${(result.confidence * 100).toFixed(0)}%). Need #${result.need_id} created.`, type: "success" });
      } else {
        const result = await apiRequest<{ source_id: number | null; need_id: number | null; multimedia_txt: string; ai_extraction: string; structured: Record<string, unknown>; category_hint: string | null; urgency_hint: string | null }>(
          baseUrl,
          "/needs/ocr-extract",
          { method: "POST", body: JSON.stringify({ image_url: imageUrl.trim() })},
          token,
        );
        setSubmitMessage({ text: `OCR extracted: ${result.category_hint || "unknown"} category, ${result.urgency_hint || "unknown"} urgency. Source #${result.source_id} created.`, type: "success" });
      }
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : "Image OCR failed.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit PDF ingest
  const submitPdfIngest = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: "Organization context is required.", type: "error" });
      return;
    }
    if (!pdfFile && !pdfUrl.trim()) {
      setSubmitMessage({ text: "Upload a PDF file or provide a PDF URL.", type: "error" });
      return;
    }
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const result = pdfFile
        ? await moduleApi.ingestUploadFile(baseUrl, token, {
            source_type: "document",
            file: pdfFile,
            organization_id: scopedOrganizationId,
            latitude: Number(latitude) || 0,
            longitude: Number(longitude) || 0,
            address: address.trim() || "Auto-extracted",
            create_need: true,
          })
        : await apiRequest<IngestResponse>(
            baseUrl,
            "/needs/ingest/pdf",
            {
              method: "POST",
              body: JSON.stringify({
                pdf_url: pdfUrl.trim(),
                organization_id: scopedOrganizationId,
                latitude: Number(latitude) || 0,
                longitude: Number(longitude) || 0,
                address: address.trim() || "Auto-extracted",
                create_need: true,
              }),
            },
            token,
          );
      setIngestResult(result);
      setSubmitMessage({ text: `PDF processed (confidence: ${(result.confidence * 100).toFixed(0)}%). Need #${result.need_id} created.`, type: "success" });
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : "PDF ingest failed.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit CSV source
  const submitCsvSource = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: "Organization context is required.", type: "error" });
      return;
    }
    if (!csvFile && !csvText.trim()) {
      setSubmitMessage({ text: "Upload a CSV file or paste CSV content.", type: "error" });
      return;
    }

    if (csvFile) {
      setSubmitting(true);
      try {
        const result = await moduleApi.ingestUploadFile(baseUrl, token, {
          source_type: "csv_upload",
          file: csvFile,
          organization_id: scopedOrganizationId,
          latitude: Number(latitude) || 0,
          longitude: Number(longitude) || 0,
          address: address.trim() || "CSV upload",
          create_need: true,
        });
        setIngestResult(result);
        setSubmitMessage({ text: `CSV processed (confidence: ${(result.confidence * 100).toFixed(0)}%). Need #${result.need_id} created.`, type: "success" });
        load();
      } catch (err) {
        setSubmitMessage({ text: err instanceof Error ? err.message : "CSV submit failed.", type: "error" });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Text fallback: add pasted CSV as a source to the latest need.
    if (items.length > 0) {
      setSubmitting(true);
      try {
        await moduleApi.addNeedSource(baseUrl, token, items[0].id, {
          source_type: "csv_upload",
          location: address.trim() || "CSV upload",
          multimedia_txt: csvText.trim(),
        });
        setSubmitMessage({ text: "CSV source added to most recent need.", type: "success" });
        setCsvText("");
      } catch (err) {
        setSubmitMessage({ text: err instanceof Error ? err.message : "CSV submit failed.", type: "error" });
      } finally {
        setSubmitting(false);
      }
    } else {
      setSubmitMessage({ text: "No needs exist. Create a need first, then add CSV source.", type: "error" });
    }
  };

  const handleSubmit = () => {
    switch (activeSource) {
      case "manual": submitManualNeed(); break;
      case "text": submitTextIngest(); break;
      case "voice": submitVoiceIngest(); break;
      case "image": submitImageOCR(); break;
      case "pdf": submitPdfIngest(); break;
      case "csv": submitCsvSource(); break;
    }
  };

  const attachSelectedSourceToNeed = async (needId: number) => {
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      if (activeSource === "image" && imageFile) {
        await moduleApi.addNeedSourceUpload(baseUrl, token, needId, {
          source_type: "image",
          file: imageFile,
          location: address.trim() || undefined,
        });
      } else if (activeSource === "voice" && voiceFile) {
        await moduleApi.addNeedSourceUpload(baseUrl, token, needId, {
          source_type: "voice_note",
          file: voiceFile,
          location: address.trim() || undefined,
        });
      } else if (activeSource === "pdf" && pdfFile) {
        await moduleApi.addNeedSourceUpload(baseUrl, token, needId, {
          source_type: "document",
          file: pdfFile,
          location: address.trim() || undefined,
        });
      } else if (activeSource === "csv" && csvFile) {
        await moduleApi.addNeedSourceUpload(baseUrl, token, needId, {
          source_type: "csv_upload",
          file: csvFile,
          location: address.trim() || undefined,
        });
      } else if (activeSource === "csv" && csvText.trim()) {
        await moduleApi.addNeedSource(baseUrl, token, needId, {
          source_type: "csv_upload",
          location: address.trim() || "CSV upload",
          multimedia_txt: csvText.trim(),
        });
      } else {
        setSubmitMessage({ text: "Select a file (or CSV text) in the source tabs before attaching.", type: "error" });
        return;
      }

      setSubmitMessage({ text: `Source attached to Need #${needId}.`, type: "success" });
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : "Failed to attach source.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const urgencyColor = (u: string) => {
    switch (u.toLowerCase()) {
      case "critical": return "#FF4757";
      case "high": return "#FF6B6B";
      case "medium": return "#FFA502";
      case "low": return "#2ED573";
      default: return "#667EEA";
    }
  };

  const displayedItems = useMemo(() => {
    const urgencyRank: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...items]
      .filter((n) => !["closed", "resolved"].includes(n.status?.toLowerCase?.() ?? ""))
      .filter((n) => selectedUrgencyFilter === "all" || n.urgency === selectedUrgencyFilter)
      .filter((n) => selectedCategoryFilter === "all" || n.category === selectedCategoryFilter)
      .sort((a, b) => {
        const urgencyDiff = (urgencyRank[a.urgency] ?? 99) - (urgencyRank[b.urgency] ?? 99);
        if (urgencyDiff !== 0) return urgencyDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [items, selectedUrgencyFilter, selectedCategoryFilter]);

  const assignmentByNeed = useMemo(() => {
    const rankByStatus: Record<Assignment["status"], number> = {
      in_progress: 0,
      accepted: 1,
      assigned: 2,
      proposed: 3,
      completed: 4,
      declined: 5,
      cancelled: 6,
    };

    const grouped = new Map<number, Assignment[]>();
    assignments.forEach((a) => {
      const list = grouped.get(a.need_id) ?? [];
      list.push(a);
      grouped.set(a.need_id, list);
    });

    const selected = new Map<number, Assignment>();
    grouped.forEach((list, needId) => {
      const sorted = [...list].sort((a, b) => {
        const rankDiff = (rankByStatus[a.status] ?? 99) - (rankByStatus[b.status] ?? 99);
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime();
      });
      if (sorted.length > 0) {
        selected.set(needId, sorted[0]);
      }
    });

    return selected;
  }, [assignments]);

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={theme.gradients.page}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <Animated.View style={{ flex: 1, opacity: fadeIn }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#667EEA" />}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.pageTitle, lightPrimary]}>Needs</Text>
              <Text style={[styles.pageSubtitle, lightSecondary]}>
                {isOrgManager ? "Create & manage community needs" : "Browse active community needs"}
              </Text>
            </View>
            {isOrgManager ? (
              <Pressable
                style={[styles.createToggle, showCreate && styles.createToggleActive]}
                onPress={() => { setShowCreate(!showCreate); setSubmitMessage(null); }}
              >
                <Text style={[styles.createToggleText, lightPrimary]}>{showCreate ? "Close" : "+ Create"}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* CREATE NEED FORM */}
          {showCreate && isOrgManager ? (
            <View style={[styles.formCard, lightCard]}>
              <Text style={[styles.formTitle, lightPrimary]}>Create New Need</Text>
              <Text style={[styles.formSubtitle, lightSecondary]}>Upload optional file, then fill details and create need</Text>

              <View style={styles.formFields}>
                <Text style={[styles.label, lightSecondary]}>Optional File Upload (PDF / Image / Audio)</Text>
                <Pressable style={styles.filePickBtn} onPress={pickCreateNeedFile}>
                  <Text style={[styles.filePickBtnText, lightPrimary]}>Choose File</Text>
                </Pressable>
                {createNeedFile ? <Text style={[styles.fileName, lightSecondary]}>Selected: {createNeedFile.name}</Text> : null}

                <Text style={[styles.label, lightSecondary]}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, lightInput]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe need details..."
                  placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                  multiline
                  numberOfLines={5}
                />

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={[styles.label, lightSecondary]}>Category</Text>
                    <Pressable
                      style={[styles.selectBtn, lightInput]}
                      onPress={() => {
                        setShowCreateCategoryDropdown((prev) => !prev);
                        setShowCreateUrgencyDropdown(false);
                      }}
                    >
                      <Text style={[styles.selectText, lightPrimary]}>{displayCategory(category)}</Text>
                    </Pressable>
                    {showCreateCategoryDropdown ? (
                      <View style={[styles.filterDropdown, lightCard]}>
                        {CATEGORIES.map((c) => (
                          <Pressable
                            key={c}
                            style={styles.filterOption}
                            onPress={() => {
                              setCategory(c);
                              setShowCreateCategoryDropdown(false);
                            }}
                          >
                            <Text style={[styles.filterOptionText, lightPrimary]}>{displayCategory(c)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.col}>
                    <Text style={[styles.label, lightSecondary]}>Urgency</Text>
                    <Pressable
                      style={[styles.selectBtn, lightInput, { borderColor: urgencyColor(urgency) }]}
                      onPress={() => {
                        setShowCreateUrgencyDropdown((prev) => !prev);
                        setShowCreateCategoryDropdown(false);
                      }}
                    >
                      <Text style={[styles.selectText, { color: urgencyColor(urgency), fontWeight: isLight ? "800" : "600" }]}>{urgency}</Text>
                    </Pressable>
                    {showCreateUrgencyDropdown ? (
                      <View style={[styles.filterDropdown, lightCard]}>
                        {URGENCIES.map((u) => (
                          <Pressable
                            key={u}
                            style={styles.filterOption}
                            onPress={() => {
                              setUrgency(u);
                              setShowCreateUrgencyDropdown(false);
                            }}
                          >
                            <Text style={[styles.filterOptionText, lightPrimary]}>{u}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>

                {category === "other" ? (
                  <>
                    <Text style={[styles.label, lightSecondary]}>Custom Category</Text>
                    <TextInput
                      style={[styles.input, lightInput]}
                      value={customCategory}
                      onChangeText={setCustomCategory}
                      placeholder="Enter custom category (e.g. medicine kits, baby care, rescue support)"
                      placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                    />
                  </>
                ) : null}

                <Text style={[styles.label, lightSecondary]}>Location</Text>
                <TextInput
                  style={[styles.input, lightInput]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Full address"
                  placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                />
                <View style={styles.row}>
                  <View style={styles.col}>
                    <TextInput
                      style={[styles.input, lightInput]}
                      value={latitude}
                      onChangeText={setLatitude}
                      placeholder="Latitude"
                      placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.col}>
                    <TextInput
                      style={[styles.input, lightInput]}
                      value={longitude}
                      onChangeText={setLongitude}
                      placeholder="Longitude"
                      placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                      keyboardType="numeric"
                    />
                  </View>
                  <Pressable style={styles.locBtn} onPress={fetchMyLocation}>
                    <Text style={[styles.locBtnText, lightPrimary]}>📍 Auto</Text>
                  </Pressable>
                </View>
              </View>

              {/* Submit */}
              <Pressable
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={submitManualNeed}
                disabled={submitting}
              >
                <LinearGradient colors={["#667EEA", "#764BA2"]} style={styles.submitGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {submitting ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={[styles.submitText, isLight ? { color: "#0B1220", fontWeight: "900" } : null]}>Create Need</Text>
                  )}
                </LinearGradient>
              </Pressable>

              {/* Result messages */}
              {submitMessage ? (
                <View style={[styles.msgBox, submitMessage.type === "success" ? styles.msgSuccess : styles.msgError]}>
                  <Text style={[styles.msgText, isLight ? { color: "#0B1220", fontWeight: "800" } : null]}>{submitMessage.text}</Text>
                </View>
              ) : null}

              {/* AI extraction result */}
              {ingestResult ? (
                <View style={[styles.resultCard, lightCard]}>
                  <Text style={[styles.resultTitle, lightPrimary]}>AI Extraction Result</Text>
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, lightSecondary]}>Category:</Text>
                    <Text style={[styles.resultValue, lightPrimary]}>{ingestResult.category}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Urgency:</Text>
                    <Text style={[styles.resultValue, { color: urgencyColor(ingestResult.urgency) }]}>{ingestResult.urgency}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, lightSecondary]}>Location:</Text>
                    <Text style={[styles.resultValue, lightPrimary]}>{ingestResult.location || "—"}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Affected:</Text>
                    <Text style={styles.resultValue}>{ingestResult.affected_count ?? "—"}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Confidence:</Text>
                    <Text style={styles.resultValue}>{(ingestResult.confidence * 100).toFixed(0)}%</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Model:</Text>
                    <Text style={styles.resultValue}>{ingestResult.model_used}</Text>
                  </View>
                  {ingestResult.skills_required.length > 0 ? (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>Skills:</Text>
                      <Text style={styles.resultValue}>{ingestResult.skills_required.join(", ")}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* NEEDS LIST */}
          <View style={styles.listHeader}>
            <Text style={[styles.listTitle, lightPrimary]}>
              {isOrgManager ? "Your Organization's Needs" : "All Active Needs"}
            </Text>
            <Text style={[styles.listCount, lightSecondary]}>{displayedItems.length} shown</Text>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterCol}>
              <Text style={[styles.filterLabel, lightSecondary]}>Urgency</Text>
              <Pressable
                style={[styles.filterSelectBtn, lightInput]}
                onPress={() => {
                  setShowUrgencyDropdown((prev) => !prev);
                  setShowCategoryDropdown(false);
                }}
              >
                <Text style={[styles.filterSelectText, lightPrimary]}>{selectedUrgencyFilter}</Text>
                <Text style={[styles.filterChevron, lightPrimary]}>▼</Text>
              </Pressable>
              {showUrgencyDropdown ? (
                <View style={[styles.filterDropdown, lightCard]}>
                  {FILTER_URGENCIES.map((u) => (
                    <Pressable
                      key={u}
                      style={styles.filterOption}
                      onPress={() => {
                        setSelectedUrgencyFilter(u);
                        setShowUrgencyDropdown(false);
                      }}
                    >
                      <Text style={[styles.filterOptionText, lightPrimary]}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.filterCol}>
              <Text style={[styles.filterLabel, lightSecondary]}>Category</Text>
              <Pressable
                style={[styles.filterSelectBtn, lightInput]}
                onPress={() => {
                  setShowCategoryDropdown((prev) => !prev);
                  setShowUrgencyDropdown(false);
                }}
              >
                <Text style={[styles.filterSelectText, lightPrimary]}>{selectedCategoryFilter.replace("_", " ")}</Text>
                <Text style={[styles.filterChevron, lightPrimary]}>▼</Text>
              </Pressable>
              {showCategoryDropdown ? (
                <View style={[styles.filterDropdown, lightCard]}>
                  {FILTER_CATEGORIES.map((c) => (
                    <Pressable
                      key={c}
                      style={styles.filterOption}
                      onPress={() => {
                        setSelectedCategoryFilter(c);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={[styles.filterOptionText, lightPrimary]}>{displayCategory(c)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          {displayedItems.map((n) => {
            const topAssignment = assignmentByNeed.get(n.id);
            return (
            <Pressable key={n.id} style={[styles.needCard, lightCard]} onPress={() => nav.navigate("NeedDetail", { needId: n.id })}>
              <View style={styles.needHeader}>
                <Text style={[styles.needTitle, lightPrimary]} numberOfLines={1}>{n.title}</Text>
                <View style={[styles.urgencyBadge, { backgroundColor: `${urgencyColor(n.urgency)}20`, borderColor: urgencyColor(n.urgency) }]}>
                  <Text style={[styles.urgencyText, { color: urgencyColor(n.urgency) }]}>{n.urgency}</Text>
                </View>
              </View>
              {n.description ? (
                <Text style={[styles.needDesc, lightSecondary]} numberOfLines={2}>{n.description}</Text>
              ) : null}
              <View style={styles.needMeta}>
                <Text style={[styles.needMetaText, lightSecondary]}>
                  {n.category.replace("_", " ")} · {n.status} · {n.address}
                </Text>
              </View>
              {n.priority_score != null ? (
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreLabel, lightSecondary]}>Priority Score:</Text>
                  <Text style={[styles.scoreValue, lightPrimary]}>{n.priority_score.toFixed(2)}</Text>
                </View>
              ) : null}

              {topAssignment ? (
                <View style={styles.assigneeRow}>
                  <Text style={styles.assigneeLabel}>Assigned Volunteer:</Text>
                  <Text style={styles.assigneeValue}>#{topAssignment.volunteer_id}</Text>
                  <Text style={styles.assigneeMeta}>
                    {topAssignment.status.replace("_", " ")} · {new Date(topAssignment.assigned_at).toLocaleDateString()}
                  </Text>
                </View>
              ) : null}

              {isOrgManager ? (
                <View style={styles.needActionsRow}>
                  {!isOwner ? (
                    <Pressable
                      style={[styles.needActionBtn, styles.attachActionBtn]}
                      onPress={(e) => { e.stopPropagation(); attachSelectedSourceToNeed(n.id); }}
                      disabled={submitting}
                    >
                      <Text style={styles.needActionText}>Attach Selected Source</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
            );
          })}

          {displayedItems.length === 0 && !refreshing ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No needs found</Text>
              <Text style={styles.emptySubtitle}>
                {isOrgManager ? "Create your first need using the form above." : "Pull to refresh for latest needs."}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  pageSubtitle: { fontSize: 13, color: "#8B8DA3", marginTop: 4 },
  createToggle: {
    backgroundColor: "rgba(102,126,234,0.15)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.3)",
  },
  createToggleActive: {
    backgroundColor: "rgba(255,75,75,0.15)",
    borderColor: "rgba(255,75,75,0.3)",
  },
  createToggleText: { color: "#667EEA", fontSize: 13, fontWeight: "700" },

  // Form card
  formCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  formTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },
  formSubtitle: { fontSize: 12, color: "#8B8DA3", marginBottom: 16 },

  // Tabs
  tabsScroll: { marginBottom: 16 },
  tabsRow: { flexDirection: "row", gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    minWidth: 80,
  },
  tabActive: {
    backgroundColor: "rgba(102,126,234,0.15)",
    borderColor: "rgba(102,126,234,0.4)",
  },
  tabIcon: { fontSize: 18, marginBottom: 4 },
  tabLabel: { fontSize: 10, color: "#8B8DA3", fontWeight: "600", textAlign: "center" },
  tabLabelActive: { color: "#667EEA" },

  // Form fields
  formFields: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.7)", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  hint: { fontSize: 11, color: "#667EEA", marginTop: 6, fontStyle: "italic" },
  filePickBtn: {
    backgroundColor: "rgba(102,126,234,0.15)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.35)",
    marginTop: 4,
  },
  filePickBtnText: { color: "#9BB0FF", fontSize: 12, fontWeight: "700" },
  fileName: { fontSize: 11, color: "#8B8DA3", marginTop: 6 },

  row: { flexDirection: "row", gap: 10, marginTop: 6 },
  col: { flex: 1 },

  selectBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  selectText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", textTransform: "capitalize" },

  locBtn: {
    backgroundColor: "rgba(102,126,234,0.15)",
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.3)",
  },
  locBtnText: { color: "#667EEA", fontSize: 12, fontWeight: "700" },

  // Submit button
  submitBtn: { marginTop: 16, borderRadius: 12, overflow: "hidden" },
  submitBtnDisabled: { opacity: 0.6 },
  submitGradient: { paddingVertical: 14, alignItems: "center", borderRadius: 12 },
  submitText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  // Messages
  msgBox: { marginTop: 12, padding: 12, borderRadius: 10 },
  msgSuccess: { backgroundColor: "rgba(46,213,115,0.12)", borderWidth: 1, borderColor: "rgba(46,213,115,0.3)" },
  msgError: { backgroundColor: "rgba(255,75,75,0.12)", borderWidth: 1, borderColor: "rgba(255,75,75,0.3)" },
  msgText: { fontSize: 12, color: "#FFFFFF", fontWeight: "500" },

  // AI Result card
  resultCard: {
    marginTop: 14,
    backgroundColor: "rgba(102,126,234,0.08)",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.2)",
  },
  resultTitle: { fontSize: 14, fontWeight: "700", color: "#667EEA", marginBottom: 10 },
  resultRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  resultLabel: { fontSize: 12, color: "#8B8DA3" },
  resultValue: { fontSize: 12, color: "#FFFFFF", fontWeight: "600" },

  // Needs list
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  listCount: { fontSize: 12, color: "#8B8DA3" },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    zIndex: 20,
  },
  filterCol: { flex: 1 },
  filterLabel: { fontSize: 11, color: "#8B8DA3", marginBottom: 6, fontWeight: "600" },
  filterSelectBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterSelectText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  filterChevron: { color: "#8B8DA3", fontSize: 11 },
  filterDropdown: {
    marginTop: 6,
    backgroundColor: "rgba(26, 27, 51, 0.98)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    maxHeight: 180,
    overflow: "hidden",
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  filterOptionText: { color: "#FFFFFF", fontSize: 13, textTransform: "capitalize" },

  needCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  needHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  needTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#FFFFFF", marginRight: 8 },
  urgencyBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  urgencyText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  needDesc: { fontSize: 12, color: "#8B8DA3", marginBottom: 6, lineHeight: 18 },
  needMeta: { marginTop: 4 },
  needMetaText: { fontSize: 11, color: "#6B6B8A" },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "rgba(102,126,234,0.1)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  scoreLabel: { fontSize: 11, color: "#8B8DA3", marginRight: 6 },
  scoreValue: { fontSize: 12, color: "#667EEA", fontWeight: "700" },
  assigneeRow: {
    marginTop: 8,
    backgroundColor: "rgba(67,233,123,0.08)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(67,233,123,0.22)",
  },
  assigneeLabel: { fontSize: 11, color: "#8B8DA3", marginBottom: 2 },
  assigneeValue: { fontSize: 12, color: "#43E97B", fontWeight: "700" },
  assigneeMeta: { fontSize: 11, color: "#B8F8D5", marginTop: 2, textTransform: "capitalize" },
  needActionsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  needActionBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },
  closeActionBtn: {
    backgroundColor: "rgba(255,75,75,0.14)",
    borderColor: "rgba(255,75,75,0.35)",
  },
  attachActionBtn: {
    backgroundColor: "rgba(102,126,234,0.16)",
    borderColor: "rgba(102,126,234,0.35)",
  },
  needActionText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  // Empty state
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: "#8B8DA3", textAlign: "center" },
});
