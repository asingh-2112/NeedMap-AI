import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useAccessibility } from "../../context/AccessibilityContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useRealtime } from "../../context/RealtimeContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { apiRequest, moduleApi } from "../../services/api";
import { getLiveLocation } from "../../services/location";
import type { RootStackParamList } from "../../navigation/types";
import { NeedMapView } from "../../components/NeedMapView";
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
  const showNeedsOrganizationMap = isAdmin;
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

  // Fetch location with a timeout so the UI never hangs indefinitely
  useEffect(() => {
    let cancelled = false;
    const fetchLocation = async () => {
      try {
        const loc = await Promise.race([
          getLiveLocation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Location timeout")), 10_000),
          ),
        ]);
        if (!cancelled) setLocation(loc);
      } catch {
        if (!cancelled) setLocation(null);
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    };
    fetchLocation();
    return () => { cancelled = true; };
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
          // Volunteer: fetch needs for counts, assignments, and organization pointers for map.
          const [needs, assignments, organizations] = await Promise.all([
            moduleApi.needs(baseUrl, token),
            moduleApi.assignments(baseUrl, token),
            moduleApi.organizations(baseUrl, token),
          ]);

          const activeNeeds = needs.filter((n) => !["resolved", "closed"].includes(n.status));
          setNeedsCount(activeNeeds.length);
          setNearbyNeeds(activeNeeds.slice(0, 5));
          // Volunteer map: only organization pins + own live location (via currentLocation prop).
          setMapNeeds([]);
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

  const validBranchMarkers = useMemo(() => {
    if (!isOrgOwner) return [];
    return [
      { lat: 12.9716, lng: 77.5946, label: "HQ - Bengaluru Headquarters", isHQ: true },
      { lat: 12.9784, lng: 77.6408, label: "Indiranagar Branch", isHQ: false },
      { lat: 12.9352, lng: 77.6245, label: "Koramangala Branch", isHQ: false },
      { lat: 12.9250, lng: 77.5938, label: "Jayanagar Branch", isHQ: false },
      { lat: 12.9698, lng: 77.7500, label: "Whitefield Branch", isHQ: false },
      { lat: 13.0035, lng: 77.5645, label: "Malleshwaram Branch", isHQ: false },
    ];
  }, [isOrgOwner]);

  const mapLabels = useMemo(
    () => ({
      need: t("Need"), status: t("Status"), category: t("Category"), urgency: t("Urgency"),
      affected: t("Affected"), priority: t("Priority"), address: t("Address"),
      unknownLocation: t("Unknown location"), notAvailable: t("Not available"),
      openNeedDetails: t("Open need details"), organizationPointer: t("Organization pointer"),
      volunteerPointer: t("Volunteer pointer"), type: t("Type"),
      branchOrganization: t("Branch organization"), partnerOrganization: t("Partner organization"),
      areaOrganization: t("Area organization"), phone: t("Phone"),
      available: t("Available"), busy: t("Busy"), verified: t("Verified"),
      area: t("Area"), nearbyArea: t("Nearby area"), tasks: t("Tasks"),
      completed: t("completed"), active: t("active"),
      moreNeedsInThisArea: t("more needs in this area."), colony: t("Colony"),
      progress: t("Progress"), done: t("Done"), total: t("Total"),
      topCategoryApiFilteredNeeds: t("Top Category: API filtered needs"),
      needsHeatMap: t("NEEDS HEAT MAP"), activeNeeds: t("Active Needs"),
      inProgress: t("In Progress"), intensityLowHigh: t("Intensity: Low to High"),
      currentLocation: t("Current location"),
      nearbyHighlightedAreas: t("Nearby highlighted areas are outlined in cyan."),
    }),
    [t],
  );

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
            ) : location || isOrgOwner || isAdmin || isVolunteer ? (
              <>
                <View style={styles.mapSection}>
                  <NeedMapView
                    needs={mapNeeds}
                    organizations={mapOrganizations}
                    volunteers={mapVolunteers}
                    currentLocation={location ? { latitude: location.latitude, longitude: location.longitude } : null}
                    branchMarkers={isOrgOwner ? validBranchMarkers : []}
                    showHeatmap={showNeedsOrganizationMap}
                    onNeedPress={(needId) => nav.navigate("NeedDetail", { needId })}
                    labels={mapLabels}
                    translateText={translateText}
                    translateAddress={translateAddress}
                    height={300}
                  />

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

                  <Pressable onPress={() => nav.navigate("FullMap")} style={styles.mapBtn}>
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
