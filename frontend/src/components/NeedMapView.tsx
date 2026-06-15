import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker, Polygon, type Region } from "react-native-maps";
import type { Need, Organization, Volunteer } from "../types/api";

export type NeedMapViewProps = {
  needs: Need[];
  organizations: Organization[];
  volunteers: Volunteer[];
  currentLocation: { latitude: number; longitude: number } | null;
  branchMarkers: { lat: number; lng: number; label: string; isHQ?: boolean }[];
  showHeatmap: boolean;
  onNeedPress: (needId: number) => void;
  labels: Record<string, string>;
  translateText: (text: string) => string;
  translateAddress: (address: string | null) => string;
  height?: number;
};

const normalizeStatus = (status: string): "active" | "in_progress" | "completed" => {
  const s = (status || "").toLowerCase();
  if (s === "resolved" || s === "closed") return "completed";
  if (s === "in_progress") return "in_progress";
  return "active";
};

const STATUS_COLORS: Record<string, string> = {
  active: "#E63B2E",
  in_progress: "#F5A623",
  completed: "#4CAF50",
};

const formatLabel = (value: string | null | undefined) =>
  String(value || "N/A").replace(/_/g, " ");

// ── Geometry helpers ──

const cross = (o: number[], a: number[], b: number[]) =>
  (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);

const convexHull = (points: number[][]): number[][] => {
  const unique = Array.from(
    new Map(points.map((p) => [p.join(","), p])).values(),
  ).sort((a, b) => (a[1] === b[1] ? a[0] - b[0] : a[1] - b[1]));
  if (unique.length <= 2) return unique;

  const lower: number[][] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: number[][] = [];
  for (const p of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
};

type AreaBucket = {
  key: string;
  area: string;
  city: string;
  points: number[][];
  total: number;
  active: number;
  in_progress: number;
  completed: number;
};

const parseArea = (address: string | null | undefined) => {
  const parts = (address || "").split(",").map((p) => p.trim()).filter(Boolean);
  return parts[0] || "Unknown";
};

const parseCity = (address: string | null | undefined) => {
  const parts = (address || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 3];
  if (parts.length >= 2) return parts[parts.length - 2];
  return "Unknown";
};

const buildAreaList = (needs: Need[]): AreaBucket[] => {
  const buckets: Record<string, AreaBucket> = {};
  for (const need of needs) {
    if (!Number.isFinite(need.latitude) || !Number.isFinite(need.longitude)) continue;
    const areaName = (need.colony || need.street || "").trim() || parseArea(need.address);
    const cityName = (need.city || "").trim() || parseCity(need.address);
    const key = `${cityName.toLowerCase()}|${areaName.toLowerCase()}`;
    if (!buckets[key]) {
      buckets[key] = { key, area: areaName, city: cityName, points: [], total: 0, active: 0, in_progress: 0, completed: 0 };
    }
    const status = normalizeStatus(need.status);
    buckets[key].points.push([need.latitude, need.longitude]);
    buckets[key].total += 1;
    buckets[key][status] += 1;
  }
  return Object.values(buckets);
};

const buildPolygonCoords = (points: number[][], pad = 0.004) => {
  const hull = convexHull(points);
  const center = points.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]).map((v) => v / points.length);

  if (hull.length === 1) {
    const p = hull[0];
    return [
      { latitude: p[0] + pad, longitude: p[1] },
      { latitude: p[0], longitude: p[1] + pad * 1.25 },
      { latitude: p[0] - pad, longitude: p[1] },
      { latitude: p[0], longitude: p[1] - pad * 1.25 },
    ];
  }
  if (hull.length === 2) {
    const [a, b] = hull;
    const dx = b[1] - a[1];
    const dy = b[0] - a[0];
    const len = Math.max(Math.sqrt(dx * dx + dy * dy), 0.0001);
    const oLat = (dx / len) * pad;
    const oLng = (-dy / len) * pad;
    return [
      { latitude: a[0] + oLat, longitude: a[1] + oLng },
      { latitude: b[0] + oLat, longitude: b[1] + oLng },
      { latitude: b[0] - oLat, longitude: b[1] - oLng },
      { latitude: a[0] - oLat, longitude: a[1] - oLng },
    ];
  }
  return hull.map((p) => {
    const vLat = p[0] - center[0];
    const vLng = p[1] - center[1];
    const len = Math.max(Math.sqrt(vLat * vLat + vLng * vLng), 0.0001);
    return { latitude: p[0] + (vLat / len) * pad, longitude: p[1] + (vLng / len) * pad };
  });
};

