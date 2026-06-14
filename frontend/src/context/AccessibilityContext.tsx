import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";

type TextSize = "normal" | "large" | "extraLarge";

type AccessibilitySettings = {
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  screenReaderOptimized: boolean;
  largeTouchTargets: boolean;
};

type AccessibilityContextShape = AccessibilitySettings & {
  textScale: number;
  touchTarget: number;
  setTextSize: (textSize: TextSize) => void;
  setHighContrast: (enabled: boolean) => void;
  setReduceMotion: (enabled: boolean) => void;
  setScreenReaderOptimized: (enabled: boolean) => void;
  setLargeTouchTargets: (enabled: boolean) => void;
  resetAccessibility: () => void;
};

const STORAGE_KEY = "needmap_accessibility_settings";

const defaultSettings: AccessibilitySettings = {
  textSize: "normal",
  highContrast: false,
  reduceMotion: false,
  screenReaderOptimized: true,
  largeTouchTargets: true,
};

const textScaleBySize: Record<TextSize, number> = {
  normal: 1,
  large: 1.14,
  extraLarge: 1.28,
};

const readStoredSettings = (): AccessibilitySettings => {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored) as Partial<AccessibilitySettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
};

const AccessibilityContext = createContext<AccessibilityContextShape | undefined>(undefined);

export const AccessibilityProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);

  useEffect(() => {
    setSettings(readStoredSettings());
  }, []);

  const updateSettings = (next: AccessibilitySettings) => {
    setSettings(next);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const value = useMemo<AccessibilityContextShape>(() => ({
    ...settings,
    textScale: textScaleBySize[settings.textSize],
    touchTarget: settings.largeTouchTargets ? 48 : 40,
    setTextSize: (textSize) => updateSettings({ ...settings, textSize }),
    setHighContrast: (highContrast) => updateSettings({ ...settings, highContrast }),
    setReduceMotion: (reduceMotion) => updateSettings({ ...settings, reduceMotion }),
    setScreenReaderOptimized: (screenReaderOptimized) => updateSettings({ ...settings, screenReaderOptimized }),
    setLargeTouchTargets: (largeTouchTargets) => updateSettings({ ...settings, largeTouchTargets }),
    resetAccessibility: () => updateSettings(defaultSettings),
  }), [settings]);

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
};

export const useAccessibility = () => {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error("useAccessibility must be used inside AccessibilityProvider");
  }
  return ctx;
};

export type { TextSize };