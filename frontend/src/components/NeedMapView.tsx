import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import type { Need, Organization, Volunteer } from "../types/api";
import { buildWebMapHtml } from "./NeedMapViewMapHtml";

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
  const webViewRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const onNeedPressRef = useRef(onNeedPress);
  onNeedPressRef.current = onNeedPress;

  const html = useMemo(
    () => buildWebMapHtml({ needs, organizations, volunteers, currentLocation, branchMarkers, showHeatmap, labels, translateText, translateAddress }),
    [needs, organizations, volunteers, currentLocation, branchMarkers, showHeatmap, labels, translateText, translateAddress],
  );

  const handleMessage = useCallback((event: any) => {
    try {
      const data = typeof event.nativeEvent.data === 'string' ? JSON.parse(event.nativeEvent.data) : event.nativeEvent.data;
      if (data && data.type === "openNeed" && typeof data.needId === "number") {
        onNeedPressRef.current(data.needId);
      }
    } catch {}
  }, []);

  return (
    <View style={[styles.container, { height }]}>
      {!loaded && (
        <View style={styles.loader}>
          <ActivityIndicator color="#94A3B8" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        style={loaded ? styles.map : styles.mapHidden}
        source={{ html }}
        onLoadEnd={() => setLoaded(true)}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        bounces={false}
        originWhitelist={["*"]}
        mixedContentMode="always"
        allowsInlineMediaPlayback
        allowFileAccess
        allowUniversalAccessFromFileURLs
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  map: { flex: 1 },
  mapHidden: { flex: 1, opacity: 0 },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#E5E7EB", zIndex: 1 },
});