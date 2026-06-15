import { createElement, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
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
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== "needmap-admin-map" || data.type !== "openNeed") return;
      const needId = Number(data.needId);
      if (Number.isFinite(needId)) onNeedPress(needId);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onNeedPress]);

  const html = useMemo(() => {
    const markers = [
      ...(currentLocation ? [{ lat: currentLocation.latitude, lng: currentLocation.longitude, label: labels.currentLocation || "Current Location" }] : []),
      ...branchMarkers,
    ];

    const needsForMap = needs
      .filter((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude))
      .map((n) => ({
        id: n.id, lat: n.latitude, lng: n.longitude, status: n.status,
        title: translateText(n.title),
        description: translateText(n.description || ""),
        category: n.category, urgency: n.urgency,
        affected_count: n.affected_count ?? null,
        priority_score: n.priority_score ?? null,
        created_at: n.created_at,
        area: (n.colony || n.street || "").trim(),
        city: (n.city || "").trim(),
        address: translateAddress(n.address),
      }));

    const orgsForMap = organizations
      .map((org) => {
        const [latS, lngS] = (org.branch_location || "").split(",").map((s) => s.trim());
        const lat = Number(latS);
        const lng = Number(lngS);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: org.id, lat, lng,
          name: translateText(org.organization_name),
          address: translateAddress(org.address),
          phone: org.phone || "",
          is_branch: Boolean(org.is_branch),
        };
      })
      .filter((o): o is NonNullable<typeof o> => o !== null);

    const volsForMap = volunteers
      .filter((v) => typeof v.latitude === "number" && typeof v.longitude === "number")
      .map((v) => ({
        id: v.id, lat: v.latitude as number, lng: v.longitude as number,
        name: v.user_name || `Volunteer #${v.id}`,
        phone: v.phone || "",
        area: v.colony || "", city: v.city || "",
        availability: v.availability, verified: v.verified,
        tasks_completed: v.tasks_completed, active_tasks: v.active_tasks,
      }));

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
      .cluster-bubble { align-items: center; border: 2px solid #fff; border-radius: 999px; box-shadow: 0 8px 20px rgba(15,23,42,0.32); color: #fff; display: flex; font: 900 12px system-ui, sans-serif; height: 30px; justify-content: center; width: 30px; }
      .entity-pin { align-items: center; border: 2px solid #fff; border-radius: 999px 999px 999px 4px; box-shadow: 0 6px 14px rgba(15,23,42,0.28); color: #fff; display: flex; font: 900 12px system-ui, sans-serif; height: 26px; justify-content: center; transform: rotate(-45deg); width: 26px; }
      .entity-pin span { transform: rotate(45deg); }
      .org-pin { background: #7C3AED; }
      .volunteer-pin { background: #0891B2; }
      .hq-pin { background: #DC2626; }
      .entity-popup { color: #111827; min-width: 210px; padding: 10px; }
      .entity-title { font-size: 14px; font-weight: 900; margin-bottom: 3px; }
      .entity-kind { color: #64748B; font-size: 10px; font-weight: 900; margin-bottom: 8px; text-transform: uppercase; }
      .entity-meta { color: #334155; font-size: 12px; font-weight: 700; line-height: 1.45; }
      .area-bubble { align-items: center; border: 2px solid rgba(255,255,255,0.85); border-radius: 999px; box-shadow: 0 4px 12px rgba(15,23,42,0.22); color: #fff; cursor: pointer; display: flex; font: 900 12px system-ui, sans-serif; justify-content: center; text-shadow: 0 1px 2px rgba(0,0,0,0.3); opacity: 0.75; }
      .area-bubble.nearby { border-color: #0F766E; box-shadow: 0 0 0 8px rgba(64,224,208,0.28), 0 16px 34px rgba(15,23,42,0.28); }
      .current-dot { align-items: center; background: #2563EB; border: 3px solid #FFFFFF; border-radius: 999px; box-shadow: 0 0 0 9px rgba(37,99,235,0.16), 0 10px 22px rgba(37,99,235,0.32); color: #fff; display: flex; font: 900 11px system-ui, sans-serif; height: 22px; justify-content: center; width: 22px; }
      .need-dot { align-items: center; border: 1.5px solid #FFFFFF; border-radius: 999px; box-shadow: 0 4px 10px rgba(15,23,42,0.25); color: #fff; cursor: pointer; display: flex; font: 900 9px system-ui, sans-serif; height: 16px; justify-content: center; width: 16px; }
      .need-dot.active { background: #E63B2E; }
      .need-dot.in_progress { background: #F5A623; }
      .need-dot.completed { background: #4CAF50; }
      .need-cluster { align-items: center; border: 2px solid rgba(255,255,255,0.9); border-radius: 999px; box-shadow: 0 4px 12px rgba(15,23,42,0.22); color: #fff; cursor: pointer; display: flex; font: 900 11px system-ui, sans-serif; justify-content: center; opacity: 0.85; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
      .need-popup { color: #111827; min-width: 230px; padding: 10px; }
      .need-popup-title { color: #111827; font-size: 13px; font-weight: 900; line-height: 1.25; margin-bottom: 6px; }
      .need-popup-meta { color: #475569; font-size: 11px; font-weight: 700; line-height: 1.45; }
      .need-detail-btn { background: #111827; border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: 900 11px system-ui, sans-serif; margin-top: 7px; padding: 7px 8px; width: 100%; }
      .area-needs-list { border-top: 1px solid #E2E8F0; display: grid; gap: 8px; margin-top: 10px; max-height: 280px; overflow-y: auto; padding-top: 10px; }
      .area-need-item { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px; }
      .area-need-title { color: #111827; font-size: 12px; font-weight: 900; line-height: 1.3; margin-bottom: 5px; }
      .area-need-meta { color: #475569; font-size: 11px; font-weight: 700; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
    <script>
      const markers = ${JSON.stringify(markers)};
      const needs = ${JSON.stringify(needsForMap)};
      const organizations = ${JSON.stringify(orgsForMap)};
      const volunteers = ${JSON.stringify(volsForMap)};
      const mapLabels = ${JSON.stringify(labels)};
      const showAdminHeatmap = ${JSON.stringify(showHeatmap)};
      const currentLocation = ${JSON.stringify(currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null)};
      const openFullMapView = false;

      const normalizeStatus = (status) => {
        const value = (status || '').toLowerCase();
        if (value === 'resolved' || value === 'closed') return 'completed';
        if (value === 'in_progress') return 'in_progress';
        return 'active';
      };

      const parseCityFromAddress = (address) => {
        if (!address) return mapLabels.notAvailable || 'N/A';
        const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 3) return parts[parts.length - 3];
        if (parts.length >= 2) return parts[parts.length - 2];
        return parts[0] || mapLabels.notAvailable || 'N/A';
      };

      const parseAreaFromAddress = (address) => {
        if (!address) return mapLabels.notAvailable || 'N/A';
        const parts = String(address).split(',').map((p) => p.trim()).filter(Boolean);
        return parts[0] || mapLabels.notAvailable || 'N/A';
      };

      const hexToRgb = (hex) => {
        const value = parseInt(hex.replace('#', ''), 16);
        return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
      };
      const rgbToHex = (r, g, b) => {
        const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
        return '#' + toHex(r) + toHex(g) + toHex(b);
      };

      const statusColors = { active: '#E63B2E', in_progress: '#F5A623', completed: '#4CAF50' };
      const statusLabels = { active: mapLabels.active || 'Active', in_progress: mapLabels.inProgress || 'In Progress', completed: mapLabels.completed || 'Completed' };

      const interpolate = (from, to, value) => {
        const f = hexToRgb(from); const t = hexToRgb(to);
        return rgbToHex(f.r + (t.r - f.r) * value, f.g + (t.g - f.g) * value, f.b + (t.b - f.b) * value);
      };
      const intensityColor = (status, intensity) => interpolate('#F8FAFC', statusColors[status] || '#E63B2E', Math.max(0.35, intensity));

      const priorityWeight = (need) => {
        const u = String(need.urgency || '').toLowerCase();
        if (u === 'critical') return 1;
        if (u === 'high') return 0.85;
        if (u === 'medium') return 0.62;
        return 0.42;
      };

      const escapeHtml = (v) => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
      const formatText = (v) => String(v || mapLabels.notAvailable || 'N/A').replace(/_/g, ' ');

      const openNeedDetail = (needId) => {
        const msg = { source: 'needmap-admin-map', type: 'openNeed', needId };
        if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(msg, '*');
          try { window.opener.focus(); } catch(e) {}
        }
        if (openFullMapView) window.setTimeout(() => window.close(), 80);
      };

      document.addEventListener('click', (e) => {
        const t = e.target && e.target.closest ? e.target.closest('[data-need-id]') : null;
        if (!t) return;
        const id = Number(t.getAttribute('data-need-id'));
        if (Number.isFinite(id)) openNeedDetail(id);
      });

      const dominantStatus = (area) => {
        const r = [['active', area.active], ['in_progress', area.in_progress], ['completed', area.completed]];
        r.sort((a, b) => b[1] - a[1]);
        return r[0][0];
      };

      const buildAreaList = (src) => {
        const buckets = {};
        src.forEach((n) => {
          const city = (n.city && String(n.city).trim()) || parseCityFromAddress(n.address);
          const area = (n.area && String(n.area).trim()) || parseAreaFromAddress(n.address);
          const key = city.toLowerCase() + '|' + area.toLowerCase();
          if (!buckets[key]) buckets[key] = { area, city, points: [], needs: [], total: 0, active: 0, in_progress: 0, completed: 0 };
          buckets[key].points.push([n.lat, n.lng]);
          buckets[key].needs.push(n);
          buckets[key].total += 1;
          buckets[key][normalizeStatus(n.status)] += 1;
        });
        return Object.values(buckets);
      };

      const cross = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
      const convexHull = (pts) => {
        const u = Array.from(new Map(pts.map(p => [p.join(','), p])).values()).sort((a, b) => a[1] === b[1] ? a[0] - b[0] : a[1] - b[1]);
        if (u.length <= 2) return u;
        const lo = []; u.forEach(p => { while (lo.length >= 2 && cross(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop(); lo.push(p); });
        const hi = []; [...u].reverse().forEach(p => { while (hi.length >= 2 && cross(hi[hi.length-2], hi[hi.length-1], p) <= 0) hi.pop(); hi.push(p); });
        hi.pop(); lo.pop(); return lo.concat(hi);
      };

      const buildAreaPolygon = (pts, intensity) => {
        const hull = convexHull(pts);
        const center = pts.reduce((a,p) => [a[0]+p[0], a[1]+p[1]], [0,0]).map(v => v/pts.length);
        const pad = 0.004 + intensity * 0.008;
        if (hull.length === 1) { const p = hull[0]; return [[p[0]+pad,p[1]],[p[0],p[1]+pad*1.25],[p[0]-pad,p[1]],[p[0],p[1]-pad*1.25]]; }
        if (hull.length === 2) {
          const [a,b] = hull; const dx=b[1]-a[1]; const dy=b[0]-a[0]; const l=Math.max(Math.sqrt(dx*dx+dy*dy),0.0001);
          const oLat=(dx/l)*pad; const oLng=(-dy/l)*pad;
          return [[a[0]+oLat,a[1]+oLng],[b[0]+oLat,b[1]+oLng],[b[0]-oLat,b[1]-oLng],[a[0]-oLat,a[1]-oLng]];
        }
        return hull.map(p => { const vL=p[0]-center[0]; const vG=p[1]-center[1]; const l=Math.max(Math.sqrt(vL*vL+vG*vG),0.0001); return [p[0]+(vL/l)*pad, p[1]+(vG/l)*pad]; });
      };

      const areaCenter = (pts) => pts.reduce((a,p)=>[a[0]+p[0],a[1]+p[1]],[0,0]).map(v=>v/pts.length);

      const distanceKm = (a, b) => {
        const toRad = v => v * Math.PI / 180; const R = 6371;
        const dLat = toRad(b[0]-a[0]); const dLng = toRad(b[1]-a[1]);
        const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
      };

      const getNearbyAreaKeys = (areaList) => {
        const keys = new Set();
        if (!showAdminHeatmap || !currentLocation || areaList.length === 0) return keys;
        areaList.map(a => ({ a, d: distanceKm([currentLocation.lat, currentLocation.lng], areaCenter(a.points)) }))
          .sort((x,y) => x.d - y.d).slice(0, 3)
          .forEach(i => keys.add(i.a.city.toLowerCase() + '|' + i.a.area.toLowerCase()));
        return keys;
      };

      const map = L.map('map', { zoomControl: true });
      const hasUsableMapSize = () => { const s = map.getSize(); const c = map.getContainer(); return s.x > 0 && s.y > 0 && c.clientWidth > 0 && c.clientHeight > 0; };
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, opacity: showAdminHeatmap ? 0.90 : 1, attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const bounds = [];
      let zonesLayer = L.layerGroup().addTo(map);
      let markerLayer = L.layerGroup().addTo(map);
      let needLayer = L.layerGroup().addTo(map);
      let entityLayer = L.layerGroup().addTo(map);
      let heatLayer = null;
      let firstRender = true;

      const entityIcon = (kind) => L.divIcon({ className: '', html: '<div class="entity-pin ' + kind + '-pin"><span>' + (kind === 'org' ? 'O' : 'V') + '</span></div>', iconSize: [28,28], iconAnchor: [7,24], popupAnchor: [7,-24] });
      const areaBubbleIcon = (area, status, intensity, isNearby) => {
        const size = Math.round(36 + Math.min(1, intensity) * 28);
        const color = statusColors[status] || '#E63B2E';
        return L.divIcon({ className: '', html: '<div class="area-bubble ' + (isNearby ? 'nearby' : '') + '" style="width:'+size+'px;height:'+size+'px;background:'+color+';">'+area.total+'</div>', iconSize: [size,size], iconAnchor: [size/2,size/2], popupAnchor: [0,-size/2] });
      };
      const currentLocationIcon = () => L.divIcon({ className: '', html: '<div class="current-dot">•</div>', iconSize: [28,28], iconAnchor: [14,14], popupAnchor: [0,-14] });
      const needDotIcon = (status) => L.divIcon({ className: '', html: '<div class="need-dot '+status+'">N</div>', iconSize: [18,18], iconAnchor: [9,9], popupAnchor: [0,-10] });

      const needClusterIcon = (count, status) => {
        const size = Math.round(28 + Math.min(count / 8, 1) * 20);
        const color = statusColors[status] || '#E63B2E';
        return L.divIcon({ className: '', html: '<div class="need-cluster" style="width:'+size+'px;height:'+size+'px;background:'+color+';">'+count+'</div>', iconSize: [size,size], iconAnchor: [size/2,size/2], popupAnchor: [0,-size/2] });
      };

      const clusterNeeds = (src, zoom) => {
        const gridSize = 0.003 / Math.pow(2, Math.max(0, zoom - 14));
        const buckets = {};
        src.forEach(n => {
          const gx = Math.floor(n.lat / gridSize);
          const gy = Math.floor(n.lng / gridSize);
          const key = gx + '|' + gy;
          if (!buckets[key]) buckets[key] = [];
          buckets[key].push(n);
        });
        return Object.values(buckets).map(group => {
          const lat = group.reduce((s,n) => s + n.lat, 0) / group.length;
          const lng = group.reduce((s,n) => s + n.lng, 0) / group.length;
          const counts = group.reduce((a,n) => { a[normalizeStatus(n.status)] += 1; return a; }, { active: 0, in_progress: 0, completed: 0 });
          const dominant = counts.active >= counts.in_progress && counts.active >= counts.completed ? 'active' : counts.in_progress >= counts.completed ? 'in_progress' : 'completed';
          return { lat, lng, count: group.length, status: dominant, needs: group };
        });
      };

      const needPopupHtml = (need) => {
        const status = normalizeStatus(need.status);
        const affected = typeof need.affected_count === 'number' ? need.affected_count : (mapLabels.notAvailable || 'N/A');
        const score = typeof need.priority_score === 'number' ? need.priority_score.toFixed(2) : (mapLabels.notAvailable || 'N/A');
        return '<div class="need-popup"><div class="need-popup-title">' + escapeHtml(need.title || (mapLabels.need || 'Need') + ' #' + need.id) + '</div><div class="need-popup-meta"><b>' + (mapLabels.status || 'Status') + ':</b> ' + escapeHtml(statusLabels[status] || formatText(need.status)) + '<br/><b>' + (mapLabels.category || 'Category') + ':</b> ' + escapeHtml(formatText(need.category)) + '<br/><b>' + (mapLabels.urgency || 'Urgency') + ':</b> ' + escapeHtml(formatText(need.urgency)) + '<br/><b>' + (mapLabels.affected || 'Affected') + ':</b> ' + escapeHtml(affected) + ' · <b>' + (mapLabels.priority || 'Priority') + ':</b> ' + escapeHtml(score) + '<br/><b>' + (mapLabels.address || 'Address') + ':</b> ' + escapeHtml(need.address || (mapLabels.unknownLocation || 'Unknown')) + '</div><button class="need-detail-btn" type="button" data-need-id="' + need.id + '">' + (mapLabels.openNeedDetails || 'Open need details') + '</button></div>';
      };

      const clusterPopupHtml = (cluster) => {
        const items = cluster.needs.slice(0, 5).map(n => {
          const s = normalizeStatus(n.status);
          return '<div class="area-need-item"><div class="area-need-title">' + escapeHtml(n.title || 'Need #' + n.id) + '</div><div class="area-need-meta"><b>' + (mapLabels.status || 'Status') + ':</b> ' + escapeHtml(statusLabels[s] || formatText(n.status)) + ' · <b>' + (mapLabels.category || 'Category') + ':</b> ' + escapeHtml(formatText(n.category)) + '</div></div>';
        }).join('');
        const more = cluster.needs.length > 5 ? '<div style="color:#64748B;font-size:11px;font-weight:700;margin-top:6px;text-align:center;">+ ' + (cluster.needs.length - 5) + ' more</div>' : '';
        return '<div class="popup-card"><div class="popup-title">' + cluster.count + ' ' + (mapLabels.needs || 'Needs') + '</div><div class="area-needs-list">' + items + more + '</div></div>';
      };

      const renderNeedDots = (src) => {
        needLayer.clearLayers();
        const zoom = map.getZoom();
        if (!Number.isFinite(zoom) || zoom < 13) return;
        const clusters = clusterNeeds(src, zoom);
        clusters.forEach(c => {
          if (c.count === 1) {
            const n = c.needs[0];
            const s = normalizeStatus(n.status);
            L.marker([n.lat, n.lng], { icon: needDotIcon(s), zIndexOffset: 760 }).addTo(needLayer)
              .bindTooltip(n.title || 'Need', { direction: 'top', offset: [0,-8], opacity: 0.9 })
              .bindPopup(needPopupHtml(n));
          } else {
            L.marker([c.lat, c.lng], { icon: needClusterIcon(c.count, c.status), zIndexOffset: 750 }).addTo(needLayer)
              .bindPopup(clusterPopupHtml(c), { className: 'area-popup', maxWidth: 320 });
          }
        });
      };

      const renderEntityMarkers = () => {
        entityLayer.clearLayers();
        const zoom = map.getZoom();
        if (!Number.isFinite(zoom) || zoom < 14) return;
        organizations.forEach(o => {
          L.marker([o.lat, o.lng], { icon: entityIcon('org'), zIndexOffset: 650 }).addTo(entityLayer)
            .bindPopup('<div class="entity-popup"><div class="entity-title">' + escapeHtml(o.name) + '</div><div class="entity-kind">' + (mapLabels.organizationPointer || 'Organization') + '</div><div class="entity-meta"><b>' + (mapLabels.type || 'Type') + ':</b> ' + (o.is_branch ? (mapLabels.branchOrganization || 'Branch') : (mapLabels.partnerOrganization || 'Partner')) + '<br/><b>' + (mapLabels.address || 'Address') + ':</b> ' + escapeHtml(o.address || (mapLabels.areaOrganization || 'N/A')) + '<br/><b>' + (mapLabels.phone || 'Phone') + ':</b> ' + escapeHtml(o.phone || (mapLabels.notAvailable || 'N/A')) + '</div></div>');
        });
        volunteers.forEach(v => {
          L.marker([v.lat, v.lng], { icon: entityIcon('volunteer'), zIndexOffset: 700 }).addTo(entityLayer)
            .bindPopup('<div class="entity-popup"><div class="entity-title">' + escapeHtml(v.name) + '</div><div class="entity-kind">' + (mapLabels.volunteerPointer || 'Volunteer') + '</div><div class="entity-meta"><b>' + (mapLabels.status || 'Status') + ':</b> ' + (v.availability ? (mapLabels.available || 'Available') : (mapLabels.busy || 'Busy')) + (v.verified ? ' · ' + (mapLabels.verified || 'Verified') : '') + '<br/><b>' + (mapLabels.area || 'Area') + ':</b> ' + escapeHtml([v.area, v.city].filter(Boolean).join(', ') || (mapLabels.nearbyArea || 'Nearby')) + '<br/><b>' + (mapLabels.tasks || 'Tasks') + ':</b> ' + v.tasks_completed + ' ' + (mapLabels.completed || 'completed') + ' · ' + v.active_tasks + ' ' + (mapLabels.active || 'active') + '<br/><b>' + (mapLabels.phone || 'Phone') + ':</b> ' + escapeHtml(v.phone || (mapLabels.notAvailable || 'N/A')) + '</div></div>');
        });
      };

      const updateLegend = (src) => {
        const summary = src.reduce((a, n) => { a[normalizeStatus(n.status)] += 1; return a; }, { active: 0, in_progress: 0, completed: 0 });
        const el = document.getElementById('heatLegend');
        if (!el) return;
        el.innerHTML = '<div style="font-weight:900;margin-bottom:9px;">' + (mapLabels.needsHeatMap || 'NEEDS HEAT MAP') + '</div><div style="display:grid;gap:7px;"><div><span style="background:#E63B2E;display:inline-block;height:12px;margin-right:7px;width:12px;"></span>' + (mapLabels.activeNeeds || 'Active') + ' <strong>(' + summary.active + ')</strong></div><div><span style="background:#F5A623;display:inline-block;height:12px;margin-right:7px;width:12px;"></span>' + (mapLabels.inProgress || 'In Progress') + ' <strong>(' + summary.in_progress + ')</strong></div><div><span style="background:#4CAF50;display:inline-block;height:12px;margin-right:7px;width:12px;"></span>' + (mapLabels.completed || 'Completed') + ' <strong>(' + summary.completed + ')</strong></div></div><div style="margin-top:10px;font-size:11px;font-weight:800;">' + (mapLabels.intensityLowHigh || 'Intensity: Low to High') + '</div>';
      };

      let cachedAreaList = [];
      let cachedNearbyKeys = null;

      const renderAreaBubbles = () => {
        zonesLayer.clearLayers();
        markerLayer.clearLayers();
        const zoom = map.getZoom();
        if (!Number.isFinite(zoom) || zoom >= 15) return;
        cachedAreaList.forEach(area => {
          const status = dominantStatus(area);
          const intensity = Math.min(area.total / 10, 1);
          const poly = buildAreaPolygon(area.points, intensity);
          const isNearby = cachedNearbyKeys ? cachedNearbyKeys.has(area.city.toLowerCase() + '|' + area.area.toLowerCase()) : false;
          L.polygon(poly, { color: 'transparent', weight: 0, fillColor: statusColors[status], fillOpacity: 0.08, stroke: false }).addTo(zonesLayer);
          const center = areaCenter(area.points);
          L.marker(center, { icon: areaBubbleIcon(area, status, intensity, isNearby), zIndexOffset: 500 }).addTo(markerLayer)
            .bindPopup('<div class="popup-card"><div class="popup-title">' + escapeHtml(area.area) + '</div><div class="popup-city">' + escapeHtml(area.city) + '</div><div class="popup-total"><span>' + (mapLabels.total || 'Total') + '</span><strong>' + area.total + '</strong></div><div class="popup-grid"><div class="popup-stat" style="background:#FEE2E2;"><strong style="color:#991B1B;">' + area.active + '</strong><span style="color:#991B1B;">' + (mapLabels.active || 'Active') + '</span></div><div class="popup-stat" style="background:#FEF3C7;"><strong style="color:#92400E;">' + area.in_progress + '</strong><span style="color:#92400E;">' + (mapLabels.inProgress || 'Progress') + '</span></div><div class="popup-stat" style="background:#DCFCE7;"><strong style="color:#166534;">' + area.completed + '</strong><span style="color:#166534;">' + (mapLabels.completed || 'Done') + '</span></div></div></div>', { className: 'area-popup', maxWidth: 320 });
        });
      };

      const renderAdminMap = () => {
        const src = needs;
        cachedAreaList = buildAreaList(src);
        cachedNearbyKeys = getNearbyAreaKeys(cachedAreaList);
        zonesLayer.clearLayers(); markerLayer.clearLayers(); needLayer.clearLayers(); entityLayer.clearLayers();
        if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
        updateLegend(src);

        if (L.heatLayer && src.length > 0 && hasUsableMapSize()) {
          try {
            heatLayer = L.heatLayer(src.map(n => [n.lat, n.lng, priorityWeight(n)]), {
              radius: 50, blur: 40, maxZoom: 16, minOpacity: 0.3,
              gradient: { 0.15: '#FDE68A', 0.4: '#FBBF24', 0.65: '#F97316', 1: '#EF4444' },
            }).addTo(map);
          } catch(e) { heatLayer = null; }
        }

        renderAreaBubbles();

        if (firstRender) src.forEach(n => bounds.push([n.lat, n.lng]));
        renderEntityMarkers();
        renderNeedDots(src);
        map.off('zoomend'); map.on('zoomend', () => { renderAreaBubbles(); renderNeedDots(src); renderEntityMarkers(); });
        firstRender = false;
      };

      if (showAdminHeatmap && needs.length > 0) {
        if (currentLocation) {
          L.marker([currentLocation.lat, currentLocation.lng], { icon: currentLocationIcon(), zIndexOffset: 900 }).addTo(map)
            .bindTooltip(mapLabels.currentLocation || 'Current location', { className: 'current-location-label', direction: 'top', offset: [0,-10], permanent: true, opacity: 0.95 })
            .bindPopup('<b>' + (mapLabels.currentLocation || 'Current location') + '</b><br/>' + (mapLabels.nearbyHighlightedAreas || ''));
          bounds.push([currentLocation.lat, currentLocation.lng]);
        }
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function() { const d = L.DomUtil.create('div', 'legend'); d.id = 'heatLegend'; return d; };
        legend.addTo(map);
        renderAdminMap();
      } else {
        if (currentLocation) {
          L.marker([currentLocation.lat, currentLocation.lng], { icon: currentLocationIcon(), zIndexOffset: 900 }).addTo(map)
            .bindTooltip(mapLabels.currentLocation || 'Current location', { className: 'current-location-label', direction: 'top', offset: [0,-10], permanent: true, opacity: 0.95 });
          bounds.push([currentLocation.lat, currentLocation.lng]);
        }
        markers.forEach(m => {
          const isHQ = m.isHQ || false;
          const kind = isHQ ? 'hq' : 'org';
          const letter = isHQ ? 'H' : 'O';
          const icon = L.divIcon({ className: '', html: '<div class="entity-pin ' + kind + '-pin"><span>' + letter + '</span></div>', iconSize: [28,28], iconAnchor: [7,24], popupAnchor: [7,-24] });
          L.marker([m.lat, m.lng], { icon: icon, zIndexOffset: isHQ ? 800 : 650 }).addTo(map)
            .bindPopup('<div class="entity-popup"><div class="entity-title">' + escapeHtml(m.label || '') + '</div><div class="entity-kind">' + (isHQ ? (mapLabels.headquarter || 'Headquarters') : (mapLabels.branchOrganization || 'Branch')) + '</div></div>');
          bounds.push([m.lat, m.lng]);
        });
        organizations.forEach(o => {
          L.marker([o.lat, o.lng], { icon: entityIcon('org'), zIndexOffset: 650 }).addTo(map)
            .bindPopup('<div class="entity-popup"><div class="entity-title">' + escapeHtml(o.name) + '</div><div class="entity-kind">' + (mapLabels.organizationPointer || 'Organization') + '</div><div class="entity-meta"><b>' + (mapLabels.address || 'Address') + ':</b> ' + escapeHtml(o.address || (mapLabels.areaOrganization || 'N/A')) + '<br/><b>' + (mapLabels.phone || 'Phone') + ':</b> ' + escapeHtml(o.phone || (mapLabels.notAvailable || 'N/A')) + '</div></div>');
          bounds.push([o.lat, o.lng]);
        });
      }

      if (showAdminHeatmap && openFullMapView && currentLocation) {
        map.setView([currentLocation.lat, currentLocation.lng], 16);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [18,18], maxZoom: showAdminHeatmap ? 15 : 19 });
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
  }, [needs, organizations, volunteers, currentLocation, branchMarkers, showHeatmap, labels, translateText, translateAddress]);

  return (
    <View style={[styles.container, { height }]}>
      {createElement("iframe", {
        srcDoc: html,
        style: { width: "100%", height: "100%", border: "none", borderRadius: 12 },
        title: "NeedMap",
        loading: "lazy",
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
});
