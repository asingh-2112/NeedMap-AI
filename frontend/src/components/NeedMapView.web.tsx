import { createElement, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { Need, Organization, Volunteer } from "../types/api";
import { buildWebMapHtml, type WebMapInput } from "./NeedMapViewMapHtml";

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

  const html = useMemo(() => buildWebMapHtml({
    needs, organizations, volunteers, currentLocation,
    branchMarkers, showHeatmap, labels, translateText, translateAddress,
  }),
  [needs, organizations, volunteers, currentLocation, branchMarkers, showHeatmap, labels, translateText, translateAddress]);

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

