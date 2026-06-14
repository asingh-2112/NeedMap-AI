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
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { apiRequest, moduleApi } from "../../services/api";
import { getLiveLocation } from "../../services/location";
import type { RootStackParamList } from "../../navigation/types";
import type { Need, Organization } from "../../types/api";

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

export const HomeScreen = () => {
  const nav = useNavigation<Nav>();
  const { baseUrl, token, user } = useAuth();
  const { theme } = useThemeMode();
  const scopedOrganizationId = user?.role === "admin" ? user?.managed_branch_id ?? user?.organization_id : user?.organization_id;

  const isOrgOwner = user?.role === "owner" && !!user?.organization_id;
  const isAdmin = user?.role === "admin";
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

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, slideUp]);

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

            const active = scopedAssignments.filter((a) =>
              ["accepted", "in_progress", "proposed", "assigned"].includes(a.status)
            );
            setActiveAssignments(active.length);
            setCompletedAssignments(scopedAssignments.filter((a) => a.status === "completed").length);
          } else {
            // Admin scope should stay within managed branch.
            const [org, needs, assignments, volunteers] = await Promise.all([
              moduleApi.getOrganization(baseUrl, token, scopedOrganizationId),
              moduleApi.needs(baseUrl, token, { organization_id: scopedOrganizationId }),
              moduleApi.assignments(baseUrl, token, { organization_id: scopedOrganizationId }),
              moduleApi.volunteers(baseUrl, token),
            ]);

            setOrgInfo(org);
            setOrgNeedsCount(needs.length);
            setOrgVolunteersCount(volunteers.filter((v) => v.organization_id === scopedOrganizationId).length);
            setOrgAssignmentsCount(assignments.length);

            const activeNeeds = needs.filter((n) => !["resolved", "closed"].includes(n.status));
            const completedNeeds = needs.filter((n) => ["resolved", "closed"].includes(n.status));
            setOrgActiveNeedsCount(activeNeeds.length);
            setOrgCompletedNeedsCount(completedNeeds.length);
            setNeedsCount(activeNeeds.length);
            setNearbyNeeds(activeNeeds.slice(0, 5));
            setMapNeeds(needs);

            const active = assignments.filter((a) =>
              ["accepted", "in_progress", "proposed", "assigned"].includes(a.status)
            );
            setActiveAssignments(active.length);
            setCompletedAssignments(assignments.filter((a) => a.status === "completed").length);
          }
        } else {
          // Volunteer: fetch all needs + assignments
          const [needs, assignments] = await Promise.all([
            moduleApi.needs(baseUrl, token),
            moduleApi.assignments(baseUrl, token),
          ]);

          const activeNeeds = needs.filter((n) => !["resolved", "closed"].includes(n.status));
          setNeedsCount(activeNeeds.length);
          setNearbyNeeds(activeNeeds.slice(0, 5));
          // Volunteer map can use broader heat visualization across accessible needs.
          setMapNeeds(needs);

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
  }, [baseUrl, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const loadStories = async () => {
      setStoriesLoading(true);
      try {
        const query = scopedOrganizationId
          ? `?org_id=${scopedOrganizationId}`
          : "";
        const data = await apiRequest<HomeStory[]>(
          baseUrl,
          `/api/stories${query}`,
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
    if (!location) return null;
    const markers = [
      { lat: location.latitude, lng: location.longitude, label: "Headquarter / Current Location" },
      ...(isOrgOwner ? validBranchMarkers : []),
    ];
    const needsForMap = mapNeeds
      .filter((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude))
      .map((n) => ({
        lat: n.latitude,
        lng: n.longitude,
        status: n.status,
        title: n.title,
        city: (n.city || "").trim(),
        address: n.address || "",
      }));

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }
      body { background: #0b1020; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""></script>
    <script>
      const markers = ${JSON.stringify(markers)};
      const needs = ${JSON.stringify(needsForMap)};
      const map = L.map('map', { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const normalizeStatus = (status) => {
        const value = (status || '').toLowerCase();
        if (value === 'resolved' || value === 'closed') return 'completed';
        if (value === 'in_progress' || value === 'assigned') return 'in_progress';
        return 'active';
      };

      const parseCityFromAddress = (address) => {
        if (!address) return 'Unknown City';
        const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) return parts[parts.length - 2];
        return parts[0] || 'Unknown City';
      };

      const hexToRgb = (hex) => {
        const clean = hex.replace('#', '');
        const value = parseInt(clean, 16);
        return {
          r: (value >> 16) & 255,
          g: (value >> 8) & 255,
          b: value & 255,
        };
      };

      const rgbToHex = (r, g, b) => {
        const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
        return '#' + toHex(r) + toHex(g) + toHex(b);
      };

      const darken = (hex, factor) => {
        const rgb = hexToRgb(hex);
        return rgbToHex(rgb.r * (1 - factor), rgb.g * (1 - factor), rgb.b * (1 - factor));
      };

      const cityBuckets = {};
      needs.forEach((n) => {
        const cityName = (n.city && String(n.city).trim()) || parseCityFromAddress(n.address);
        if (!cityBuckets[cityName]) {
          cityBuckets[cityName] = {
            city: cityName,
            points: [],
            total: 0,
            active: 0,
            in_progress: 0,
            completed: 0,
          };
        }
        const statusKey = normalizeStatus(n.status);
        cityBuckets[cityName].points.push([n.lat, n.lng]);
        cityBuckets[cityName].total += 1;
        cityBuckets[cityName][statusKey] += 1;
      });

      const cityList = Object.values(cityBuckets);
      const maxCityTotal = cityList.reduce((max, city) => Math.max(max, city.total), 1);

      // Weather-style heat color ramp for city areas.
      const heatStops = [
        { t: 0, color: '#FFF4BF' },
        { t: 0.35, color: '#FDBA74' },
        { t: 0.7, color: '#F97316' },
        { t: 1, color: '#B91C1C' },
      ];

      const lerp = (a, b, t) => a + (b - a) * t;

      const colorAt = (t) => {
        const clamped = Math.max(0, Math.min(1, t));
        let left = heatStops[0];
        let right = heatStops[heatStops.length - 1];
        for (let i = 0; i < heatStops.length - 1; i += 1) {
          if (clamped >= heatStops[i].t && clamped <= heatStops[i + 1].t) {
            left = heatStops[i];
            right = heatStops[i + 1];
            break;
          }
        }
        const span = Math.max(0.0001, right.t - left.t);
        const localT = (clamped - left.t) / span;
        const l = hexToRgb(left.color);
        const r = hexToRgb(right.color);
        return rgbToHex(lerp(l.r, r.r, localT), lerp(l.g, r.g, localT), lerp(l.b, r.b, localT));
      };

      const buildCityPolygon = (points, count) => {
        const lats = points.map((p) => p[0]);
        const lngs = points.map((p) => p[1]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const pad = 0.06 + Math.min(0.12, count * 0.004);
        return [
          [minLat - pad, minLng - pad],
          [minLat - pad, maxLng + pad],
          [maxLat + pad, maxLng + pad],
          [maxLat + pad, minLng - pad],
        ];
      };

      if (!${JSON.stringify(isOrgOwner)}) {
        cityList.forEach((city) => {
          const intensity = Math.min(1, city.total / maxCityTotal);
          const fill = colorAt(intensity);
          const border = darken(fill, 0.35);
          const polygon = buildCityPolygon(city.points, city.total);

          L.polygon(polygon, {
            color: border,
            weight: 3,
            fillColor: fill,
            fillOpacity: 0.48,
          })
            .addTo(map)
            .bindPopup(
              '<b>City:</b> ' + city.city +
              '<br/><b>Total needs:</b> ' + city.total +
              '<br/><b>Active:</b> ' + city.active +
              '<br/><b>In Progress:</b> ' + city.in_progress +
              '<br/><b>Completed:</b> ' + city.completed
            );
        });

        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function () {
          const div = L.DomUtil.create('div', 'legend');
          div.style.background = 'rgba(255,255,255,0.95)';
          div.style.padding = '8px 10px';
          div.style.borderRadius = '8px';
          div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
          div.style.font = '12px system-ui, sans-serif';
          div.innerHTML =
            '<div style="font-weight:700; margin-bottom:6px; color:#111827;">City Need Heatmap</div>' +
            '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;"><span style="width:10px; height:10px; border-radius:999px; background:#FFF4BF; border:1px solid #9A3412; display:inline-block;"></span> Low needs</div>' +
            '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;"><span style="width:10px; height:10px; border-radius:999px; background:#F97316; border:1px solid #9A3412; display:inline-block;"></span> Medium needs</div>' +
            '<div style="display:flex; align-items:center; gap:6px;"><span style="width:10px; height:10px; border-radius:999px; background:#B91C1C; border:1px solid #7F1D1D; display:inline-block;"></span> High needs</div>' +
            '<div style="margin-top:6px; color:#374151;">Each bordered area is a city</div>';
          return div;
        };
        legend.addTo(map);
      }

      const bounds = [];
      markers.forEach((m) => {
        const marker = L.marker([m.lat, m.lng]).addTo(map);
        if (m.label) marker.bindPopup(m.label);
        bounds.push([m.lat, m.lng]);
      });

      if (!${JSON.stringify(isOrgOwner)}) {
        needs.forEach((n) => {
          bounds.push([n.lat, n.lng]);
        });
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [24, 24] });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else {
        map.setView([20.5937, 78.9629], 4);
      }
    </script>
  </body>
</html>`;
  }, [location, isOrgOwner, isAdmin, validBranchMarkers, mapNeeds]);

  const openMap = () => {
    if (!location) return;

    if (Platform.OS === "web" && webMapHtml) {
      const blob = new Blob([webMapHtml], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      // Delay revocation so the new tab has time to load the map content.
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }

    // Mobile fallback when web map HTML is unavailable.
    const osmUrl = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=14/${location.latitude}/${location.longitude}`;
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
                Welcome, {user?.user_name || "User"}
              </Text>
              <Text style={[styles.role, lightMuted]}>
                {isOrgManager ? "Organization Admin" : "Volunteer"}
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
                    {orgInfo.organization_name.charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
                <View style={styles.orgHeaderInfo}>
                  <Text style={[styles.orgName, lightPrimary]}>{orgInfo.organization_name}</Text>
                  <View style={[styles.orgStatusBadge, orgInfo.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                    <Text style={styles.orgStatusText}>{orgInfo.is_active ? "Active" : "Inactive"}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.orgDetails}>
                <View style={styles.orgDetailRow}>
                  <Text style={[styles.orgDetailLabel, lightSecondary]}>Org ID</Text>
                  <Text style={[styles.orgDetailValue, lightPrimary]}>#{user?.organization_id ?? orgInfo.id}</Text>
                </View>

                {isAdmin ? (
                  <>
                    <View style={styles.orgDetailRow}>
                      <Text style={[styles.orgDetailLabel, lightSecondary]}>Branch ID</Text>
                      <Text style={[styles.orgDetailValue, lightPrimary]}>#{scopedOrganizationId ?? orgInfo.id}</Text>
                    </View>
                    <View style={styles.orgDetailRow}>
                      <Text style={[styles.orgDetailLabel, lightSecondary]}>Branch Address</Text>
                      <Text style={[styles.orgDetailValue, lightPrimary]}>{orgInfo.address || orgInfo.branch_location || "Not specified"}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.orgDetailRow}>
                      <Text style={[styles.orgDetailLabel, lightSecondary]}>Headquarter</Text>
                      <Text style={[styles.orgDetailValue, lightPrimary]}>{orgInfo.address || "Not specified"}</Text>
                    </View>
                    <View style={styles.orgDetailRow}>
                      <Text style={[styles.orgDetailLabel, lightSecondary]}>Total Branches</Text>
                      <Text style={[styles.orgDetailValue, lightPrimary]}>{branches.length}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Org Stats */}
              <View style={styles.orgStatsRow}>
                <View style={styles.orgStatItem}>
                  <Text style={[styles.orgStatNum, lightPrimary]}>{orgNeedsCount}</Text>
                  <Text style={[styles.orgStatLabel, lightSecondary]}>{isAdmin ? "Total" : "Total Created"}</Text>
                </View>
                <View style={styles.orgStatItem}>
                  <Text style={[styles.orgStatNum, lightPrimary]}>{orgActiveNeedsCount}</Text>
                    <Text style={[styles.orgStatLabel, lightSecondary]}>Active</Text>
                </View>
                <View style={styles.orgStatItem}>
                  <Text style={[styles.orgStatNum, lightPrimary]}>{orgCompletedNeedsCount}</Text>
                    <Text style={[styles.orgStatLabel, lightSecondary]}>Completed</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Location Section */}
          <View style={[styles.section, lightCard]}>
            <Text style={[styles.sectionTitle, lightPrimary]}>Your Location</Text>
            {locationLoading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#667EEA" size="small" />
                <Text style={[styles.loadingText, lightSecondary]}>Fetching location...</Text>
              </View>
            ) : location ? (
              <>
                {/* Embedded Map */}
                <View style={styles.mapSection}>
                  {Platform.OS === "web" && webMapHtml ? (
                    <View style={styles.mapContainer}>
                      {createElement("iframe", {
                        srcDoc: webMapHtml,
                        style: { width: "100%", height: "100%", border: "none", borderRadius: 12 },
                        title: "Branch Map",
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

                  <Pressable onPress={openMap} style={styles.mapBtn}>
                    <Text style={[styles.mapBtnText, lightPrimary]}>Open Full Map</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={[styles.errorText, isLight ? { color: "#B91C1C", fontWeight: "700" } : null]}>
                Location unavailable. Please enable location permissions.
              </Text>
            )}
          </View>

          {/* Nearby Needs / Campaigns */}
          <View style={[styles.section, lightCard]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, lightPrimary]}>
                {isOrgManager ? "Organization Needs" : "Nearby Campaigns"}
              </Text>
              <Pressable onPress={() => goToMainTab("Needs")}>
                <Text style={[styles.seeAll, lightPrimary]}>See All</Text>
              </Pressable>
            </View>
            {nearbyNeeds.length === 0 ? (
              <Text style={[styles.emptyText, lightSecondary]}>
                {isOrgManager ? "No needs created yet. Go to Needs tab to create one." : "No active campaigns nearby"}
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
                      {need.title}
                    </Text>
                    <Text style={[styles.campaignMeta, lightSecondary]}>
                      {need.category} · {need.urgency} priority · {need.address || "Unknown location"}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(need.status) }, isLight ? { borderColor: "#000", borderWidth: 1 } : null]}>
                    <Text style={[styles.statusText, { color: getStatusColor(need.status) }]}>
                      {need.status}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>

          {/* Articles */}
          <View style={[styles.section, lightCard]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, lightPrimary]}>Articles</Text>
              <Pressable onPress={() => goToMainTab("Feeds")}>
                <Text style={[styles.seeAll, lightPrimary]}>View All</Text>
              </Pressable>
            </View>
            {storiesLoading ? (
              <ActivityIndicator color="#667EEA" />
            ) : impactStories.length === 0 ? (
              <Text style={[styles.emptyText, lightSecondary]}>No articles found for this organization.</Text>
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
                      <Text style={[styles.storyImageFallbackText, lightSecondary]}>No Image</Text>
                    </View>
                  )}
                  <View style={styles.storyContent}>
                    <Text style={[styles.storyTitle, lightPrimary]} numberOfLines={2}>
                      {story.title}
                    </Text>
                    <Text style={[styles.storyDesc, lightSecondary]} numberOfLines={2}>
                      {story.narrative}
                    </Text>
                    <Text style={[styles.storyLocation, lightPrimary]}>
                      {new Date(story.created_at).toLocaleDateString()}
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
  },
  mapImage: { width: "100%", height: "100%" },
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