const areaCenter = (points: number[][]) => {
  const s = points.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return { latitude: s[0] / points.length, longitude: s[1] / points.length };
};

const dominantStatus = (a: AreaBucket) => {
  const ranked: [string, number][] = [["active", a.active], ["in_progress", a.in_progress], ["completed", a.completed]];
  return ranked.sort((x, y) => y[1] - x[1])[0][0];
};

interface NeedCluster {
  lat: number;
  lng: number;
  count: number;
  status: string;
  needs: Need[];
}

const clusterNeedsNative = (needs: Need[], gridSize = 0.006): NeedCluster[] => {
  const buckets: Record<string, Need[]> = {};
  for (const n of needs) {
    const gx = Math.floor(n.latitude / gridSize);
    const gy = Math.floor(n.longitude / gridSize);
    const key = `${gx}|${gy}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(n);
  }
  return Object.values(buckets).map((group) => {
    const lat = group.reduce((s, n) => s + n.latitude, 0) / group.length;
    const lng = group.reduce((s, n) => s + n.longitude, 0) / group.length;
    const counts = group.reduce(
      (a, n) => { a[normalizeStatus(n.status)] += 1; return a; },
      { active: 0, in_progress: 0, completed: 0 } as Record<string, number>,
    );
    const dominant = counts.active >= counts.in_progress && counts.active >= counts.completed
      ? "active" : counts.in_progress >= counts.completed ? "in_progress" : "completed";
    return { lat, lng, count: group.length, status: dominant, needs: group };
  });
};

// ── Component ──

export const NeedMapView: React.FC<NeedMapViewProps> = ({
  needs,
  organizations,
  volunteers,
  currentLocation,
  branchMarkers,
  showHeatmap,
  onNeedPress,
  labels,
  translateText,
  translateAddress,
  height = 300,
}) => {
  const mapRef = useRef<MapView>(null);
  const [zoomLevel, setZoomLevel] = useState(10);

  const onRegionChange = useCallback((region: Region) => {
    const zoom = Math.round(Math.log2(360 / Math.max(region.longitudeDelta, 0.001)));
    setZoomLevel(zoom);
  }, []);

  const showEntities = zoomLevel >= 14;
  const showAreaBubbles = zoomLevel < 15;

  const validNeeds = useMemo(
    () => needs.filter((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude)),
    [needs],
  );

  const parsedOrgs = useMemo(
    () =>
      organizations
        .map((org) => {
          if (!org.branch_location) return null;
          const [latS, lngS] = org.branch_location.split(",").map((s) => s.trim());
          const lat = Number(latS);
          const lng = Number(lngS);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { ...org, lat, lng };
        })
        .filter((o): o is Organization & { lat: number; lng: number } => o !== null),
    [organizations],
  );

  const parsedVolunteers = useMemo(
    () =>
      volunteers.filter(
        (v): v is Volunteer & { latitude: number; longitude: number } =>
          typeof v.latitude === "number" && typeof v.longitude === "number",
      ),
    [volunteers],
  );

  const areas = useMemo(() => (showHeatmap ? buildAreaList(validNeeds) : []), [showHeatmap, validNeeds]);

  const statusSummary = useMemo(() => {
    const s = { active: 0, in_progress: 0, completed: 0 };
    for (const n of validNeeds) s[normalizeStatus(n.status)] += 1;
    return s;
  }, [validNeeds]);

  const needClusters = useMemo(() => clusterNeedsNative(validNeeds), [validNeeds]);

  const allCoordinates = useMemo(() => {
    const coords: { latitude: number; longitude: number }[] = [];
    for (const n of validNeeds) coords.push({ latitude: n.latitude, longitude: n.longitude });
    for (const o of parsedOrgs) coords.push({ latitude: o.lat, longitude: o.lng });
    for (const v of parsedVolunteers) coords.push({ latitude: v.latitude, longitude: v.longitude });
    for (const m of branchMarkers) coords.push({ latitude: m.lat, longitude: m.lng });
    if (currentLocation) coords.push(currentLocation);
    return coords;
  }, [validNeeds, parsedOrgs, parsedVolunteers, branchMarkers, currentLocation]);

  const fitMap = useCallback(() => {
    if (allCoordinates.length === 0 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(allCoordinates, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: true,
    });
  }, [allCoordinates]);

  const initialRegion = useMemo(() => {
    if (currentLocation) {
      return { ...currentLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    }
    if (allCoordinates.length > 0) {
      const lats = allCoordinates.map((c) => c.latitude);
      const lngs = allCoordinates.map((c) => c.longitude);
      return {
        latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
        longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
        latitudeDelta: Math.max(Math.max(...lats) - Math.min(...lats), 0.05) * 1.5,
        longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs), 0.05) * 1.5,
      };
    }
    return { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 20, longitudeDelta: 20 };
  }, [currentLocation, allCoordinates]);

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={!!currentLocation}
        showsMyLocationButton
        onMapReady={fitMap}
        onRegionChangeComplete={onRegionChange}
      >
        {/* Area zone polygons – hidden when zoomed in */}
        {showAreaBubbles && areas.map((area) => {
          const status = dominantStatus(area);
          const intensity = Math.min(area.total / 10, 1);
          return (
            <Polygon
              key={`zone-${area.key}`}
              coordinates={buildPolygonCoords(area.points, 0.004 + intensity * 0.008)}
              fillColor={`${STATUS_COLORS[status]}14`}
              strokeColor="transparent"
              strokeWidth={0}
            />
          );
        })}

        {/* Area bubble markers – hidden when zoomed in */}
        {showAreaBubbles && areas.map((area) => {
          const center = areaCenter(area.points);
          const status = dominantStatus(area);
          return (
            <Marker key={`abub-${area.key}`} coordinate={center} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[styles.areaBubble, { backgroundColor: STATUS_COLORS[status] ?? "#E63B2E" }]}>
                <Text style={styles.areaBubbleText}>{area.total}</Text>
              </View>
              <Callout>
                <View style={styles.areaCallout}>
                  <Text style={styles.calloutTitle}>{area.area}</Text>
                  <Text style={styles.calloutCity}>{area.city}</Text>
                  <Text style={{ color: STATUS_COLORS.active, fontSize: 12, fontWeight: "800" }}>
                    {labels.active}: {area.active}
                  </Text>
                  <Text style={{ color: STATUS_COLORS.in_progress, fontSize: 12, fontWeight: "800" }}>
                    {labels.inProgress}: {area.in_progress}
                  </Text>
                  <Text style={{ color: STATUS_COLORS.completed, fontSize: 12, fontWeight: "800" }}>
                    {labels.completed}: {area.completed}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Need cluster markers */}
        {needClusters.map((cluster, idx) => {
          if (cluster.count === 1) {
            const need = cluster.needs[0];
            const status = normalizeStatus(need.status);
            return (
              <Marker
                key={`need-${need.id}`}
                coordinate={{ latitude: need.latitude, longitude: need.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                onCalloutPress={() => onNeedPress(need.id)}
              >
                <View style={[styles.needDot, { backgroundColor: STATUS_COLORS[status] }]}>
                  <Text style={styles.needDotText}>N</Text>
                </View>
                <Callout tooltip={false}>
                  <View style={styles.needCallout}>
                    <Text style={styles.calloutTitle} numberOfLines={2}>
                      {translateText(need.title)}
                    </Text>
                    <Text style={styles.calloutMeta}>
                      {labels.status}: {formatLabel(need.status)}
                      {"\n"}
                      {labels.category}: {formatLabel(need.category)}
                      {"\n"}
                      {labels.urgency}: {formatLabel(need.urgency)}
                      {"\n"}
                      {labels.affected}: {need.affected_count ?? labels.notAvailable} · {labels.priority}:{" "}
                      {need.priority_score?.toFixed(2) ?? labels.notAvailable}
                      {"\n"}
                      {labels.address}: {translateAddress(need.address) || labels.unknownLocation}
                    </Text>
                    <View style={styles.calloutActionWrap}>
                      <Text style={styles.calloutAction}>{labels.openNeedDetails}</Text>
                    </View>
                  </View>
                </Callout>
              </Marker>
            );
          }
          const size = Math.round(28 + Math.min(cluster.count / 8, 1) * 20);
          return (
            <Marker
              key={`ncluster-${idx}`}
              coordinate={{ latitude: cluster.lat, longitude: cluster.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.needCluster,
                  {
                    width: size, height: size, borderRadius: size / 2,
                    backgroundColor: STATUS_COLORS[cluster.status] ?? "#E63B2E",
                  },
                ]}
              >
                <Text style={styles.needClusterText}>{cluster.count}</Text>
              </View>
              <Callout>
                <View style={styles.areaCallout}>
                  <Text style={styles.calloutTitle}>
                    {cluster.count} {labels.needs || "Needs"}
                  </Text>
                  {cluster.needs.slice(0, 4).map((n) => (
                    <Text key={n.id} style={styles.calloutMeta} numberOfLines={1}>
                      • {translateText(n.title)}
                    </Text>
                  ))}
                  {cluster.count > 4 && (
                    <Text style={[styles.calloutMeta, { color: "#94A3B8", marginTop: 4 }]}>
                      + {cluster.count - 4} more
                    </Text>
                  )}
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Organization markers – visible only when zoomed in */}
        {showEntities && parsedOrgs.map((org) => (
          <Marker
            key={`org-${org.id}`}
            coordinate={{ latitude: org.lat, longitude: org.lng }}
            anchor={{ x: 0.25, y: 0.9 }}
          >
            <View style={styles.orgPin}>
              <Text style={styles.pinInner}>O</Text>
            </View>
            <Callout>
              <View style={styles.entityCallout}>
                <Text style={styles.calloutTitle}>{translateText(org.organization_name)}</Text>
                <Text style={styles.calloutKind}>{labels.organizationPointer}</Text>
                <Text style={styles.calloutMeta}>
                  {labels.type}: {org.is_branch ? labels.branchOrganization : labels.partnerOrganization}
                  {"\n"}
                  {labels.address}: {translateAddress(org.address) || labels.areaOrganization}
                  {"\n"}
                  {labels.phone}: {org.phone || labels.notAvailable}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Volunteer markers – visible only when zoomed in */}
        {showEntities && parsedVolunteers.map((vol) => (
          <Marker
            key={`vol-${vol.id}`}
            coordinate={{ latitude: vol.latitude, longitude: vol.longitude }}
            anchor={{ x: 0.25, y: 0.9 }}
          >
            <View style={styles.volPin}>
              <Text style={styles.pinInner}>V</Text>
            </View>
            <Callout>
              <View style={styles.entityCallout}>
                <Text style={styles.calloutTitle}>{vol.user_name || `Volunteer #${vol.id}`}</Text>
                <Text style={styles.calloutKind}>{labels.volunteerPointer}</Text>
                <Text style={styles.calloutMeta}>
                  {labels.status}: {vol.availability ? labels.available : labels.busy}
                  {vol.verified ? ` · ${labels.verified}` : ""}
                  {"\n"}
                  {labels.area}: {[vol.colony, vol.city].filter(Boolean).join(", ") || labels.nearbyArea}
                  {"\n"}
                  {labels.tasks}: {vol.tasks_completed} {labels.completed} · {vol.active_tasks} {labels.active}
                  {"\n"}
                  {labels.phone}: {vol.phone || labels.notAvailable}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Branch markers */}
        {branchMarkers.map((marker, idx) => (
          <Marker key={`branch-${idx}`} coordinate={{ latitude: marker.lat, longitude: marker.lng }} anchor={{ x: 0.25, y: 0.9 }}>
            <View style={[marker.isHQ ? styles.hqPin : styles.orgPin]}>
              <Text style={styles.pinInner}>{marker.isHQ ? "H" : "O"}</Text>
            </View>
            <Callout>
              <View style={{ padding: 8, minWidth: 120 }}>
                <Text style={styles.calloutTitle}>{marker.label}</Text>
                <Text style={styles.calloutKind}>{marker.isHQ ? "Headquarters" : "Branch"}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Legend overlay */}
      {showHeatmap && (
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>{labels.needsHeatMap}</Text>
          {(["active", "in_progress", "completed"] as const).map((key) => (
            <View key={key} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[key] }]} />
              <Text style={styles.legendLabel}>
                {key === "active" ? labels.activeNeeds : key === "in_progress" ? labels.inProgress : labels.completed} (
                {statusSummary[key]})
              </Text>
            </View>
          ))}
          <Text style={styles.legendHint}>{labels.intensityLowHigh}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  map: { flex: 1 },

  needDot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0F172A", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  needDotText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  needCluster: {
    borderWidth: 2, borderColor: "rgba(255,255,255,0.9)", opacity: 0.85,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#0F172A", shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  needClusterText: { color: "#fff", fontSize: 11, fontWeight: "900" },

  orgPin: {
    width: 26, height: 26, borderRadius: 13, borderBottomLeftRadius: 4,
    backgroundColor: "#7C3AED", borderWidth: 2, borderColor: "#fff",
    alignItems: "center", justifyContent: "center", transform: [{ rotate: "-45deg" }],
    shadowColor: "#0F172A", shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  hqPin: {
    width: 30, height: 30, borderRadius: 15, borderBottomLeftRadius: 4,
    backgroundColor: "#DC2626", borderWidth: 2, borderColor: "#fff",
    alignItems: "center", justifyContent: "center", transform: [{ rotate: "-45deg" }],
    shadowColor: "#0F172A", shadowOpacity: 0.32, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  volPin: {
    width: 26, height: 26, borderRadius: 13, borderBottomLeftRadius: 4,
    backgroundColor: "#0891B2", borderWidth: 2, borderColor: "#fff",
    alignItems: "center", justifyContent: "center", transform: [{ rotate: "-45deg" }],
    shadowColor: "#0F172A", shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  pinInner: { color: "#fff", fontSize: 12, fontWeight: "900", transform: [{ rotate: "45deg" }] },

  areaBubble: {
    minWidth: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6, opacity: 0.75,
    shadowColor: "#0F172A", shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  areaBubbleText: { color: "#fff", fontSize: 12, fontWeight: "900" },

  needCallout: { minWidth: 220, maxWidth: 280, padding: 10 },
  areaCallout: { minWidth: 180, padding: 10 },
  entityCallout: { minWidth: 200, padding: 10 },
  calloutTitle: { fontSize: 14, fontWeight: "900", color: "#111827", marginBottom: 4 },
  calloutCity: { fontSize: 10, fontWeight: "800", color: "#64748B", textTransform: "uppercase", marginBottom: 8 },
  calloutKind: { fontSize: 10, fontWeight: "900", color: "#64748B", textTransform: "uppercase", marginBottom: 8 },
  calloutMeta: { fontSize: 12, fontWeight: "700", color: "#475569", lineHeight: 18 },
  calloutActionWrap: {
    backgroundColor: "#111827", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, marginTop: 8, alignItems: "center",
  },
  calloutAction: { color: "#fff", fontSize: 11, fontWeight: "900" },

  legend: {
    position: "absolute", bottom: 12, right: 12,
    backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: "rgba(15,23,42,0.1)",
    shadowColor: "#0F172A", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  legendTitle: { fontSize: 11, fontWeight: "900", color: "#111827", marginBottom: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
  legendDot: { width: 12, height: 12 },
  legendLabel: { fontSize: 12, fontWeight: "700", color: "#111827" },
  legendHint: { fontSize: 11, fontWeight: "800", color: "#64748B", marginTop: 6 },
});
