import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useRealtime } from "../../context/RealtimeContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { apiRequest, moduleApi } from "../../services/api";
import { getLiveLocation } from "../../services/location";
import type { RootStackParamList } from "../../navigation/types";
import type { Need, Organization, Volunteer } from "../../types/api";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type MainTabRoute = "Needs" | "Statistics" | "Feeds" | "Assignments";

type LocationInfo = {
  latitude: number;
  longitude: number;
  address: string;
};

type HomeStory = {
  id: number;
  title: string;
  narrative: string;
  image_url?: string | null;
  media_urls?: string | null;
  created_at: string;
};

type AreaPreview = {
  key: string;
  area: string;
  city: string;
  total: number;
  active: number;
  inProgress: number;
  completed: number;
  dominantStatus: "active" | "in_progress" | "completed";
};

export const HomeScreen = () => {
  const nav = useNavigation<Nav>();
  const { baseUrl, token, user } = useAuth();
  const { assignmentsVersion, needsVersion, volunteerRatingVersion } = useRealtime();
  const { reduceMotion } = useAccessibility();
  const { t, translateAddress, translateCategory, translateStatus, translateText } = useLanguage();
  const { theme } = useThemeMode();
  const adminBranchId = user?.role === "admin" ? user?.managed_branch_id ?? null : null;
  const scopedOrganizationId = user?.role === "admin" ? adminBranchId ?? user?.organization_id : user?.organization_id;

  const isOrgOwner = user?.role === "owner" && !!user?.organization_id;
  const isAdmin = user?.role === "admin";
  const isVolunteer = user?.role === "volunteer";
  const showNeedsOrganizationMap = isAdmin || isVolunteer;
  const isOrgManager = user?.role === "owner" || user?.role === "admin";
  const isLight = theme.mode === "light";
  const lightPrimary = isLight ? { color: "#0B1220", fontWeight: "800" as const } : null;
  const lightSecondary = isLight ? { color: "#111827", fontWeight: "700" as const } : null;
  const lightMuted = isLight ? { color: "#1F2937", fontWeight: "700" as const } : null;
  const lightCard = isLight ? { borderColor: "#000000", borderWidth: 2, backgroundColor: "rgba(255,255,255,0.97)" } : null;
  const lightCardSoft = isLight ? { borderColor: "#000000", borderWidth: 2, backgroundColor: "rgba(255,255,255,0.94)" } : null;

  // Shared state
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [needsCount, setNeedsCount] = useState(0);
  const [activeAssignments, setActiveAssignments] = useState(0);
  const [completedAssignments, setCompletedAssignments] = useState(0);
  const [nearbyNeeds, setNearbyNeeds] = useState<Need[]>([]);

  // Org-specific state
  const [orgInfo, setOrgInfo] = useState<Organization | null>(null);
  const [branches, setBranches] = useState<Organization[]>([]);
  const [orgNeedsCount, setOrgNeedsCount] = useState(0);
  const [orgActiveNeedsCount, setOrgActiveNeedsCount] = useState(0);
  const [orgCompletedNeedsCount, setOrgCompletedNeedsCount] = useState(0);
  const [orgVolunteersCount, setOrgVolunteersCount] = useState(0);
  const [orgAssignmentsCount, setOrgAssignmentsCount] = useState(0);
  const [homeStories, setHomeStories] = useState<HomeStory[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [mapNeeds, setMapNeeds] = useState<Need[]>([]);
  const [mapOrganizations, setMapOrganizations] = useState<Organization[]>([]);
  const [mapVolunteers, setMapVolunteers] = useState<Volunteer[]>([]);
  const [volunteerProfile, setVolunteerProfile] = useState<Volunteer | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (reduceMotion) {
      fadeIn.setValue(1);
      slideUp.setValue(0);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fadeIn, reduceMotion, slideUp]);

  // Fetch location
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const loc = await getLiveLocation();
        setLocation(loc);
      } catch {
        setLocation(null);
      } finally {
        setLocationLoading(false);
      }
    };
    fetchLocation();
  }, []);

  // Fetch data from APIs
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      try {
        if ((isOrgOwner || user?.role === "admin") && scopedOrganizationId) {
          if (isOrgOwner) {
            // Owner scope should include HQ + all active branches.
            const [org, branchList, needs, assignments, volunteers] = await Promise.all([
              moduleApi.getOrganization(baseUrl, token, scopedOrganizationId),
              moduleApi.organizationBranches(baseUrl, token, scopedOrganizationId),
              moduleApi.needs(baseUrl, token),
              moduleApi.assignments(baseUrl, token),
              moduleApi.volunteers(baseUrl, token),
            ]);

            const scopedOrgIds = new Set<number>([
              scopedOrganizationId,
              ...branchList.map((branch) => branch.id),
            ]);
            const scopedNeeds = needs.filter((n) => scopedOrgIds.has(n.organization_id));
            const scopedAssignments = assignments.filter((a) => scopedOrgIds.has(a.organization_id));
            const scopedVolunteers = volunteers.filter((v) => v.organization_id != null && scopedOrgIds.has(v.organization_id));

            setOrgInfo(org);
            setBranches(branchList);
            setOrgNeedsCount(scopedNeeds.length);
            setOrgVolunteersCount(scopedVolunteers.length);
            setOrgAssignmentsCount(scopedAssignments.length);

            const activeNeeds = scopedNeeds.filter((n) => !["resolved", "closed"].includes(n.status));
            const completedNeeds = scopedNeeds.filter((n) => ["resolved", "closed"].includes(n.status));
            setOrgActiveNeedsCount(activeNeeds.length);
            setOrgCompletedNeedsCount(completedNeeds.length);
            setNeedsCount(activeNeeds.length);
            setNearbyNeeds(activeNeeds.slice(0, 5));
            // Keep owner map behavior marker-based (no heat overlay change for owner).
            setMapNeeds([]);
            setMapOrganizations([]);
            setMapVolunteers([]);
            setVolunteerProfile(null);

            const active = scopedAssignments.filter((a) =>
              ["accepted", "in_progress", "proposed", "assigned"].includes(a.status)
            );
            setActiveAssignments(active.length);
            setCompletedAssignments(scopedAssignments.filter((a) => a.status === "completed").length);
          } else {
            const branchNeedsFilter = adminBranchId ? { organization_id: adminBranchId } : undefined;
            const [org, needs, assignments, volunteers, organizations] = await Promise.all([
              moduleApi.getOrganization(baseUrl, token, scopedOrganizationId),
              branchNeedsFilter ? moduleApi.needs(baseUrl, token, branchNeedsFilter) : Promise.resolve([]),
              branchNeedsFilter ? moduleApi.assignments(baseUrl, token, branchNeedsFilter) : Promise.resolve([]),
              moduleApi.volunteers(baseUrl, token),
              moduleApi.organizations(baseUrl, token),
            ]);
            const branchNeeds = adminBranchId ? needs.filter((need) => need.organization_id === adminBranchId) : [];
            const branchAssignments = adminBranchId ? assignments.filter((assignment) => assignment.organization_id === adminBranchId) : [];

            setOrgInfo(org);
            setOrgNeedsCount(branchNeeds.length);
            setOrgVolunteersCount(volunteers.filter((v) => v.organization_id === scopedOrganizationId).length);
            setOrgAssignmentsCount(branchAssignments.length);

            const inProgressNeeds = branchNeeds.filter((n) => n.status === "in_progress");
            const activeNeeds = branchNeeds.filter((n) => ["new", "verified", "assigned"].includes(n.status));
            const completedNeeds = branchNeeds.filter((n) => ["resolved", "closed"].includes(n.status));
            setOrgActiveNeedsCount(activeNeeds.length);
            setOrgCompletedNeedsCount(completedNeeds.length);
            setNeedsCount(activeNeeds.length + inProgressNeeds.length);
            setNearbyNeeds([...activeNeeds, ...inProgressNeeds].slice(0, 5));
            setMapNeeds(branchNeeds);
            setMapOrganizations(organizations.filter((organization) => Boolean(organization.branch_location)));
            setMapVolunteers(volunteers.filter((volunteer) => typeof volunteer.latitude === "number" && typeof volunteer.longitude === "number"));
            setVolunteerProfile(null);

            const active = branchAssignments.filter((a) =>
              ["accepted", "in_progress", "proposed", "assigned"].includes(a.status)
            );
            setActiveAssignments(active.length);
            setCompletedAssignments(branchAssignments.filter((a) => a.status === "completed").length);
          }
        } else {
          // Volunteer: fetch accessible needs, assignments, and organization pointers for the home map.
          const [needs, assignments, organizations] = await Promise.all([
            moduleApi.needs(baseUrl, token),
            moduleApi.assignments(baseUrl, token),
            moduleApi.organizations(baseUrl, token),
          ]);

          const activeNeeds = needs.filter((n) => !["resolved", "closed"].includes(n.status));
          setNeedsCount(activeNeeds.length);
          setNearbyNeeds(activeNeeds.slice(0, 5));
          // Volunteer map uses needs + organization pointers only. Do not expose volunteer locations/details here.
          setMapNeeds(needs);
          setMapOrganizations(organizations.filter((organization) => Boolean(organization.branch_location)));
          setMapVolunteers([]);

          const active = assignments.filter((a) =>
            ["accepted", "in_progress", "proposed", "assigned"].includes(a.status)
          );
          setActiveAssignments(active.length);
          setCompletedAssignments(assignments.filter((a) => a.status === "completed").length);
        }
      } catch (err) {
        console.error("[HomeScreen] Error loading data:", err);
      }
    };

    loadData();
  }, [adminBranchId, assignmentsVersion, baseUrl, isOrgOwner, needsVersion, scopedOrganizationId, token, user?.role]);

  useEffect(() => {
    if (!token || !isVolunteer) {
      setVolunteerProfile(null);
      return;
    }

    const loadVolunteerProfile = async () => {
      const profile = await moduleApi.myVolunteerProfile(baseUrl, token).catch(() => null);
      setVolunteerProfile(profile);
    };

    void loadVolunteerProfile();
  }, [baseUrl, isVolunteer, token, volunteerRatingVersion]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadStories = async () => {
      setStoriesLoading(true);
      try {
        const query = scopedOrganizationId
          ? `?org_id=${scopedOrganizationId}&limit=3`
          : "?limit=3";
        const data = await apiRequest<HomeStory[]>(
          baseUrl,
          `/api/stories/${query}`,
          { method: "GET" },
          token
        );
        setHomeStories(data);
      } catch {
        setHomeStories([]);
      } finally {
        setStoriesLoading(false);
      }
    };

    void loadStories();
  }, [baseUrl, token, scopedOrganizationId]);

  const goToMainTab = (screen: MainTabRoute) => {
    nav.navigate("MainTabs", { screen });
  };

  const volunteerAverageRating = typeof volunteerProfile?.rating === "number" ? volunteerProfile.rating : null;

  const volunteerRatingStars = useMemo(() => {
    const roundedRating = Math.round(volunteerAverageRating ?? 0);
    return Array.from({ length: 5 }, (_, index) => index < roundedRating);
  }, [volunteerAverageRating]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleMapMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== "needmap-admin-map" || data.type !== "openNeed") return;

      const needId = Number(data.needId);
      if (Number.isFinite(needId)) {
        nav.navigate("NeedDetail", { needId });
      }
    };

    window.addEventListener("message", handleMapMessage);
    return () => window.removeEventListener("message", handleMapMessage);
  }, [nav]);

  const needAreaPreview = useMemo<AreaPreview[]>(() => {
    if (!showNeedsOrganizationMap) return [];

    const parseAreaFromAddress = (address: string | null | undefined) => {
      const parts = (address || "").split(",").map((part) => part.trim()).filter(Boolean);
      return parts[0] || t("Unknown Area");
    };

    const parseCityFromAddress = (address: string | null | undefined) => {
      const parts = (address || "").split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 3) return parts[parts.length - 3];
      if (parts.length >= 2) return parts[parts.length - 2];
      return t("Unknown City");
    };

    const buckets = new Map<string, AreaPreview>();
    mapNeeds.forEach((need) => {
      if (!Number.isFinite(need.latitude) || !Number.isFinite(need.longitude)) return;
      const area = (need.colony || need.street || "").trim() || parseAreaFromAddress(need.address);
      const city = (need.city || "").trim() || parseCityFromAddress(need.address);
      const key = `${city.toLowerCase()}|${area.toLowerCase()}`;
      const existing = buckets.get(key) ?? {
        key,
        area,
        city,
        total: 0,
        active: 0,
        inProgress: 0,
        completed: 0,
        dominantStatus: "active" as const,
      };

      existing.total += 1;
      if (["resolved", "closed"].includes(need.status)) {
        existing.completed += 1;
      } else if (need.status === "in_progress") {
        existing.inProgress += 1;
      } else {
        existing.active += 1;
      }

      const ranked = [
        ["active", existing.active],
        ["in_progress", existing.inProgress],
        ["completed", existing.completed],
      ] as const;
      existing.dominantStatus = [...ranked].sort((a, b) => b[1] - a[1])[0][0];
      buckets.set(key, existing);
    });

    return [...buckets.values()].sort((a, b) => b.total - a.total).slice(0, 4);
  }, [mapNeeds, showNeedsOrganizationMap, t]);

  const validBranchMarkers = useMemo(
    () =>
      branches
        .map((branch) => {
          if (!branch.branch_location) return null;
          try {
            const [lat, lng] = branch.branch_location.split(",").map((s) => parseFloat(s.trim()));
            if (isNaN(lat) || isNaN(lng)) return null;
            return {
              lat,
              lng,
              label: branch.organization_name,
            };
          } catch {
            return null;
          }
        })
        .filter((m): m is { lat: number; lng: number; label: string } => m !== null),
    [branches],
  );

  const webMapHtml = useMemo(() => {
    if (!location && !(showNeedsOrganizationMap && mapNeeds.length > 0)) return null;
    const markers = [
      ...(location ? [{ lat: location.latitude, lng: location.longitude, label: t("Headquarter / Current Location") }] : []),
      ...(isOrgOwner ? validBranchMarkers : []),
    ];
    const needsForMap = mapNeeds
      .filter((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude))
      .map((n) => ({
        id: n.id,
        lat: n.latitude,
        lng: n.longitude,
        status: n.status,
        title: translateText(n.title),
        description: translateText(n.description || ""),
        category: n.category,
        urgency: n.urgency,
        affected_count: n.affected_count ?? null,
        priority_score: n.priority_score ?? null,
        created_at: n.created_at,
        area: (n.colony || n.street || "").trim(),
        city: (n.city || "").trim(),
        address: translateAddress(n.address),
      }));
    const organizationsForMap = mapOrganizations
      .map((organization) => {
        const [latText, lngText] = (organization.branch_location || "").split(",").map((part) => part.trim());
        const lat = Number(latText);
        const lng = Number(lngText);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: organization.id,
          lat,
          lng,
          name: translateText(organization.organization_name),
          address: translateAddress(organization.address),
          phone: organization.phone || "",
          is_branch: Boolean(organization.is_branch),
        };
      })
      .filter((organization): organization is { id: number; lat: number; lng: number; name: string; address: string; phone: string; is_branch: boolean } => organization !== null);
    const volunteersForMap = mapVolunteers
      .filter((volunteer) => typeof volunteer.latitude === "number" && typeof volunteer.longitude === "number")
      .map((volunteer) => ({
        id: volunteer.id,
        lat: volunteer.latitude as number,
        lng: volunteer.longitude as number,
        name: volunteer.user_name || `Volunteer #${volunteer.id}`,
        phone: volunteer.phone || "",
        area: volunteer.colony || "",
        city: volunteer.city || "",
        availability: volunteer.availability,
        verified: volunteer.verified,
        tasks_completed: volunteer.tasks_completed,
        active_tasks: volunteer.active_tasks,
      }));
    const mapLabels = {
      need: t("Need"),
      status: t("Status"),
      category: t("Category"),
      urgency: t("Urgency"),
      affected: t("Affected"),
      priority: t("Priority"),
      address: t("Address"),
      unknownLocation: t("Unknown location"),
      notAvailable: t("Not available"),
      openNeedDetails: t("Open need details"),
      organizationPointer: t("Organization pointer"),
      volunteerPointer: t("Volunteer pointer"),
      type: t("Type"),
      branchOrganization: t("Branch organization"),
      partnerOrganization: t("Partner organization"),
      areaOrganization: t("Area organization"),
      phone: t("Phone"),
      available: t("Available"),
      busy: t("Busy"),
      verified: t("Verified"),
      area: t("Area"),
      nearbyArea: t("Nearby area"),
      tasks: t("Tasks"),
      completed: t("completed"),
      active: t("active"),
      moreNeedsInThisArea: t("more needs in this area."),
      colony: t("Colony"),
      progress: t("Progress"),
      done: t("Done"),
      total: t("Total"),
      topCategoryApiFilteredNeeds: t("Top Category: API filtered needs"),
      needsHeatMap: t("NEEDS HEAT MAP"),
      activeNeeds: t("Active Needs"),
      inProgress: t("In Progress"),
      intensityLowHigh: t("Intensity: Low to High"),
      currentLocation: t("Current location"),
      nearbyHighlightedAreas: t("Nearby highlighted areas are outlined in cyan."),
    };

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
    <style>
      html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
      body { background: #fff; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overflow: hidden; }
      #map { background: #fff; }
      .leaflet-control-zoom a { color: #111827; }
      .current-location-label { background: rgba(37,99,235,0.95); border: 1px solid rgba(255,255,255,0.55); border-radius: 999px; box-shadow: 0 10px 22px rgba(37,99,235,0.3); color: #fff; font: 800 11px system-ui, sans-serif; padding: 4px 8px; }
      .area-label { background: rgba(0,0,0,0.72); border: 1px solid rgba(255,255,255,0.34); border-radius: 999px; box-shadow: 0 10px 22px rgba(0,0,0,0.28); color: #fff; font: 800 11px system-ui, sans-serif; padding: 4px 8px; }
      .area-popup .leaflet-popup-content-wrapper { border-radius: 14px; box-shadow: 0 18px 40px rgba(15,23,42,0.28); }
      .area-popup .leaflet-popup-content { margin: 0; min-width: 190px; }
      .popup-card { padding: 12px; color: #111827; }
      .popup-title { font-size: 14px; font-weight: 800; margin-bottom: 2px; }
      .popup-city { color: #64748B; font-size: 11px; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; }
      .popup-total { align-items: baseline; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 10px; }
      .popup-total strong { font-size: 22px; }
      .popup-grid { display: grid; gap: 6px; grid-template-columns: repeat(3, 1fr); }
      .popup-stat { border-radius: 10px; padding: 7px 6px; text-align: center; }
      .popup-stat strong { display: block; font-size: 16px; }
      .popup-stat span { display: block; font-size: 10px; font-weight: 800; margin-top: 2px; text-transform: uppercase; }
      .legend { background: rgba(255,255,255,0.96); border: 1px solid rgba(15,23,42,0.1); border-radius: 12px; box-shadow: 0 16px 36px rgba(15,23,42,0.22); color: #111827; font: 12px system-ui, sans-serif; padding: 10px 12px; }
      .heat-toolbar { background: rgba(255,255,255,0.96); border: 1px solid rgba(15,23,42,0.12); border-radius: 14px; box-shadow: 0 16px 36px rgba(15,23,42,0.22); color: #111827; font: 12px system-ui, sans-serif; max-width: 330px; padding: 10px; }
      .toolbar-title { font-size: 12px; font-weight: 900; letter-spacing: 0.2px; margin-bottom: 8px; }
      .toolbar-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 7px; }
      .filter-btn { background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 999px; color: #334155; cursor: pointer; font: 800 11px system-ui, sans-serif; padding: 6px 9px; }
      .filter-btn.active { background: #111827; border-color: #111827; color: #fff; }
      .toolbar-select { background: #fff; border: 1px solid #CBD5E1; border-radius: 9px; color: #111827; font: 800 11px system-ui, sans-serif; min-width: 104px; padding: 6px 8px; }
      .info-panel { background: rgba(255,255,255,0.96); border: 1px solid rgba(15,23,42,0.12); border-radius: 14px; box-shadow: 0 16px 36px rgba(15,23,42,0.22); color: #111827; font: 12px system-ui, sans-serif; min-width: 230px; padding: 12px; }
      .info-title { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
      .info-city { color: #64748B; font-size: 10px; font-weight: 800; margin-bottom: 10px; text-transform: uppercase; }
      .info-row { align-items: center; display: grid; gap: 8px; grid-template-columns: 82px 28px 1fr; margin: 6px 0; }
      .info-bar { background: #E2E8F0; border-radius: 999px; height: 7px; overflow: hidden; }
      .info-fill { border-radius: 999px; height: 100%; }
      .cluster-bubble { align-items: center; border: 2px solid #fff; border-radius: 999px; box-shadow: 0 8px 20px rgba(15,23,42,0.32); color: #fff; display: flex; font: 900 12px system-ui, sans-serif; height: 30px; justify-content: center; width: 30px; }
      .entity-pin { align-items: center; border: 2px solid #fff; border-radius: 999px 999px 999px 4px; box-shadow: 0 12px 24px rgba(15,23,42,0.32); color: #fff; display: flex; font: 900 14px system-ui, sans-serif; height: 30px; justify-content: center; transform: rotate(-45deg); width: 30px; }
      .entity-pin span { transform: rotate(45deg); }
      .org-pin { background: #7C3AED; }
      .volunteer-pin { background: #0891B2; }
      .entity-popup { color: #111827; min-width: 210px; padding: 10px; }
      .entity-title { font-size: 14px; font-weight: 900; margin-bottom: 3px; }
      .entity-kind { color: #64748B; font-size: 10px; font-weight: 900; margin-bottom: 8px; text-transform: uppercase; }
      .entity-meta { color: #334155; font-size: 12px; font-weight: 700; line-height: 1.45; }
      .area-bubble { align-items: center; border: 2px solid rgba(15,23,42,0.82); border-radius: 999px; box-shadow: 0 16px 34px rgba(15,23,42,0.28); color: #fff; cursor: pointer; display: flex; font: 900 12px system-ui, sans-serif; justify-content: center; text-shadow: 0 1px 2px rgba(0,0,0,0.45); }
      .area-bubble.nearby { border-color: #0F766E; box-shadow: 0 0 0 8px rgba(64,224,208,0.28), 0 16px 34px rgba(15,23,42,0.28); }
      .current-dot { align-items: center; background: #2563EB; border: 3px solid #FFFFFF; border-radius: 999px; box-shadow: 0 0 0 9px rgba(37,99,235,0.16), 0 10px 22px rgba(37,99,235,0.32); color: #fff; display: flex; font: 900 11px system-ui, sans-serif; height: 22px; justify-content: center; width: 22px; }
      .need-dot { align-items: center; border: 2px solid #FFFFFF; border-radius: 999px; box-shadow: 0 8px 18px rgba(15,23,42,0.32); color: #fff; cursor: pointer; display: flex; font: 900 9px system-ui, sans-serif; height: 18px; justify-content: center; width: 18px; }
      .need-dot.active { background: #E63B2E; }
      .need-dot.in_progress { background: #F5A623; }
      .need-dot.completed { background: #4CAF50; }
      .need-popup { color: #111827; min-width: 230px; padding: 10px; }
      .need-popup-title { color: #111827; font-size: 13px; font-weight: 900; line-height: 1.25; margin-bottom: 6px; }
      .need-popup-meta { color: #475569; font-size: 11px; font-weight: 700; line-height: 1.45; }
      .area-needs-list { border-top: 1px solid #E2E8F0; display: grid; gap: 8px; margin-top: 10px; max-height: 280px; overflow-y: auto; padding-top: 10px; }
      .area-need-item { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px; }
      .area-need-title { color: #111827; font-size: 12px; font-weight: 900; line-height: 1.3; margin-bottom: 5px; }
      .area-need-meta { color: #475569; font-size: 11px; font-weight: 700; line-height: 1.4; }
      .need-detail-btn { background: #111827; border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: 900 11px system-ui, sans-serif; margin-top: 7px; padding: 7px 8px; width: 100%; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
    <script>
      const markers = ${JSON.stringify(markers)};
      const needs = ${JSON.stringify(needsForMap)};
      const organizations = ${JSON.stringify(organizationsForMap)};
      const volunteers = ${JSON.stringify(volunteersForMap)};
      const mapLabels = ${JSON.stringify(mapLabels)};
      const showAdminHeatmap = ${JSON.stringify(showNeedsOrganizationMap)};
      const currentLocation = ${JSON.stringify(location ? { lat: location.latitude, lng: location.longitude } : null)};
      const openFullMapView = false;

      const normalizeStatus = (status) => {
        const value = (status || '').toLowerCase();
        if (value === 'resolved' || value === 'closed') return 'completed';
        if (value === 'in_progress') return 'in_progress';
        return 'active';
      };

      const parseCityFromAddress = (address) => {
        if (!address) return mapLabels.notAvailable;
        const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 3) return parts[parts.length - 3];
        if (parts.length >= 2) return parts[parts.length - 2];
        return parts[0] || mapLabels.notAvailable;
      };

      const parseAreaFromAddress = (address) => {
        if (!address) return mapLabels.notAvailable;
        const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
        return parts[0] || mapLabels.notAvailable;
      };

      const hexToRgb = (hex) => {
        const value = parseInt(hex.replace('#', ''), 16);
        return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
      };

      const rgbToHex = (r, g, b) => {
        const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
        return '#' + toHex(r) + toHex(g) + toHex(b);
      };

      const darken = (hex, factor) => {
        const rgb = hexToRgb(hex);
        return rgbToHex(rgb.r * (1 - factor), rgb.g * (1 - factor), rgb.b * (1 - factor));
      };

      const statusConfig = {
        active: { label: mapLabels.active, color: '#EF4444', soft: '#FEE2E2', text: '#991B1B' },
        in_progress: { label: mapLabels.inProgress, color: '#F59E0B', soft: '#FEF3C7', text: '#92400E' },
        completed: { label: mapLabels.completed, color: '#22C55E', soft: '#DCFCE7', text: '#166534' },
      };

      const distanceKm = (a, b) => {
        const toRad = (value) => value * Math.PI / 180;
        const earthKm = 6371;
        const dLat = toRad(b[0] - a[0]);
        const dLng = toRad(b[1] - a[1]);
        const lat1 = toRad(a[0]);
        const lat2 = toRad(b[0]);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
      };

      const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
      const formatText = (value) => String(value || mapLabels.notAvailable).replace(/_/g, ' ');
      const openNeedDetail = (needId) => {
        const message = { source: 'needmap-admin-map', type: 'openNeed', needId };
        let openedInAppWindow = false;
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(message, '*');
          openedInAppWindow = true;
        }
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, '*');
          openedInAppWindow = true;
          try { window.opener.focus(); } catch (error) {}
        }
        if (openFullMapView && openedInAppWindow) {
          window.setTimeout(() => window.close(), 80);
        }
      };

      document.addEventListener('click', (event) => {
        const target = event.target && event.target.closest ? event.target.closest('[data-need-id]') : null;
        if (!target) return;
        const needId = Number(target.getAttribute('data-need-id'));
        if (Number.isFinite(needId)) openNeedDetail(needId);
      });

      const dominantStatus = (area) => {
        const ranked = [['active', area.active], ['in_progress', area.in_progress], ['completed', area.completed]];
        ranked.sort((a, b) => b[1] - a[1]);
        return ranked[0][0];
      };

      const buildAreaList = (sourceNeeds) => {
        const areaBuckets = {};
        sourceNeeds.forEach((need) => {
          const cityName = (need.city && String(need.city).trim()) || parseCityFromAddress(need.address);
          const areaName = (need.area && String(need.area).trim()) || parseAreaFromAddress(need.address);
          const bucketKey = cityName.toLowerCase() + '|' + areaName.toLowerCase();
          if (!areaBuckets[bucketKey]) {
            areaBuckets[bucketKey] = { area: areaName, city: cityName, points: [], needs: [], total: 0, active: 0, in_progress: 0, completed: 0 };
          }
          const statusKey = normalizeStatus(need.status);
          areaBuckets[bucketKey].points.push([need.lat, need.lng]);
          areaBuckets[bucketKey].needs.push(need);
          areaBuckets[bucketKey].total += 1;
          areaBuckets[bucketKey][statusKey] += 1;
        });
        return Object.values(areaBuckets);
      };

      const cross = (origin, a, b) =>
        (a[1] - origin[1]) * (b[0] - origin[0]) - (a[0] - origin[0]) * (b[1] - origin[1]);

      const convexHull = (points) => {
        const unique = Array.from(new Map(points.map((point) => [point.join(','), point])).values())
          .sort((a, b) => a[1] === b[1] ? a[0] - b[0] : a[1] - b[1]);
        if (unique.length <= 2) return unique;
        const lower = [];
        unique.forEach((point) => {
          while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
          lower.push(point);
        });
        const upper = [];
        [...unique].reverse().forEach((point) => {
          while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
          upper.push(point);
        });
        upper.pop();
        lower.pop();
        return lower.concat(upper);
      };

      const buildAreaPolygon = (points, intensity) => {
        const hull = convexHull(points);
        const center = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]).map((value) => value / points.length);
        const pad = 0.004 + intensity * 0.008;
        if (hull.length === 1) {
          const point = hull[0];
          return [[point[0] + pad, point[1]], [point[0], point[1] + pad * 1.25], [point[0] - pad, point[1]], [point[0], point[1] - pad * 1.25]];
        }
        if (hull.length === 2) {
          const [a, b] = hull;
          const dx = b[1] - a[1];
          const dy = b[0] - a[0];
          const length = Math.max(Math.sqrt(dx * dx + dy * dy), 0.0001);
          const offsetLat = (dx / length) * pad;
          const offsetLng = (-dy / length) * pad;
          return [[a[0] + offsetLat, a[1] + offsetLng], [b[0] + offsetLat, b[1] + offsetLng], [b[0] - offsetLat, b[1] - offsetLng], [a[0] - offsetLat, a[1] - offsetLng]];
        }
        return hull.map((point) => {
          const vectorLat = point[0] - center[0];
          const vectorLng = point[1] - center[1];
          const length = Math.max(Math.sqrt(vectorLat * vectorLat + vectorLng * vectorLng), 0.0001);
          return [point[0] + (vectorLat / length) * pad, point[1] + (vectorLng / length) * pad];
        });
      };

      const areaCenter = (points) =>
        points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]).map((value) => value / points.length);

      const getNearbyAreaKeys = (areaList) => {
        const nearbyAreaKeys = new Set();
        if (!showAdminHeatmap || !currentLocation || areaList.length === 0) return nearbyAreaKeys;
        areaList
          .map((area) => ({ area, distance: distanceKm([currentLocation.lat, currentLocation.lng], areaCenter(area.points)) }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3)
          .forEach((item) => nearbyAreaKeys.add(item.area.city.toLowerCase() + '|' + item.area.area.toLowerCase()));
        return nearbyAreaKeys;
      };

      const map = L.map('map', { zoomControl: true });
      const hasUsableMapSize = () => {
        const size = map.getSize();
        const container = map.getContainer();
        return size.x > 0 && size.y > 0 && container.clientWidth > 0 && container.clientHeight > 0;
      };
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        opacity: showAdminHeatmap ? 0.82 : 1,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const bounds = [];
      const interpolate = (from, to, value) => {
        const fromRgb = hexToRgb(from);
        const toRgb = hexToRgb(to);
        return rgbToHex(
          fromRgb.r + (toRgb.r - fromRgb.r) * value,
          fromRgb.g + (toRgb.g - fromRgb.g) * value,
          fromRgb.b + (toRgb.b - fromRgb.b) * value,
        );
      };
      const statusColors = { active: '#E63B2E', in_progress: '#F5A623', completed: '#4CAF50' };
      const statusLabels = { active: mapLabels.active, in_progress: mapLabels.inProgress, completed: mapLabels.completed };
      const intensityColor = (status, intensity) => {
        const base = statusColors[status] || '#E63B2E';
        return interpolate('#F8FAFC', base, Math.max(0.35, intensity));
      };
      const priorityWeight = (need) => {
        const urgency = String(need.urgency || '').toLowerCase();
        if (urgency === 'critical') return 1;
        if (urgency === 'high') return 0.85;
        if (urgency === 'medium') return 0.62;
        return 0.42;
      };
      const inTimeRange = (need, range) => {
        if (range === 'all') return true;
        if (!need.created_at) return true;
        const created = new Date(need.created_at).getTime();
        if (!Number.isFinite(created)) return true;
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        if (range === 'today') return now - created <= day;
        if (range === 'week') return now - created <= day * 7;
        if (range === 'month') return now - created <= day * 31;
        return true;
      };
      let selectedStatus = 'all';
      let selectedMode = 'heat';
      let selectedTime = 'all';
      let selectedCategory = 'all';
      let zonesLayer = L.layerGroup().addTo(map);
      let markerLayer = L.layerGroup().addTo(map);
      let needLayer = L.layerGroup().addTo(map);
      let heatLayer = null;
      let firstRender = true;

      const entityIcon = (kind) => L.divIcon({
        className: '',
        html: '<div class="entity-pin ' + kind + '-pin"><span>' + (kind === 'org' ? 'O' : 'V') + '</span></div>',
        iconSize: [34, 34],
        iconAnchor: [8, 28],
        popupAnchor: [8, -28],
      });

      const areaBubbleIcon = (area, status, intensity, isNearby) => {
        const size = Math.round(58 + Math.min(1, intensity) * 62);
        const color = intensityColor(status, intensity);
        return L.divIcon({
          className: '',
          html: '<div class="area-bubble ' + (isNearby ? 'nearby' : '') + '" style="width:' + size + 'px;height:' + size + 'px;background:' + color + ';">' + area.total + '</div>',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2],
        });
      };

      const currentLocationIcon = () => L.divIcon({
        className: '',
        html: '<div class="current-dot">•</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      const needDotIcon = (status) => L.divIcon({
        className: '',
        html: '<div class="need-dot ' + status + '">N</div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -12],
      });

      const needPopupHtml = (need) => {
        const status = normalizeStatus(need.status);
        const affected = typeof need.affected_count === 'number' ? need.affected_count : mapLabels.notAvailable;
        const score = typeof need.priority_score === 'number' ? need.priority_score.toFixed(2) : mapLabels.notAvailable;
        return '<div class="need-popup">' +
          '<div class="need-popup-title">' + escapeHtml(need.title || mapLabels.need + ' #' + need.id) + '</div>' +
          '<div class="need-popup-meta">' +
            '<b>' + mapLabels.status + ':</b> ' + escapeHtml(statusLabels[status] || formatText(need.status)) + '<br/>' +
            '<b>' + mapLabels.category + ':</b> ' + escapeHtml(formatText(need.category)) + '<br/>' +
            '<b>' + mapLabels.urgency + ':</b> ' + escapeHtml(formatText(need.urgency)) + '<br/>' +
            '<b>' + mapLabels.affected + ':</b> ' + escapeHtml(affected) + ' · <b>' + mapLabels.priority + ':</b> ' + escapeHtml(score) + '<br/>' +
            '<b>' + mapLabels.address + ':</b> ' + escapeHtml(need.address || mapLabels.unknownLocation) +
          '</div>' +
          '<button class="need-detail-btn" type="button" data-need-id="' + need.id + '" onclick="openNeedDetail(' + need.id + '); return false;">' + mapLabels.openNeedDetails + '</button>' +
        '</div>';
      };

      const renderNeedDots = (sourceNeeds) => {
        needLayer.clearLayers();
        const zoom = map.getZoom();
        if (!Number.isFinite(zoom) || zoom < 16) return;

        sourceNeeds.forEach((need) => {
          const status = normalizeStatus(need.status);
          L.marker([need.lat, need.lng], { icon: needDotIcon(status), zIndexOffset: 760 })
            .addTo(needLayer)
            .bindTooltip(need.title || 'Need', { direction: 'top', offset: [0, -8], opacity: 0.9 })
            .bindPopup(needPopupHtml(need));
        });
      };

      const renderEntityMarkers = () => {
        organizations.forEach((organization) => {
          L.marker([organization.lat, organization.lng], { icon: entityIcon('org'), zIndexOffset: 650 })
            .addTo(markerLayer)
            .bindPopup(
              '<div class="entity-popup">' +
                '<div class="entity-title">' + escapeHtml(organization.name) + '</div>' +
                '<div class="entity-kind">' + mapLabels.organizationPointer + '</div>' +
                '<div class="entity-meta">' +
                  '<b>' + mapLabels.type + ':</b> ' + (organization.is_branch ? mapLabels.branchOrganization : mapLabels.partnerOrganization) + '<br/>' +
                  '<b>' + mapLabels.address + ':</b> ' + escapeHtml(organization.address || mapLabels.areaOrganization) + '<br/>' +
                  '<b>' + mapLabels.phone + ':</b> ' + escapeHtml(organization.phone || mapLabels.notAvailable) +
                '</div>' +
              '</div>'
            );
        });

        volunteers.forEach((volunteer) => {
          L.marker([volunteer.lat, volunteer.lng], { icon: entityIcon('volunteer'), zIndexOffset: 700 })
            .addTo(markerLayer)
            .bindPopup(
              '<div class="entity-popup">' +
                '<div class="entity-title">' + escapeHtml(volunteer.name) + '</div>' +
                '<div class="entity-kind">' + mapLabels.volunteerPointer + '</div>' +
                '<div class="entity-meta">' +
                  '<b>' + mapLabels.status + ':</b> ' + (volunteer.availability ? mapLabels.available : mapLabels.busy) + (volunteer.verified ? ' · ' + mapLabels.verified : '') + '<br/>' +
                  '<b>' + mapLabels.area + ':</b> ' + escapeHtml([volunteer.area, volunteer.city].filter(Boolean).join(', ') || mapLabels.nearbyArea) + '<br/>' +
                  '<b>' + mapLabels.tasks + ':</b> ' + volunteer.tasks_completed + ' ' + mapLabels.completed + ' · ' + volunteer.active_tasks + ' ' + mapLabels.active + '<br/>' +
                  '<b>' + mapLabels.phone + ':</b> ' + escapeHtml(volunteer.phone || mapLabels.notAvailable) +
                '</div>' +
              '</div>'
            );
        });
      };

      const areaNeedsHtml = (area) => {
        const sortedNeeds = [...area.needs].sort((a, b) => priorityWeight(b) - priorityWeight(a)).slice(0, 8);
        const rows = sortedNeeds.map((need) => {
          const status = normalizeStatus(need.status);
          const affected = typeof need.affected_count === 'number' ? need.affected_count : mapLabels.notAvailable;
          const score = typeof need.priority_score === 'number' ? need.priority_score.toFixed(2) : mapLabels.notAvailable;
          const description = need.description ? '<div class="area-need-meta">' + escapeHtml(need.description) + '</div>' : '';
          return '<div class="area-need-item">' +
            '<div class="area-need-title">' + escapeHtml(need.title || mapLabels.need + ' #' + need.id) + '</div>' +
            '<div class="area-need-meta">' +
              '<b>' + mapLabels.status + ':</b> ' + escapeHtml(statusLabels[status] || formatText(need.status)) + '<br/>' +
              '<b>' + mapLabels.category + ':</b> ' + escapeHtml(formatText(need.category)) + ' · <b>' + mapLabels.urgency + ':</b> ' + escapeHtml(formatText(need.urgency)) + '<br/>' +
              '<b>' + mapLabels.affected + ':</b> ' + escapeHtml(affected) + ' · <b>' + mapLabels.priority + ':</b> ' + escapeHtml(score) + '<br/>' +
              '<b>' + mapLabels.address + ':</b> ' + escapeHtml(need.address || mapLabels.unknownLocation) +
            '</div>' +
            description +
            '<button class="need-detail-btn" type="button" data-need-id="' + need.id + '" onclick="openNeedDetail(' + need.id + '); return false;">' + mapLabels.openNeedDetails + '</button>' +
          '</div>';
        }).join('');

        const remaining = area.needs.length > sortedNeeds.length
          ? '<div class="area-need-meta">+' + (area.needs.length - sortedNeeds.length) + ' ' + mapLabels.moreNeedsInThisArea + '</div>'
          : '';
        return '<div class="area-needs-list">' + rows + remaining + '</div>';
      };

      const filteredNeeds = () => needs;

      const updateInfoPanel = (area) => {
        const max = Math.max(area.active, area.in_progress, area.completed, 1);
        const row = (label, value, color) =>
          '<div class="info-row"><span>' + label + '</span><strong>' + value + '</strong><div class="info-bar"><div class="info-fill" style="width:' + Math.round((value / max) * 100) + '%;background:' + color + '"></div></div></div>';
        const panel = document.getElementById('areaInfoPanel');
        if (!panel) return;
        panel.innerHTML =
          '<div class="info-title">' + mapLabels.colony + ': ' + escapeHtml(area.area) + '</div>' +
          '<div class="info-city">' + escapeHtml(area.city) + '</div>' +
          row(mapLabels.active, area.active, statusColors.active) +
          row(mapLabels.progress, area.in_progress, statusColors.in_progress) +
          row(mapLabels.done, area.completed, statusColors.completed) +
          '<div style="border-top:1px solid #E2E8F0;margin-top:10px;padding-top:9px;font-weight:900;">' + mapLabels.total + ': ' + area.total + '</div>' +
          '<div style="color:#64748B;font-size:10px;font-weight:800;margin-top:5px;">' + mapLabels.topCategoryApiFilteredNeeds + '</div>';
      };

      const updateLegend = (sourceNeeds) => {
        const summary = sourceNeeds.reduce((acc, need) => {
          acc[normalizeStatus(need.status)] += 1;
          return acc;
        }, { active: 0, in_progress: 0, completed: 0 });
        const legend = document.getElementById('heatLegend');
        if (!legend) return;
        legend.innerHTML =
          '<div style="font-weight:900;margin-bottom:9px;">' + mapLabels.needsHeatMap + '</div>' +
          '<div style="display:grid;gap:7px;">' +
            '<div><span style="background:' + statusColors.active + ';display:inline-block;height:12px;margin-right:7px;width:12px;"></span>' + mapLabels.activeNeeds + ' <strong>(' + summary.active + ')</strong></div>' +
            '<div><span style="background:' + statusColors.in_progress + ';display:inline-block;height:12px;margin-right:7px;width:12px;"></span>' + mapLabels.inProgress + ' <strong>(' + summary.in_progress + ')</strong></div>' +
            '<div><span style="background:' + statusColors.completed + ';display:inline-block;height:12px;margin-right:7px;width:12px;"></span>' + statusConfig.completed.label + ' <strong>(' + summary.completed + ')</strong></div>' +
          '</div>' +
          '<div style="margin-top:10px;font-size:11px;font-weight:800;">' + mapLabels.intensityLowHigh + '</div>';
      };

      const renderAdminMap = () => {
        const sourceNeeds = filteredNeeds();
        const areaList = buildAreaList(sourceNeeds);
        zonesLayer.clearLayers();
        markerLayer.clearLayers();
        needLayer.clearLayers();
        if (heatLayer) {
          map.removeLayer(heatLayer);
          heatLayer = null;
        }
        updateLegend(sourceNeeds);

        if (L.heatLayer && sourceNeeds.length > 0 && hasUsableMapSize()) {
          try {
            heatLayer = L.heatLayer(sourceNeeds.map((need) => [need.lat, need.lng, priorityWeight(need)]), {
              radius: 54,
              blur: 30,
              maxZoom: 16,
              minOpacity: 0.42,
              gradient: { 0.12: '#166534', 0.38: '#B45309', 0.68: '#C2410C', 1: '#7F1D1D' },
            }).addTo(map);
          } catch (error) {
            heatLayer = null;
            console.warn('NeedMap heat layer skipped until the map has a drawable canvas size.', error);
          }
        }

        if (firstRender) sourceNeeds.forEach((need) => bounds.push([need.lat, need.lng]));
        renderEntityMarkers();
        map.off('zoomend');
        map.on('zoomend', () => renderNeedDots(sourceNeeds));

        if (areaList[0]) updateInfoPanel([...areaList].sort((a, b) => b.total - a.total)[0]);
        firstRender = false;
      };

      if (showAdminHeatmap && needs.length > 0) {
        if (currentLocation) {
          L.marker([currentLocation.lat, currentLocation.lng], { icon: currentLocationIcon(), zIndexOffset: 900 })
            .addTo(map)
            .bindTooltip(mapLabels.currentLocation, { className: 'current-location-label', direction: 'top', offset: [0, -10], permanent: true, opacity: 0.95 })
            .bindPopup('<b>' + mapLabels.currentLocation + '</b><br/>' + mapLabels.nearbyHighlightedAreas);
          bounds.push([currentLocation.lat, currentLocation.lng]);
        }

        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function () {
          const div = L.DomUtil.create('div', 'legend');
          div.id = 'heatLegend';
          return div;
        };
        legend.addTo(map);

        renderAdminMap();
      } else {
        markers.forEach((m) => {
          const marker = L.marker([m.lat, m.lng]).addTo(map);
          if (m.label) marker.bindPopup(m.label);
          bounds.push([m.lat, m.lng]);
        });
      }

      if (showAdminHeatmap && openFullMapView && currentLocation) {
        map.setView([currentLocation.lat, currentLocation.lng], 16);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [18, 18], maxZoom: showAdminHeatmap ? 15 : 19 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], showAdminHeatmap ? 15 : 14);
      } else {
        map.setView([20.5937, 78.9629], 4);
      }

      window.requestAnimationFrame(() => {
        map.invalidateSize(false);
        if (showAdminHeatmap && !heatLayer && hasUsableMapSize()) renderAdminMap();
        if (showAdminHeatmap) renderNeedDots(needs);
      });
    </script>
  </body>
</html>`;
  }, [location, isOrgOwner, showNeedsOrganizationMap, validBranchMarkers, mapNeeds, mapOrganizations, mapVolunteers, t, translateAddress, translateText]);

  const openMap = () => {
    if (!location && !(showNeedsOrganizationMap && webMapHtml)) return;

    if (Platform.OS === "web" && webMapHtml) {
      const fullMapHtml = webMapHtml.replace(
        "const openFullMapView = false;",
        "const openFullMapView = true;",
      );
      const blob = new Blob([fullMapHtml], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      // Delay revocation so the new tab has time to load the map content.
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }

    // Mobile fallback when web map HTML is unavailable.
    const fallbackLat = location?.latitude ?? 20.5937;
    const fallbackLng = location?.longitude ?? 78.9629;
    const osmUrl = `https://www.openstreetmap.org/?mlat=${fallbackLat}&mlon=${fallbackLng}#map=14/${fallbackLat}/${fallbackLng}`;
    Linking.openURL(osmUrl);
  };

  const getBranchMarkerColor = (index: number) => {
    const colors = ["blue", "red", "green", "yellow", "orange", "purple", "pink"];
    return colors[index % colors.length];
  };

  const mapImageUrl = useMemo(() => {
    if (!location) return null;
    
    let markerString = `${location.latitude},${location.longitude},red-pushpin`;
    
    // Add branch markers for owner role
    if (isOrgOwner && branches.length > 0) {
      branches.forEach((branch, index) => {
        if (branch.branch_location) {
          try {
            const [lat, lng] = branch.branch_location.split(",").map(s => parseFloat(s.trim()));
            if (!isNaN(lat) && !isNaN(lng)) {
              const color = getBranchMarkerColor(index);
              markerString += `&markers=${lat},${lng},${color}-marker`;
            }
          } catch {
            // Skip invalid branch location
          }
        }
      });
    }
    
    return `https://maps.wikimedia.org/img/osm-intl,14,${location.longitude},${location.latitude},600x200.png`;
  }, [location, branches, isOrgOwner]);

  const addressParts = useMemo(() => {
    if (!location?.address) return null;
    const parts = location.address.split(", ");
    return {
      area: parts[0] || "",
      city: parts[1] || "",
      state: parts[2] || "",
      pincode: parts[3] || "",
      country: parts[4] || "",
    };
  }, [location]);

  const getStoryImage = (story: HomeStory): string => {
    if (story.image_url) return story.image_url;
    if (!story.media_urls) return "";
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

  const impactStories = homeStories.slice(0, 3);

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
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View style={[styles.header, { transform: [{ translateY: slideUp }] }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.greeting, lightPrimary]}>
                {t("Welcome")}, {user?.user_name || t("User")}
              </Text>
              <Text style={[styles.role, lightMuted]}>
                {isOrgManager ? t("Organization Admin") : t("Volunteer")}
              </Text>
            </View>
            <Pressable style={styles.avatarBtn} onPress={() => nav.navigate("Profile")}>
              <LinearGradient colors={["#667EEA", "#764BA2"]} style={styles.avatarGradient}>
                <Text style={styles.avatarText}>
                  {(user?.user_name || "U").charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* ORG INFO - Only for org owners */}
          {isOrgManager && orgInfo ? (
            <View style={[styles.section, lightCard]}>
              <View style={styles.orgHeader}>
                <LinearGradient colors={["#667EEA", "#764BA2"]} style={styles.orgIcon}>
                  <Text style={styles.orgIconText}>
                    {translateText(orgInfo.organization_name).charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
                <View style={styles.orgHeaderInfo}>
                  <Text style={[styles.orgName, lightPrimary]}>{translateText(orgInfo.organization_name)}</Text>
                  <View style={[styles.orgStatusBadge, orgInfo.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                    <Text style={styles.orgStatusText}>{orgInfo.is_active ? t("Active") : t("Inactive")}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.orgDetails}>
                <View style={styles.orgDetailRow}>
                  <Text style={[styles.orgDetailLabel, lightSecondary]}>{t("Org ID")}</Text>
                  <Text style={[styles.orgDetailValue, lightPrimary]}>#{user?.organization_id ?? orgInfo.id}</Text>
                </View>

                {isAdmin ? (
                  <>
                    <View style={styles.orgDetailRow}>
                      <Text style={[styles.orgDetailLabel, lightSecondary]}>{t("Branch ID")}</Text>
                      <Text style={[styles.orgDetailValue, lightPrimary]}>#{scopedOrganizationId ?? orgInfo.id}</Text>
                    </View>
                    <View style={styles.orgDetailRow}>
                      <Text style={[styles.orgDetailLabel, lightSecondary]}>{t("Branch Address")}</Text>
                      <Text style={[styles.orgDetailValue, lightPrimary]}>{orgInfo.address || orgInfo.branch_location ? translateAddress(orgInfo.address || orgInfo.branch_location) : t("Not specified")}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.orgDetailRow}>
                      <Text style={[styles.orgDetailLabel, lightSecondary]}>{t("Headquarter")}</Text>
                      <Text style={[styles.orgDetailValue, lightPrimary]}>{orgInfo.address ? translateAddress(orgInfo.address) : t("Not specified")}</Text>
                    </View>
                    <View style={styles.orgDetailRow}>
                      <Text style={[styles.orgDetailLabel, lightSecondary]}>{t("Total Branches")}</Text>
                      <Text style={[styles.orgDetailValue, lightPrimary]}>{branches.length}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Org Stats */}
              <View style={styles.orgStatsRow}>
                <View style={styles.orgStatItem}>
                  <Text style={[styles.orgStatNum, lightPrimary]}>{orgNeedsCount}</Text>
                  <Text style={[styles.orgStatLabel, lightSecondary]}>{isAdmin ? t("Total") : t("Total Created")}</Text>
                </View>
                <View style={styles.orgStatItem}>
                  <Text style={[styles.orgStatNum, lightPrimary]}>{orgActiveNeedsCount}</Text>
                    <Text style={[styles.orgStatLabel, lightSecondary]}>{t("Active")}</Text>
                </View>
                <View style={styles.orgStatItem}>
                  <Text style={[styles.orgStatNum, lightPrimary]}>{orgCompletedNeedsCount}</Text>
                    <Text style={[styles.orgStatLabel, lightSecondary]}>{t("Completed")}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Volunteer Rating */}
          {isVolunteer ? (
            <View style={[styles.section, lightCard]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, lightPrimary]}>{t("Your Volunteer Rating")}</Text>
                <Pressable onPress={() => goToMainTab("Assignments")}>
                  <Text style={[styles.seeAll, lightPrimary]}>{t("Details")}</Text>
                </Pressable>
              </View>
              {volunteerAverageRating === null ? (
                <Text style={[styles.emptyText, lightSecondary]}>
                  {t("Organization or branch rating for your volunteer work will appear here.")}
                </Text>
              ) : (
                <View style={styles.volunteerRatingCard}>
                  <View style={styles.volunteerRatingTopRow}>
                    <View>
                      <Text style={[styles.volunteerRatingLabel, lightSecondary]}>{t("Organization rating")}</Text>
                      <View style={styles.volunteerRatingScoreRow}>
                        <Text style={[styles.volunteerRatingScore, lightPrimary]}>
                          {volunteerAverageRating.toFixed(1)}
                        </Text>
                        <Text style={[styles.volunteerRatingOutOf, lightSecondary]}>/ 5</Text>
                      </View>
                    </View>
                    <View style={styles.volunteerRatingBadge}>
                      <Text style={styles.volunteerRatingBadgeText}>{t("Branch Rated")}</Text>
                    </View>
                  </View>
                  <View style={styles.volunteerRatingStars}>
                    {volunteerRatingStars.map((filled, index) => (
                      <Text
                        key={`rating-star-${index}`}
                        style={[styles.volunteerRatingStar, filled ? styles.volunteerRatingStarFilled : null]}
                      >
                        ★
                      </Text>
                    ))}
                  </View>
                  <Text style={[styles.volunteerRatingMeta, lightSecondary]}>
                    {t("Given by the organization and its branch for your completed work")}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Location Section */}
          <View style={[styles.section, lightCard]}>
            <Text style={[styles.sectionTitle, lightPrimary]}>{t("Your Location")}</Text>
            {locationLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#667EEA" size="small" />
                <Text style={[styles.loadingText, lightSecondary]}>{t("Fetching location...")}</Text>
              </View>
            ) : location || (showNeedsOrganizationMap && webMapHtml) ? (
              <>
                {/* Embedded Map */}
                <View style={styles.mapSection}>
                  {Platform.OS === "web" && webMapHtml ? (
                    <View style={styles.mapContainer}>
                      {createElement("iframe", {
                        srcDoc: webMapHtml,
                        style: { width: "100%", height: "100%", border: "none", borderRadius: 12 },
                        title: t("Branch Details"),
                        loading: "lazy",
                      })}
                    </View>
                  ) : mapImageUrl ? (
                    <View style={styles.mapContainer}>
                      <Image
                        source={{ uri: mapImageUrl }}
                        style={styles.mapImage}
                        resizeMode="cover"
                      />
                    </View>
                  ) : null}

                  {showNeedsOrganizationMap && needAreaPreview.length > 0 ? (
                    <View style={styles.areaPreviewWrap}>
                      <View style={styles.areaPreviewHeader}>
                        <Text style={[styles.areaPreviewTitle, lightPrimary]}>{t("Area preview")}</Text>
                        <Text style={[styles.areaPreviewHint, lightSecondary]}>{t("Top need clusters")}</Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaPreviewList}>
                        {needAreaPreview.map((area) => (
                          <View key={area.key} style={[styles.areaPreviewCard, isLight ? { borderColor: "#000000" } : null]}>
                            <View style={styles.areaPreviewTopRow}>
                              <View style={[styles.areaStatusRail, { backgroundColor: getAreaStatusColor(area.dominantStatus) }]} />
                              <View style={styles.areaPreviewNameWrap}>
                                <Text style={[styles.areaPreviewName, lightPrimary]} numberOfLines={1}>{area.area}</Text>
                                <Text style={[styles.areaPreviewCity, lightSecondary]} numberOfLines={1}>{area.city}</Text>
                              </View>
                              <Text style={[styles.areaPreviewTotal, lightPrimary]}>{area.total}</Text>
                            </View>
                            <View style={styles.areaPreviewStats}>
                              <View style={styles.areaMiniStat}>
                                <Text style={[styles.areaMiniValue, { color: "#EF4444" }]}>{area.active}</Text>
                                <Text style={[styles.areaMiniLabel, lightSecondary]}>{t("Active")}</Text>
                              </View>
                              <View style={styles.areaMiniStat}>
                                <Text style={[styles.areaMiniValue, { color: "#F59E0B" }]}>{area.inProgress}</Text>
                                <Text style={[styles.areaMiniLabel, lightSecondary]}>{t("Progress")}</Text>
                              </View>
                              <View style={styles.areaMiniStat}>
                                <Text style={[styles.areaMiniValue, { color: "#22C55E" }]}>{area.completed}</Text>
                                <Text style={[styles.areaMiniLabel, lightSecondary]}>{t("Done")}</Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  <Pressable onPress={openMap} style={styles.mapBtn}>
                    <Text style={[styles.mapBtnText, lightPrimary]}>{t("Open Full Map")}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={[styles.errorText, isLight ? { color: "#B91C1C", fontWeight: "700" } : null]}>
                {t("Location unavailable. Please enable location permissions.")}
              </Text>
            )}
          </View>

          {/* Nearby Needs / Campaigns */}
          <View style={[styles.section, lightCard]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, lightPrimary]}>
                {isOrgManager ? t("Organization Needs") : t("Nearby Campaigns")}
              </Text>
              <Pressable onPress={() => goToMainTab("Needs")}>
                <Text style={[styles.seeAll, lightPrimary]}>{t("See All")}</Text>
              </Pressable>
            </View>
            {nearbyNeeds.length === 0 ? (
              <Text style={[styles.emptyText, lightSecondary]}>
                {isOrgManager ? t("No needs created yet. Go to Needs tab to create one.") : t("No active campaigns nearby")}
              </Text>
            ) : (
              nearbyNeeds.slice(0, 3).map((need) => (
                <Pressable
                  key={need.id}
                  style={styles.campaignItem}
                  onPress={() => goToMainTab("Needs")}
                >
                  <View style={[styles.urgencyDot, { backgroundColor: getUrgencyColor(need.urgency) }]} />
                  <View style={styles.campaignContent}>
                    <Text style={[styles.campaignTitle, lightPrimary]} numberOfLines={1}>
                      {translateText(need.title)}
                    </Text>
                    <Text style={[styles.campaignMeta, lightSecondary]} numberOfLines={2}>
                      {t("Category")}: {translateCategory(need.category)} · {t("Urgency")}: {translateCategory(need.urgency)} · {t("Address")}: {translateAddress(need.address)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(need.status) }, isLight ? { borderColor: "#000", borderWidth: 1 } : null]}>
                    <Text style={[styles.statusText, { color: getStatusColor(need.status) }]}>
                      {translateStatus(need.status)}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>

          {/* Articles */}
          <View style={[styles.section, lightCard]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, lightPrimary]}>{t("Articles")}</Text>
              <Pressable onPress={() => goToMainTab("Feeds")}>
                <Text style={[styles.seeAll, lightPrimary]}>{t("View All")}</Text>
              </Pressable>
            </View>
            {storiesLoading ? (
              <ActivityIndicator color="#667EEA" />
            ) : impactStories.length === 0 ? (
              <Text style={[styles.emptyText, lightSecondary]}>{t("No articles found for this organization.")}</Text>
            ) : (
              impactStories.map((story) => (
                <Pressable
                  key={story.id}
                  style={[styles.storyCard, lightCardSoft]}
                  onPress={() => goToMainTab("Feeds")}
                >
                  {getStoryImage(story) ? (
                    <Image source={{ uri: getStoryImage(story) }} style={styles.storyImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.storyImage, styles.storyImageFallback]}>
                      <Text style={[styles.storyImageFallbackText, lightSecondary]}>{t("No Image")}</Text>
                    </View>
                  )}
                  <View style={styles.storyContent}>
                    <Text style={[styles.storyTitle, lightPrimary]} numberOfLines={2}>
                      {translateText(story.title)}
                    </Text>
                    <Text style={[styles.storyDesc, lightSecondary]} numberOfLines={2}>
                      {t("Description")}: {translateText(story.narrative)}
                    </Text>
                    <Text style={[styles.storyLocation, lightPrimary]}>
                      {t("Date")}: {new Date(story.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>

        </ScrollView>
      </Animated.View>
    </View>
  );
};

// Helpers
const getUrgencyColor = (urgency: string) => {
  switch (urgency) {
    case "critical": return "#FF4757";
    case "high": return "#FF6B6B";
    case "medium": return "#FFA502";
    case "low": return "#2ED573";
    default: return "#667EEA";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "new":
    case "verified": return "#667EEA";
    case "assigned":
    case "in_progress": return "#FFA502";
    case "resolved":
    case "closed": return "#2ED573";
    default: return "#8B8DA3";
  }
};

const getStatusBgColor = (status: string) => {
  switch (status) {
    case "new":
    case "verified": return "rgba(102,126,234,0.15)";
    case "assigned":
    case "in_progress": return "rgba(255,165,2,0.15)";
    case "resolved":
    case "closed": return "rgba(46,213,115,0.15)";
    default: return "rgba(139,141,163,0.15)";
  }
};

const getAreaStatusColor = (status: AreaPreview["dominantStatus"]) => {
  switch (status) {
    case "active": return "#EF4444";
    case "in_progress": return "#F59E0B";
    case "completed": return "#22C55E";
    default: return "#667EEA";
  }
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 20, paddingTop: 56, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerLeft: { flex: 1 },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  role: {
    fontSize: 13,
    color: "#8B8DA3",
    marginTop: 4,
  },
  avatarBtn: { borderRadius: 22 },
  avatarGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },

  // Org Info
  orgHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  orgIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  orgIconText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  orgHeaderInfo: { flex: 1 },
  orgName: { fontSize: 18, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },
  orgStatusBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadge: { backgroundColor: "rgba(46,213,115,0.15)" },
  inactiveBadge: { backgroundColor: "rgba(255,75,75,0.15)" },
  orgStatusText: { fontSize: 11, fontWeight: "700", color: "#2ED573" },

  orgDetails: { marginBottom: 16 },
  orgDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  orgDetailLabel: { fontSize: 13, color: "#8B8DA3", fontWeight: "500" },
  orgDetailValue: { fontSize: 13, color: "#FFFFFF", fontWeight: "600", flex: 1, textAlign: "right" },

  orgStatsRow: { flexDirection: "row", gap: 10 },
  orgStatItem: {
    flex: 1,
    backgroundColor: "rgba(102,126,234,0.1)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.2)",
  },
  orgStatNum: { fontSize: 22, fontWeight: "800", color: "#667EEA" },
  orgStatLabel: { fontSize: 10, color: "#8B8DA3", marginTop: 4, fontWeight: "600" },

  // Volunteer Rating
  volunteerRatingCard: {
    backgroundColor: "rgba(15,23,42,0.48)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.34)",
    padding: 14,
  },
  volunteerRatingTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  volunteerRatingLabel: { color: "#8B8DA3", fontSize: 12, fontWeight: "800", marginBottom: 2 },
  volunteerRatingScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  volunteerRatingScore: { color: "#FFFFFF", fontSize: 34, fontWeight: "900" },
  volunteerRatingOutOf: { color: "#8B8DA3", fontSize: 15, fontWeight: "800", marginLeft: 4 },
  volunteerRatingBadge: {
    backgroundColor: "rgba(245,158,11,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.38)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  volunteerRatingBadgeText: { color: "#FBBF24", fontSize: 11, fontWeight: "900" },
  volunteerRatingStars: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 10 },
  volunteerRatingStar: { color: "rgba(255,255,255,0.22)", fontSize: 28, fontWeight: "900", lineHeight: 32 },
  volunteerRatingStarFilled: { color: "#F59E0B" },
  volunteerRatingMeta: { color: "#8B8DA3", fontSize: 12, fontWeight: "700" },

  // Sections
  section: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 14,
  },
  seeAll: {
    fontSize: 13,
    color: "#667EEA",
    fontWeight: "600",
    marginBottom: 14,
  },

  // Location
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: { color: "#8B8DA3", fontSize: 13 },
  locationDetails: { marginBottom: 14 },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  locationLabel: { fontSize: 13, color: "#8B8DA3", fontWeight: "500" },
  locationValue: { fontSize: 13, color: "#FFFFFF", fontWeight: "600" },
  mapSection: { marginTop: 4 },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  mapImage: { width: "100%", height: "100%" },
  areaPreviewWrap: { marginTop: 12 },
  areaPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  areaPreviewTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  areaPreviewHint: { color: "#8B8DA3", fontSize: 11, fontWeight: "700" },
  areaPreviewList: { gap: 10, paddingRight: 2 },
  areaPreviewCard: {
    width: 190,
    backgroundColor: "rgba(15,23,42,0.42)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 10,
  },
  areaPreviewTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  areaStatusRail: { width: 5, height: 34, borderRadius: 999 },
  areaPreviewNameWrap: { flex: 1, minWidth: 0 },
  areaPreviewName: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  areaPreviewCity: { color: "#8B8DA3", fontSize: 10, fontWeight: "700", marginTop: 2 },
  areaPreviewTotal: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  areaPreviewStats: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  areaMiniStat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 9,
    paddingVertical: 7,
    alignItems: "center",
  },
  areaMiniValue: { fontSize: 15, fontWeight: "900" },
  areaMiniLabel: { color: "#8B8DA3", fontSize: 9, fontWeight: "800", marginTop: 2 },
  mapBtn: {
    marginTop: 10,
    backgroundColor: "rgba(102,126,234,0.15)",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(102,126,234,0.3)",
  },
  mapBtnText: { color: "#667EEA", fontSize: 13, fontWeight: "600" },
  errorText: { color: "#FF6B6B", fontSize: 13, paddingVertical: 8 },

  // Branch Locations
  branchesSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  branchesTitle: { fontSize: 14, fontWeight: "700", color: "#667EEA", marginBottom: 12 },
  branchItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8, marginBottom: 8 },
  branchColorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  branchInfo: { flex: 1 },
  branchName: { fontSize: 13, fontWeight: "600", color: "#FFFFFF", marginBottom: 2 },
  branchCoords: { fontSize: 11, color: "#667EEA", marginBottom: 2 },
  branchAddress: { fontSize: 11, color: "#8B8DA3" },

  // Stats
  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderRadius: 14, overflow: "hidden" },
  statGradient: { paddingVertical: 18, alignItems: "center", borderRadius: 14 },
  statNumber: { fontSize: 26, fontWeight: "800", color: "#FFFFFF" },
  statLabel: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 4, fontWeight: "600", textAlign: "center" },

  // Campaigns / Nearby Needs
  emptyText: { color: "#8B8DA3", fontSize: 13, paddingVertical: 8 },
  campaignItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  urgencyDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  campaignContent: { flex: 1 },
  campaignTitle: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  campaignMeta: { fontSize: 11, color: "#8B8DA3", marginTop: 3 },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },

  // Stories
  storyCard: {
    flexDirection: "row",
    marginBottom: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    overflow: "hidden",
  },
  storyImage: { width: 80, height: 80 },
  storyImageFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  storyImageFallbackText: { color: "#8B8DA3", fontSize: 11, fontWeight: "600" },
  storyContent: { flex: 1, padding: 10, justifyContent: "center" },
  storyTitle: { fontSize: 13, fontWeight: "600", color: "#FFFFFF", marginBottom: 4 },
  storyDesc: { fontSize: 11, color: "#8B8DA3", marginBottom: 4 },
  storyLocation: { fontSize: 10, color: "#667EEA", fontWeight: "500" },

  // Quick actions
  quickGrid: { flexDirection: "row", gap: 10 },
  quickBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickIcon: { fontSize: 20, marginBottom: 6 },
  quickLabel: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.8)" },
});
