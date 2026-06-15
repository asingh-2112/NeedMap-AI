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
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { translateViaApi } from "../../context/LanguageContext";
import { useRealtime } from "../../context/RealtimeContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { apiRequest, moduleApi } from "../../services/api";
import type { RootStackParamList } from "../../navigation/types";
import { getLiveLocation } from "../../services/location";
import type { Assignment, Need, Organization } from "../../types/api";

const CATEGORIES = [
  "water_access", "food", "shelter", "health", "education",
  "sanitation", "clothing", "legal_aid", "mental_health", "transportation", "other",
] as const;

const URGENCIES = ["critical", "high", "medium", "low"] as const;
const FILTER_URGENCIES = ["all", ...URGENCIES] as const;
const FILTER_CATEGORIES = ["all", ...CATEGORIES] as const;
const FILTER_ASSIGNMENTS = ["all", "assigned", "unassigned"] as const;

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

type VolunteerLocation = {
  latitude: number;
  longitude: number;
  address: string;
};

const distanceKm = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const getNeedLocationLabel = (need: Need) => {
  if (need.city?.trim()) return need.city.trim();
  const parts = (need.address || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 3];
  if (parts.length >= 2) return parts[parts.length - 2];
  return parts[0] || "Unknown location";
};

export const NeedsScreen = () => {
  const nav = useNavigation<Nav>();
  const { baseUrl, token, user } = useAuth();
  const { t, translateAddress, translateCategory, translateStatus, translateText, language } = useLanguage();
  const { assignmentsVersion, needsVersion } = useRealtime();
  const { reduceMotion } = useAccessibility();
  const { theme } = useThemeMode();
  const isLight = theme.mode === "light";
  const lightPrimary = isLight ? { color: "#0B1220", fontWeight: "800" as const } : null;
  const lightSecondary = isLight ? { color: "#111827", fontWeight: "700" as const } : null;
  const lightCard = isLight ? { borderColor: "#000000", borderWidth: 2, backgroundColor: "rgba(255,255,255,0.97)" } : null;
  const lightInput = isLight ? { borderColor: "#000000", borderWidth: 2, color: "#0B1220", fontWeight: "700" as const, backgroundColor: "#FFFFFF" } : null;
  const adminBranchId = user?.role === "admin" ? user?.managed_branch_id ?? null : null;
  const scopedOrganizationId = user?.role === "admin" ? adminBranchId : user?.organization_id;
  const isOwner = user?.role === "owner";
  const isVolunteer = user?.role === "volunteer";
  const [items, setItems] = useState<Need[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSource, setActiveSource] = useState<SourceKey>("manual");
  const [createNeedFile, setCreateNeedFile] = useState<PickedUpload | null>(null);
  const [showCreateCategoryDropdown, setShowCreateCategoryDropdown] = useState(false);
  const [showCreateUrgencyDropdown, setShowCreateUrgencyDropdown] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState<(typeof FILTER_URGENCIES)[number]>("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<(typeof FILTER_CATEGORIES)[number]>("all");
  const [selectedAssignmentFilter, setSelectedAssignmentFilter] = useState<(typeof FILTER_ASSIGNMENTS)[number]>("all");
  const [selectedVolunteerLocationFilter, setSelectedVolunteerLocationFilter] = useState("all");
  const [selectedVolunteerOrganizationFilter, setSelectedVolunteerOrganizationFilter] = useState("all");
  const [selectedVolunteerBranchFilter, setSelectedVolunteerBranchFilter] = useState("all");
  const [volunteerLiveLocation, setVolunteerLiveLocation] = useState<VolunteerLocation | null>(null);
  const [volunteerNearbyOnly, setVolunteerNearbyOnly] = useState(false);
  const [showUrgencyDropdown, setShowUrgencyDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAssignmentDropdown, setShowAssignmentDropdown] = useState(false);
  const [showVolunteerLocationDropdown, setShowVolunteerLocationDropdown] = useState(false);
  const [showVolunteerOrganizationDropdown, setShowVolunteerOrganizationDropdown] = useState(false);
  const [showVolunteerBranchDropdown, setShowVolunteerBranchDropdown] = useState(false);

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
  const missingAdminBranchMessage = t("Admin account is not assigned to a branch. Please ask the owner to assign a managed branch before creating needs.");

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      fadeIn.setValue(1);
      return;
    }

    const animation = Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [fadeIn, reduceMotion]);

  const load = async () => {
    setRefreshing(true);
    try {
      const branchFilters = adminBranchId ? { organization_id: adminBranchId } : null;
      const needRequest = isOrgManager && !isOwner
        ? branchFilters
          ? moduleApi.needs(baseUrl, token, branchFilters)
          : Promise.resolve([])
        : moduleApi.needs(baseUrl, token);
      const assignmentRequest = isOrgManager && !isOwner
        ? branchFilters
          ? moduleApi.assignments(baseUrl, token, branchFilters)
          : Promise.resolve([])
        : moduleApi.assignments(baseUrl, token);

      const organizationRequest = isVolunteer ? moduleApi.organizations(baseUrl, token) : Promise.resolve([]);
      const [data, assignmentData, organizationData] = await Promise.all([needRequest, assignmentRequest, organizationRequest]);
      const branchNeeds = adminBranchId ? data.filter((need) => need.organization_id === adminBranchId) : data;
      const branchAssignments = adminBranchId ? assignmentData.filter((assignment) => assignment.organization_id === adminBranchId) : assignmentData;
      setItems(branchNeeds);
      setAssignments(branchAssignments);
      setOrganizations(organizationData);
    } catch {
      setItems([]);
      setAssignments([]);
      setOrganizations([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [adminBranchId, assignmentsVersion, baseUrl, isOrgManager, isOwner, isVolunteer, needsVersion, token]);

  // Pre-fetch translations for all displayed needs when items change.
  // This ensures translateText() hits the cache on the next render cycle.
  useEffect(() => {
    if (!language || language === "en") return;
    if (!items.length) return;

    const textsToTranslate: string[] = [];
    for (const item of items) {
      if (item.title) textsToTranslate.push(item.title);
      if (item.description) textsToTranslate.push(item.description);
      if (item.address) textsToTranslate.push(item.address);
    }

    if (!textsToTranslate.length) return;

    // Fire all translations (debounced + batched internally)
    for (const text of textsToTranslate) {
      translateViaApi(text, language);
    }
  }, [items, language]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [adminBranchId, assignmentsVersion, baseUrl, isOrgManager, isOwner, isVolunteer, needsVersion, token]),
  );

  const fetchMyLocation = async () => {
    try {
      const loc = await getLiveLocation();
      setLatitude(String(loc.latitude));
      setLongitude(String(loc.longitude));
      setAddress(loc.address);
    } catch {
      Alert.alert(t("Location Error"), t("Could not fetch your location."));
    }
  };

  const useVolunteerLiveLocation = async () => {
    try {
      const loc = await getLiveLocation();
      setVolunteerLiveLocation(loc);
      setVolunteerNearbyOnly(true);
      setSubmitMessage({ text: t("Showing the top 10 nearby needs from your live location."), type: "success" });
    } catch {
      Alert.alert(t("Location Error"), t("Could not fetch your live location."));
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

      setSubmitMessage({ text: `${t("Selected file")}: ${picked.name}`, type: "success" });
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : t("File selection failed."), type: "error" });
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
      setSubmitMessage({ text: `${t("Selected file")}: ${picked.name}`, type: "success" });
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : t("File selection failed."), type: "error" });
    }
  };

  // Submit manual need creation
  const submitManualNeed = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: missingAdminBranchMessage, type: "error" });
      return;
    }

    const trimmedDesc = description.trim();
    const trimmedAddress = address.trim();
    const latNum = parseFloat(latitude.trim());
    const lngNum = parseFloat(longitude.trim());

    if (!trimmedDesc) {
      setSubmitMessage({ text: t("Description is required."), type: "error" });
      return;
    }
    if (trimmedDesc.length < 10) {
      setSubmitMessage({ text: t("Description must be at least 10 characters."), type: "error" });
      return;
    }
    if (!trimmedAddress) {
      setSubmitMessage({ text: t("Address is required."), type: "error" });
      return;
    }
    if (isNaN(latNum) || isNaN(lngNum)) {
      setSubmitMessage({ text: t("Valid latitude and longitude are required."), type: "error" });
      return;
    }
    if (latNum === 0 && lngNum === 0) {
      setSubmitMessage({ text: t("Please provide a real location (use the Auto button)."), type: "error" });
      return;
    }
    if (!CATEGORIES.includes(category)) {
      setSubmitMessage({ text: t("Please select a valid category."), type: "error" });
      return;
    }
    if (!URGENCIES.includes(urgency)) {
      setSubmitMessage({ text: t("Please select a valid urgency."), type: "error" });
      return;
    }
    if (category === "other" && !customCategory.trim()) {
      setSubmitMessage({ text: t("Please enter a custom category name."), type: "error" });
      return;
    }
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const generatedTitle = title.trim() || description.trim().split(/\s+/).slice(0, 8).join(" ") || "New Need";
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

      setSubmitMessage({ text: t("Need created successfully!"), type: "success" });
      resetForm();
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : t("Failed to create need."), type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit text ingest
  const submitTextIngest = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: missingAdminBranchMessage, type: "error" });
      return;
    }
    if (!rawText.trim()) {
      setSubmitMessage({ text: t("Please enter field notes or text."), type: "error" });
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
      setSubmitMessage({ text: `${t("AI extracted need")} (${t("confidence")}: ${(result.confidence * 100).toFixed(0)}%). ${t("Need")} #${result.need_id} ${t("created.")}`, type: "success" });
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : t("Text ingest failed."), type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit voice ingest
  const submitVoiceIngest = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: missingAdminBranchMessage, type: "error" });
      return;
    }
    if (!voiceFile && !voiceTranscription.trim()) {
      setSubmitMessage({ text: t("Upload an audio file or enter transcription."), type: "error" });
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
      setSubmitMessage({ text: `${t("Voice processed")} (${t("confidence")}: ${(result.confidence * 100).toFixed(0)}%). ${t("Need")} #${result.need_id} ${t("created.")}`, type: "success" });
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : t("Voice ingest failed."), type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit image OCR
  const submitImageOCR = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: missingAdminBranchMessage, type: "error" });
      return;
    }
    if (!imageFile && !imageUrl.trim()) {
      setSubmitMessage({ text: t("Upload an image file or provide an image URL."), type: "error" });
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
        setSubmitMessage({ text: `${t("Image processed")} (${t("confidence")}: ${(result.confidence * 100).toFixed(0)}%). ${t("Need")} #${result.need_id} ${t("created.")}`, type: "success" });
      } else {
        const result = await apiRequest<{ source_id: number | null; need_id: number | null; multimedia_txt: string; ai_extraction: string; structured: Record<string, unknown>; category_hint: string | null; urgency_hint: string | null }>(
          baseUrl,
          "/needs/ocr-extract",
          { method: "POST", body: JSON.stringify({ image_url: imageUrl.trim() })},
          token,
        );
        setSubmitMessage({ text: `${t("OCR extracted")}: ${translateCategory(result.category_hint || "unknown")} ${t("category")}, ${translateCategory(result.urgency_hint || "unknown")} ${t("urgency")}. ${t("Source")} #${result.source_id} ${t("created.")}`, type: "success" });
      }
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : t("Image OCR failed."), type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit PDF ingest
  const submitPdfIngest = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: missingAdminBranchMessage, type: "error" });
      return;
    }
    if (!pdfFile && !pdfUrl.trim()) {
      setSubmitMessage({ text: t("Upload a PDF file or provide a PDF URL."), type: "error" });
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
      setSubmitMessage({ text: `${t("PDF processed")} (${t("confidence")}: ${(result.confidence * 100).toFixed(0)}%). ${t("Need")} #${result.need_id} ${t("created.")}`, type: "success" });
      load();
    } catch (err) {
      setSubmitMessage({ text: err instanceof Error ? err.message : t("PDF ingest failed."), type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit CSV source
  const submitCsvSource = async () => {
    if (!scopedOrganizationId) {
      setSubmitMessage({ text: missingAdminBranchMessage, type: "error" });
      return;
    }
    if (!csvFile && !csvText.trim()) {
      setSubmitMessage({ text: t("Upload a CSV file or paste CSV content."), type: "error" });
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
        setSubmitMessage({ text: `${t("CSV processed")} (${t("confidence")}: ${(result.confidence * 100).toFixed(0)}%). ${t("Need")} #${result.need_id} ${t("created.")}`, type: "success" });
        load();
      } catch (err) {
        setSubmitMessage({ text: err instanceof Error ? err.message : t("CSV submit failed."), type: "error" });
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
        setSubmitMessage({ text: t("CSV source added to most recent need."), type: "success" });
        setCsvText("");
      } catch (err) {
        setSubmitMessage({ text: err instanceof Error ? err.message : t("CSV submit failed."), type: "error" });
      } finally {
        setSubmitting(false);
      }
    } else {
      setSubmitMessage({ text: t("No needs exist. Create a need first, then add CSV source."), type: "error" });
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

  const urgencyColor = (u: string) => {
    switch (u.toLowerCase()) {
      case "critical": return "#FF4757";
      case "high": return "#FF6B6B";
      case "medium": return "#FFA502";
      case "low": return "#2ED573";
      default: return "#667EEA";
    }
  };

  const assignmentCountByNeed = useMemo(() => {
    const counts = new Map<number, number>();
    assignments.forEach((a) => {
      if (["cancelled", "declined"].includes(a.status)) return;
      counts.set(a.need_id, (counts.get(a.need_id) ?? 0) + 1);
    });
    return counts;
  }, [assignments]);

  const organizationById = useMemo(() => {
    const map = new Map<number, Organization>();
    organizations.forEach((organization) => map.set(organization.id, organization));
    return map;
  }, [organizations]);

  const volunteerLocationOptions = useMemo(() => {
    const labels = Array.from(new Set(items.map(getNeedLocationLabel).filter((label) => label !== "Unknown location")));
    return labels.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const volunteerNeedsForSelectedLocation = useMemo(() => {
    const activeNeeds = items.filter((need) => !["closed", "resolved"].includes(need.status?.toLowerCase?.() ?? ""));
    if (selectedVolunteerLocationFilter === "all") return activeNeeds;
    return activeNeeds.filter((need) => getNeedLocationLabel(need) === selectedVolunteerLocationFilter);
  }, [items, selectedVolunteerLocationFilter]);

  const volunteerOrganizationOptions = useMemo(() => {
    const selectedCityOrgIds = new Set<number>();

    volunteerNeedsForSelectedLocation.forEach((need) => {
      const needOrg = organizationById.get(need.organization_id);
      selectedCityOrgIds.add(needOrg?.parent_organization_id ?? need.organization_id);
    });

    return Array.from(selectedCityOrgIds)
      .map((orgId) => organizationById.get(orgId) ?? {
        id: orgId,
        organization_name: `Organization #${orgId}`,
        address: null,
        phone: null,
        user_id: 0,
        is_active: true,
        created_at: "",
      })
      .sort((a, b) => a.organization_name.localeCompare(b.organization_name));
  }, [organizationById, volunteerNeedsForSelectedLocation]);

  const volunteerBranchOptions = useMemo(() => {
    const selectedOrgId = selectedVolunteerOrganizationFilter === "all" ? null : Number(selectedVolunteerOrganizationFilter);
    const selectedBranchIds = new Set<number>();

    volunteerNeedsForSelectedLocation.forEach((need) => {
      const needOrg = organizationById.get(need.organization_id);
      const parentOrgId = needOrg?.parent_organization_id ?? null;
      const belongsToSelectedOrg = selectedOrgId === null || need.organization_id === selectedOrgId || parentOrgId === selectedOrgId;
      if (!belongsToSelectedOrg) return;
      if (parentOrgId !== null || needOrg?.is_branch === true) {
        selectedBranchIds.add(need.organization_id);
      }
    });

    return Array.from(selectedBranchIds)
      .map((branchId) => organizationById.get(branchId) ?? {
        id: branchId,
        organization_name: `Branch #${branchId}`,
        address: null,
        phone: null,
        user_id: 0,
        is_active: true,
        is_branch: true,
        created_at: "",
      })
      .sort((a, b) => a.organization_name.localeCompare(b.organization_name));
  }, [organizationById, selectedVolunteerOrganizationFilter, volunteerNeedsForSelectedLocation]);

  const displayedItems = useMemo(() => {
    const urgencyRank: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const baseItems = [...items]
      .filter((n) => !["closed", "resolved"].includes(n.status?.toLowerCase?.() ?? ""))
      .filter((n) => selectedUrgencyFilter === "all" || n.urgency === selectedUrgencyFilter)
      .filter((n) => selectedCategoryFilter === "all" || n.category === selectedCategoryFilter)
      .filter((n) => {
        if (!isOrgManager || selectedAssignmentFilter === "all") return true;
        const assignedVolunteerCount = assignmentCountByNeed.get(n.id) ?? 0;
        return selectedAssignmentFilter === "assigned" ? assignedVolunteerCount > 0 : assignedVolunteerCount === 0;
      })
      .filter((n) => {
        if (!isVolunteer) return true;
        if (selectedVolunteerLocationFilter !== "all" && getNeedLocationLabel(n) !== selectedVolunteerLocationFilter) return false;
        if (selectedVolunteerBranchFilter !== "all") return n.organization_id === Number(selectedVolunteerBranchFilter);
        if (selectedVolunteerOrganizationFilter !== "all") {
          const selectedOrgId = Number(selectedVolunteerOrganizationFilter);
          const needOrg = organizationById.get(n.organization_id);
          return n.organization_id === selectedOrgId || needOrg?.parent_organization_id === selectedOrgId;
        }
        return true;
      })
      .sort((a, b) => {
        const urgencyDiff = (urgencyRank[a.urgency] ?? 99) - (urgencyRank[b.urgency] ?? 99);
        if (urgencyDiff !== 0) return urgencyDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

    if (!isVolunteer || !volunteerNearbyOnly || !volunteerLiveLocation) return baseItems;

    return baseItems
      .filter((need) => Number.isFinite(need.latitude) && Number.isFinite(need.longitude))
      .map((need) => ({
        need,
        distance: distanceKm(volunteerLiveLocation, { latitude: need.latitude, longitude: need.longitude }),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10)
      .map((item) => item.need);
  }, [assignmentCountByNeed, isOrgManager, isVolunteer, items, organizationById, selectedAssignmentFilter, selectedCategoryFilter, selectedUrgencyFilter, selectedVolunteerBranchFilter, selectedVolunteerLocationFilter, selectedVolunteerOrganizationFilter, volunteerLiveLocation, volunteerNearbyOnly]);

  const selectedVolunteerOrganizationLabel = selectedVolunteerOrganizationFilter === "all"
    ? t("All organizations")
    : organizationById.get(Number(selectedVolunteerOrganizationFilter))?.organization_name ?? t("Organization");
  const selectedVolunteerBranchLabel = selectedVolunteerBranchFilter === "all"
    ? t("All branches")
    : organizationById.get(Number(selectedVolunteerBranchFilter))?.organization_name ?? t("Branch");
  const selectedVolunteerLocationLabel = selectedVolunteerLocationFilter === "all" ? t("All locations") : selectedVolunteerLocationFilter;

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
              <Text style={[styles.pageTitle, lightPrimary]}>{t("Needs")}</Text>
              <Text style={[styles.pageSubtitle, lightSecondary]}>
                {isOrgManager ? t("Create & manage community needs") : t("Browse active community needs")}
              </Text>
            </View>
            {isOrgManager ? (
              <Pressable
                style={[styles.createToggle, showCreate && styles.createToggleActive]}
                onPress={() => { setShowCreate(!showCreate); setSubmitMessage(null); }}
              >
                <Text style={[styles.createToggleText, lightPrimary]}>{showCreate ? t("Close") : `+ ${t("Create")}`}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* CREATE NEED FORM */}
          {showCreate && isOrgManager ? (
            <View style={[styles.formCard, lightCard]}>
              <Text style={[styles.formTitle, lightPrimary]}>{t("Create New Need")}</Text>
              <Text style={[styles.formSubtitle, lightSecondary]}>{t("Upload optional file, then fill details and create need")}</Text>

              <View style={styles.formFields}>
                <Text style={[styles.label, lightSecondary]}>{t("Optional File Upload (PDF / Image / Audio)")}</Text>
                <Pressable style={styles.filePickBtn} onPress={pickCreateNeedFile}>
                  <Text style={[styles.filePickBtnText, lightPrimary]}>{t("Choose File")}</Text>
                </Pressable>
                {createNeedFile ? <Text style={[styles.fileName, lightSecondary]}>{t("Selected")}: {createNeedFile.name}</Text> : null}

                <Text style={[styles.label, lightSecondary]}>{t("Description")} *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, lightInput]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t("Describe need details...")}
                  placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                  multiline
                  numberOfLines={5}
                />

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={[styles.label, lightSecondary]}>{t("Category")}</Text>
                    <Pressable
                      style={[styles.selectBtn, lightInput]}
                      onPress={() => {
                        setShowCreateCategoryDropdown((prev) => !prev);
                        setShowCreateUrgencyDropdown(false);
                      }}
                    >
                      <Text style={[styles.selectText, lightPrimary]}>{translateCategory(category)}</Text>
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
                            <Text style={[styles.filterOptionText, lightPrimary]}>{translateCategory(c)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.col}>
                    <Text style={[styles.label, lightSecondary]}>{t("Urgency")}</Text>
                    <Pressable
                      style={[styles.selectBtn, lightInput, { borderColor: urgencyColor(urgency) }]}
                      onPress={() => {
                        setShowCreateUrgencyDropdown((prev) => !prev);
                        setShowCreateCategoryDropdown(false);
                      }}
                    >
                      <Text style={[styles.selectText, { color: urgencyColor(urgency), fontWeight: isLight ? "800" : "600" }]}>{translateCategory(urgency)}</Text>
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
                            <Text style={[styles.filterOptionText, lightPrimary]}>{translateCategory(u)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>

                {category === "other" ? (
                  <>
                    <Text style={[styles.label, lightSecondary]}>{t("Custom Category")}</Text>
                    <TextInput
                      style={[styles.input, lightInput]}
                      value={customCategory}
                      onChangeText={setCustomCategory}
                      placeholder={t("Enter custom category (e.g. medicine kits, baby care, rescue support)")}
                      placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                    />
                  </>
                ) : null}

                <Text style={[styles.label, lightSecondary]}>{t("Location")}</Text>
                <TextInput
                  style={[styles.input, lightInput]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder={t("Full address")}
                  placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                />
                <View style={styles.row}>
                  <View style={styles.col}>
                    <TextInput
                      style={[styles.input, lightInput]}
                      value={latitude}
                      onChangeText={setLatitude}
                      placeholder={t("Latitude")}
                      placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.col}>
                    <TextInput
                      style={[styles.input, lightInput]}
                      value={longitude}
                      onChangeText={setLongitude}
                      placeholder={t("Longitude")}
                      placeholderTextColor={isLight ? "#374151" : "#6B6B8A"}
                      keyboardType="numeric"
                    />
                  </View>
                  <Pressable style={styles.locBtn} onPress={fetchMyLocation}>
                    <Text style={[styles.locBtnText, lightPrimary]}>📍 {t("Auto")}</Text>
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
                    <Text style={[styles.submitText, isLight ? { color: "#0B1220", fontWeight: "900" } : null]}>{t("Create Need")}</Text>
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
                  <Text style={[styles.resultTitle, lightPrimary]}>{t("AI Extraction Result")}</Text>
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, lightSecondary]}>{t("Category")}:</Text>
                    <Text style={[styles.resultValue, lightPrimary]}>{translateCategory(ingestResult.category)}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>{t("Urgency")}:</Text>
                    <Text style={[styles.resultValue, { color: urgencyColor(ingestResult.urgency) }]}>{translateCategory(ingestResult.urgency)}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={[styles.resultLabel, lightSecondary]}>{t("Location")}:</Text>
                    <Text style={[styles.resultValue, lightPrimary]}>{ingestResult.location || "—"}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>{t("Affected")}:</Text>
                    <Text style={styles.resultValue}>{ingestResult.affected_count ?? "—"}</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>{t("Confidence")}:</Text>
                    <Text style={styles.resultValue}>{(ingestResult.confidence * 100).toFixed(0)}%</Text>
                  </View>
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>{t("Model")}:</Text>
                    <Text style={styles.resultValue}>{ingestResult.model_used}</Text>
                  </View>
                  {ingestResult.skills_required.length > 0 ? (
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>{t("Skills")}:</Text>
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
              {isOrgManager ? t("Your Organization's Needs") : t("All Active Needs")}
            </Text>
            <Text style={[styles.listCount, lightSecondary]}>{displayedItems.length} {t("shown")}</Text>
          </View>

          <View style={styles.filterRow}>
            <View style={styles.filterCol}>
              <Text style={[styles.filterLabel, lightSecondary]}>{t("Urgency")}</Text>
              <Pressable
                style={[styles.filterSelectBtn, lightInput]}
                onPress={() => {
                  setShowUrgencyDropdown((prev) => !prev);
                  setShowCategoryDropdown(false);
                  setShowAssignmentDropdown(false);
                  setShowVolunteerLocationDropdown(false);
                  setShowVolunteerOrganizationDropdown(false);
                  setShowVolunteerBranchDropdown(false);
                }}
              >
                <Text style={[styles.filterSelectText, lightPrimary]}>{translateCategory(selectedUrgencyFilter)}</Text>
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
                      <Text style={[styles.filterOptionText, lightPrimary]}>{translateCategory(u)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.filterCol}>
              <Text style={[styles.filterLabel, lightSecondary]}>{t("Category")}</Text>
              <Pressable
                style={[styles.filterSelectBtn, lightInput]}
                onPress={() => {
                  setShowCategoryDropdown((prev) => !prev);
                  setShowUrgencyDropdown(false);
                  setShowAssignmentDropdown(false);
                  setShowVolunteerLocationDropdown(false);
                  setShowVolunteerOrganizationDropdown(false);
                  setShowVolunteerBranchDropdown(false);
                }}
              >
                <Text style={[styles.filterSelectText, lightPrimary]}>{translateCategory(selectedCategoryFilter)}</Text>
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
                      <Text style={[styles.filterOptionText, lightPrimary]}>{translateCategory(c)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {isOrgManager ? (
              <View style={styles.filterCol}>
                <Text style={[styles.filterLabel, lightSecondary]}>{t("Assignment")}</Text>
                <Pressable
                  style={[styles.filterSelectBtn, lightInput]}
                  onPress={() => {
                    setShowAssignmentDropdown((prev) => !prev);
                    setShowUrgencyDropdown(false);
                    setShowCategoryDropdown(false);
                    setShowVolunteerLocationDropdown(false);
                    setShowVolunteerOrganizationDropdown(false);
                    setShowVolunteerBranchDropdown(false);
                  }}
                >
                  <Text style={[styles.filterSelectText, lightPrimary]}>{translateStatus(selectedAssignmentFilter)}</Text>
                  <Text style={[styles.filterChevron, lightPrimary]}>▼</Text>
                </Pressable>
                {showAssignmentDropdown ? (
                  <View style={[styles.filterDropdown, lightCard]}>
                    {FILTER_ASSIGNMENTS.map((assignmentFilter) => (
                      <Pressable
                        key={assignmentFilter}
                        style={styles.filterOption}
                        onPress={() => {
                          setSelectedAssignmentFilter(assignmentFilter);
                          setShowAssignmentDropdown(false);
                        }}
                      >
                        <Text style={[styles.filterOptionText, lightPrimary]}>{translateStatus(assignmentFilter)}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {isVolunteer ? (
            <View style={[styles.volunteerFilterCard, lightCard]}>
              <View style={styles.volunteerFilterHeader}>
                <View style={styles.volunteerFilterTitleWrap}>
                  <Text style={[styles.volunteerFilterTitle, lightPrimary]}>{t("Volunteer Need Filters")}</Text>
                  <Text style={[styles.volunteerFilterHint, lightSecondary]}>
                    {t("Browse needs across organizations, branches, and nearby locations.")}
                  </Text>
                </View>
                <Pressable
                  style={[styles.liveLocationBtn, volunteerNearbyOnly && styles.liveLocationBtnActive]}
                  onPress={volunteerNearbyOnly ? () => setVolunteerNearbyOnly(false) : useVolunteerLiveLocation}
                >
                  <Text style={[styles.liveLocationBtnText, volunteerNearbyOnly ? styles.liveLocationBtnTextActive : null]}>
                    {volunteerNearbyOnly ? t("Show All") : t("Use Live Location")}
                  </Text>
                </Pressable>
              </View>

              {volunteerNearbyOnly && volunteerLiveLocation ? (
                <Text style={[styles.nearbyNote, lightSecondary]} numberOfLines={2}>
                  {t("Showing top 10 nearby needs from")} {volunteerLiveLocation.address ? translateAddress(volunteerLiveLocation.address) : t("your live location")}.
                </Text>
              ) : null}

              <View style={styles.volunteerFilterGrid}>
                <View style={styles.volunteerFilterCol}>
                  <Text style={[styles.filterLabel, lightSecondary]}>{t("Location")}</Text>
                  <Pressable
                    style={[styles.filterSelectBtn, lightInput]}
                    onPress={() => {
                      setShowVolunteerLocationDropdown((prev) => !prev);
                      setShowVolunteerOrganizationDropdown(false);
                      setShowVolunteerBranchDropdown(false);
                      setShowUrgencyDropdown(false);
                      setShowCategoryDropdown(false);
                      setShowAssignmentDropdown(false);
                    }}
                  >
                    <Text style={[styles.filterSelectText, lightPrimary]} numberOfLines={1}>{selectedVolunteerLocationLabel}</Text>
                    <Text style={[styles.filterChevron, lightPrimary]}>▼</Text>
                  </Pressable>
                  {showVolunteerLocationDropdown ? (
                    <View style={[styles.filterDropdown, lightCard]}>
                      {["all", ...volunteerLocationOptions].map((locationOption) => (
                        <Pressable
                          key={locationOption}
                          style={styles.filterOption}
                          onPress={() => {
                            setSelectedVolunteerLocationFilter(locationOption);
                            setSelectedVolunteerOrganizationFilter("all");
                            setSelectedVolunteerBranchFilter("all");
                            setShowVolunteerLocationDropdown(false);
                          }}
                        >
                          <Text style={[styles.filterOptionText, lightPrimary]}>{locationOption === "all" ? t("All locations") : locationOption}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={styles.volunteerFilterCol}>
                  <Text style={[styles.filterLabel, lightSecondary]}>{t("Organization")}</Text>
                  <Pressable
                    style={[styles.filterSelectBtn, lightInput]}
                    onPress={() => {
                      setShowVolunteerOrganizationDropdown((prev) => !prev);
                      setShowVolunteerLocationDropdown(false);
                      setShowVolunteerBranchDropdown(false);
                      setShowUrgencyDropdown(false);
                      setShowCategoryDropdown(false);
                      setShowAssignmentDropdown(false);
                    }}
                  >
                    <Text style={[styles.filterSelectText, lightPrimary]} numberOfLines={1}>{selectedVolunteerOrganizationLabel}</Text>
                    <Text style={[styles.filterChevron, lightPrimary]}>▼</Text>
                  </Pressable>
                  {showVolunteerOrganizationDropdown ? (
                    <View style={[styles.filterDropdown, lightCard]}>
                      <Pressable
                        style={styles.filterOption}
                        onPress={() => {
                          setSelectedVolunteerOrganizationFilter("all");
                          setSelectedVolunteerBranchFilter("all");
                          setShowVolunteerOrganizationDropdown(false);
                        }}
                      >
                        <Text style={[styles.filterOptionText, lightPrimary]}>{t("All organizations")}</Text>
                      </Pressable>
                      {volunteerOrganizationOptions.map((organization) => (
                        <Pressable
                          key={organization.id}
                          style={styles.filterOption}
                          onPress={() => {
                            setSelectedVolunteerOrganizationFilter(String(organization.id));
                            setSelectedVolunteerBranchFilter("all");
                            setShowVolunteerOrganizationDropdown(false);
                          }}
                        >
                          <Text style={[styles.filterOptionText, lightPrimary]} numberOfLines={1}>{organization.organization_name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={styles.volunteerFilterCol}>
                  <Text style={[styles.filterLabel, lightSecondary]}>{t("Branch")}</Text>
                  <Pressable
                    style={[styles.filterSelectBtn, lightInput]}
                    onPress={() => {
                      setShowVolunteerBranchDropdown((prev) => !prev);
                      setShowVolunteerLocationDropdown(false);
                      setShowVolunteerOrganizationDropdown(false);
                      setShowUrgencyDropdown(false);
                      setShowCategoryDropdown(false);
                      setShowAssignmentDropdown(false);
                    }}
                  >
                    <Text style={[styles.filterSelectText, lightPrimary]} numberOfLines={1}>{selectedVolunteerBranchLabel}</Text>
                    <Text style={[styles.filterChevron, lightPrimary]}>▼</Text>
                  </Pressable>
                  {showVolunteerBranchDropdown ? (
                    <View style={[styles.filterDropdown, lightCard]}>
                      <Pressable
                        style={styles.filterOption}
                        onPress={() => {
                          setSelectedVolunteerBranchFilter("all");
                          setShowVolunteerBranchDropdown(false);
                        }}
                      >
                        <Text style={[styles.filterOptionText, lightPrimary]}>{t("All branches")}</Text>
                      </Pressable>
                      {volunteerBranchOptions.map((branch) => (
                        <Pressable
                          key={branch.id}
                          style={styles.filterOption}
                          onPress={() => {
                            setSelectedVolunteerBranchFilter(String(branch.id));
                            setShowVolunteerBranchDropdown(false);
                          }}
                        >
                          <Text style={[styles.filterOptionText, lightPrimary]} numberOfLines={1}>{branch.organization_name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {displayedItems.map((n) => {
            const assignedVolunteerCount = assignmentCountByNeed.get(n.id) ?? 0;
            return (
            <Pressable key={n.id} style={[styles.needCard, lightCard]} onPress={() => nav.navigate("NeedDetail", { needId: n.id })}>
              <View style={styles.needHeader}>
                <Text style={[styles.needTitle, lightPrimary]} numberOfLines={2}>{translateText(n.title)}</Text>
                <View style={[styles.urgencyBadge, { backgroundColor: `${urgencyColor(n.urgency)}20`, borderColor: urgencyColor(n.urgency) }]}>
                  <Text style={[styles.urgencyText, { color: urgencyColor(n.urgency) }]}>{translateCategory(n.urgency)}</Text>
                </View>
              </View>
              {n.description ? (
                <Text style={[styles.needDesc, lightSecondary]} numberOfLines={2}>{translateText(n.description)}</Text>
              ) : null}
              <View style={styles.needMeta}>
                <Text style={[styles.needMetaText, lightSecondary]}>
                  {t("Category")}: {translateCategory(n.category)} · {t("Status")}: {translateStatus(n.status)}
                </Text>
                <Text style={[styles.needMetaText, lightSecondary]} numberOfLines={2}>
                  {t("Address")}: {translateAddress(n.address)}
                </Text>
              </View>
              {n.priority_score != null ? (
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreLabel, lightSecondary]}>{t("Priority Score")}:</Text>
                  <Text style={[styles.scoreValue, lightPrimary]}>{n.priority_score.toFixed(2)}</Text>
                </View>
              ) : null}

              {assignedVolunteerCount > 0 ? (
                <View style={styles.assigneeRow}>
                  <Text style={styles.assigneeLabel}>{t("Assigned Volunteers")}:</Text>
                  <Text style={styles.assigneeValue}>{assignedVolunteerCount}</Text>
                  <Text style={styles.assigneeMeta}>{assignedVolunteerCount === 1 ? t("volunteer assigned") : t("volunteers assigned")}</Text>
                </View>
              ) : null}

            </Pressable>
            );
          })}

          {displayedItems.length === 0 && !refreshing ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t("No needs found")}</Text>
              <Text style={styles.emptySubtitle}>
                {isOrgManager ? t("Create your first need using the form above.") : t("Pull to refresh for latest needs.")}
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
  volunteerFilterCard: {
    backgroundColor: "rgba(255,255,255,0.055)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
    marginBottom: 12,
    zIndex: 15,
  },
  volunteerFilterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 10,
  },
  volunteerFilterTitleWrap: { flex: 1, minWidth: 190 },
  volunteerFilterTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  volunteerFilterHint: { color: "#8B8DA3", fontSize: 11, fontWeight: "600", marginTop: 3 },
  liveLocationBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.35)",
    backgroundColor: "rgba(102,126,234,0.14)",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    minWidth: 116,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  liveLocationBtnActive: {
    backgroundColor: "rgba(67,233,123,0.14)",
    borderColor: "rgba(67,233,123,0.35)",
  },
  liveLocationBtnText: { color: "#9BB0FF", fontSize: 11, fontWeight: "800" },
  liveLocationBtnTextActive: { color: "#43E97B" },
  nearbyNote: {
    color: "#B8F8D5",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 10,
  },
  volunteerFilterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  volunteerFilterCol: {
    flexGrow: 1,
    flexBasis: 160,
    minWidth: 0,
  },

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
    alignItems: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  needTitle: { flex: 1, flexShrink: 1, minWidth: 0, fontSize: 15, fontWeight: "700", color: "#FFFFFF", lineHeight: 21 },
  urgencyBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
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
