import * as Location from "expo-location";
import { Platform } from "react-native";

export type LiveLocation = {
  latitude: number;
  longitude: number;
  address: string;
};

const compact = (parts: Array<string | undefined | null>) =>
  parts
    .map((p) => (p || "").trim())
    .filter(Boolean);

const uniqueCaseInsensitive = (parts: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const part of parts) {
    const key = part.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(part);
    }
  }

  return out;
};

export const getLiveLocation = async (): Promise<LiveLocation> => {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Location permission denied.");
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const latitude = pos.coords.latitude;
  const longitude = pos.coords.longitude;

  if (Platform.OS === "web") {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${latitude}&lon=${longitude}`
    );
    const data = await r.json();
    const a = data?.address ?? {};

    const area =
      a.suburb ||
      a.neighbourhood ||
      a.residential ||
      a.hamlet ||
      a.village ||
      a.town ||
      a.city_district ||
      "";

    const city =
      a.city ||
      a.town ||
      a.village ||
      a.county ||
      a.state_district ||
      "";

    const state = a.state || "";
    const pincode = a.postcode || "";
    const country = a.country || "";

    const parts = uniqueCaseInsensitive(compact([area, city, state, pincode, country]));

    return {
      latitude,
      longitude,
      address: parts.join(", ") || "Address unavailable",
    };
  }

  const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
  const g = geo[0];

  const area =
    g?.district ||
    g?.subregion ||
    g?.name ||
    g?.street ||
    "";

  const city =
    g?.city ||
    g?.subregion ||
    "";

  const state = g?.region || "";
  const pincode = g?.postalCode || "";
  const country = g?.country || "";

  const parts = uniqueCaseInsensitive(compact([area, city, state, pincode, country]));

  return {
    latitude,
    longitude,
    address: parts.join(", ") || "Address unavailable",
  };
};
