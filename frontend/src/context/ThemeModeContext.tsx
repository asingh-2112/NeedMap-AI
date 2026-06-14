import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";

type ThemeMode = "dark" | "light";

type ThemePalette = {
  mode: ThemeMode;
  gradients: {
    page: [string, string, string];
  };
  nav: {
    background: string;
    card: string;
    text: string;
    primary: string;
    border: string;
    tabInactive: string;
  };
};

type ThemeModeContextShape = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  theme: ThemePalette;
};

const STORAGE_KEY = "needmap_theme_mode";

const palettes: Record<ThemeMode, ThemePalette> = {
  dark: {
    mode: "dark",
    gradients: {
      page: ["#0F0C29", "#302B63", "#24243E"],
    },
    nav: {
      background: "#0F0C29",
      card: "#1A1640",
      text: "#FFFFFF",
      primary: "#667EEA",
      border: "rgba(255,255,255,0.08)",
      tabInactive: "rgba(255,255,255,0.4)",
    },
  },
  light: {
    mode: "light",
    gradients: {
      page: ["#F4F7FF", "#EAF0FF", "#E6F4FF"],
    },
    nav: {
      background: "#EEF3FF",
      card: "#FFFFFF",
      text: "#1E2A4A",
      primary: "#516DEB",
      border: "rgba(24,53,112,0.14)",
      tabInactive: "rgba(30,42,74,0.5)",
    },
  },
};

const ThemeModeContext = createContext<ThemeModeContextShape | undefined>(undefined);

export const ThemeModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      setModeState(stored);
    }
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    }
  };

  const toggleMode = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode,
      theme: palettes[mode],
    }),
    [mode],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
};

export const useThemeMode = () => {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be used inside ThemeModeProvider");
  }
  return ctx;
};
