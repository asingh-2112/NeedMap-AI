import { useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { NeedMapView } from "../../components/NeedMapView";
import { moduleApi } from "../../services/api";
import { getLiveLocation } from "../../services/location";
import type { RootStackParamList } from "../../navigation/types";
import type { Need, Organization, Volunteer } from "../../types/api";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const FullMapScreen = () => {
  const nav = useNavigation<Nav>();
  const { baseUrl, token, user } = useAuth();
  const { t, translateText, translateAddress } = useLanguage();

  const isOrgOwner = user?.role === "owner" && !!user?.organization_id;
  const isAdmin = user?.role === "admin";
  const isVolunteer = user?.role === "volunteer";
  const showHeatmap = isAdmin || isVolunteer;
  const adminBranchId = isAdmin ? user?.managed_branch_id ?? null : null;
  const scopedOrgId = isAdmin ? adminBranchId ?? user?.organization_id : user?.organization_id;

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapNeeds, setMapNeeds] = useState<Need[]>([]);
  const [mapOrgs, setMapOrgs] = useState<Organization[]>([]);
  const [mapVols, setMapVols] = useState<Volunteer[]>([]);
  const [branches, setBranches] = useState<Organization[]>([]);

  useEffect(() => {
    getLiveLocation()
      .then((loc) => { if (loc) setLocation({ latitude: loc.latitude, longitude: loc.longitude }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        if (isOrgOwner && scopedOrgId) {
          const branchList = await moduleApi.organizationBranches(baseUrl, token, scopedOrgId);
          setBranches(branchList);
        } else if (isAdmin && adminBranchId) {
          const [needsData, orgsData, volsData] = await Promise.all([
            moduleApi.needs(baseUrl, token, { organization_id: adminBranchId }),
            moduleApi.organizations(baseUrl, token),
            moduleApi.volunteers(baseUrl, token),
          ]);
          setMapNeeds(needsData.filter((n) => n.organization_id === adminBranchId));
          setMapOrgs(orgsData.filter((o) => Boolean(o.branch_location)));
          setMapVols(volsData.filter((v) => typeof v.latitude === "number" && typeof v.longitude === "number"));
        } else {
          const [needsData, orgsData] = await Promise.all([
            moduleApi.needs(baseUrl, token),
            moduleApi.organizations(baseUrl, token),
          ]);
          setMapNeeds(needsData);
          setMapOrgs(orgsData.filter((o) => Boolean(o.branch_location)));
        }
      } catch (err) {
        console.error("[FullMapScreen] Error loading data:", err);
      }
    };
    load();
  }, [adminBranchId, baseUrl, isAdmin, isOrgOwner, scopedOrgId, token]);

  const validBranchMarkers = useMemo(
    () =>
      branches
        .map((b) => {
          if (!b.branch_location) return null;
          const [lat, lng] = b.branch_location.split(",").map((s) => parseFloat(s.trim()));
          if (isNaN(lat) || isNaN(lng)) return null;
          return { lat, lng, label: b.organization_name };
        })
        .filter((m): m is { lat: number; lng: number; label: string } => m !== null),
    [branches],
  );

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

  return (
    <View style={styles.container}>
      <NeedMapView
        needs={mapNeeds}
        organizations={mapOrgs}
        volunteers={mapVols}
        currentLocation={location}
        branchMarkers={isOrgOwner ? validBranchMarkers : []}
        showHeatmap={showHeatmap}
        onNeedPress={(needId) => nav.navigate("NeedDetail", { needId })}
        labels={mapLabels}
        translateText={translateText}
        translateAddress={translateAddress}
        height={Dimensions.get("window").height}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});
