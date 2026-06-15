import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform } from "react-native";

type TextSize = "normal" | "large" | "extraLarge";

type AccessibilitySettings = {
  textSize: TextSize;
  highContrast: boolean;
  reduceMotion: boolean;
  screenReaderOptimized: boolean;
  largeTouchTargets: boolean;
  useDeviceSettings: boolean;
};

type DeviceAccessibilityState = {
  screenReaderEnabled: boolean;
  reduceMotionEnabled: boolean;
  boldTextEnabled: boolean;
  invertColorsEnabled: boolean;
  reduceTransparencyEnabled: boolean;
  highTextContrastEnabled: boolean;
};

type AccessibilityContextShape = AccessibilitySettings & {
  textScale: number;
  touchTarget: number;
  device: DeviceAccessibilityState;
  setTextSize: (textSize: TextSize) => void;
  setHighContrast: (enabled: boolean) => void;
  setReduceMotion: (enabled: boolean) => void;
  setScreenReaderOptimized: (enabled: boolean) => void;
  setLargeTouchTargets: (enabled: boolean) => void;
  setUseDeviceSettings: (enabled: boolean) => void;
  announceForAccessibility: (message: string) => void;
  resetAccessibility: () => void;
};

const STORAGE_KEY = "needmap_accessibility_settings";
const RUNTIME_STYLE_ID = "needmap_accessibility_runtime_styles";
const STORAGE_VERSION = 2;

const defaultSettings: AccessibilitySettings = {
  textSize: "normal",
  highContrast: false,
  reduceMotion: false,
  screenReaderOptimized: false,
  largeTouchTargets: false,
  useDeviceSettings: false,
};

const defaultDeviceState: DeviceAccessibilityState = {
  screenReaderEnabled: false,
  reduceMotionEnabled: false,
  boldTextEnabled: false,
  invertColorsEnabled: false,
  reduceTransparencyEnabled: false,
  highTextContrastEnabled: false,
};

const textScaleBySize: Record<TextSize, number> = {
  normal: 1,
  large: 1.28,
  extraLarge: 1.58,
};

const readStoredSettings = (): AccessibilitySettings => {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored) as Partial<AccessibilitySettings> & { version?: number };
    if (parsed.version !== STORAGE_VERSION) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...defaultSettings, version: STORAGE_VERSION }));
      return defaultSettings;
    }
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
};

const AccessibilityContext = createContext<AccessibilityContextShape | undefined>(undefined);

const removeAccessibilitySubscription = (subscription: { remove?: () => void } | undefined) => {
  if (subscription?.remove) subscription.remove();
};

const getEffectiveSettings = (settings: AccessibilitySettings, device: DeviceAccessibilityState): AccessibilitySettings => {
  if (!settings.useDeviceSettings) return settings;

  const deviceHighContrast = device.highTextContrastEnabled || device.invertColorsEnabled || device.reduceTransparencyEnabled;
  return {
    ...settings,
    highContrast: settings.highContrast || deviceHighContrast,
    reduceMotion: settings.reduceMotion || device.reduceMotionEnabled,
    screenReaderOptimized: settings.screenReaderOptimized || device.screenReaderEnabled,
    largeTouchTargets: settings.largeTouchTargets || device.screenReaderEnabled,
  };
};

export const AccessibilityProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [device, setDevice] = useState<DeviceAccessibilityState>(defaultDeviceState);
  const effectiveSettings = useMemo(() => getEffectiveSettings(settings, device), [device, settings]);
  const textScale = textScaleBySize[effectiveSettings.textSize];

  useEffect(() => {
    setSettings(readStoredSettings());
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncDeviceState = async () => {
      const [screenReaderEnabled, reduceMotionEnabled, boldTextEnabled, invertColorsEnabled, reduceTransparencyEnabled, highTextContrastEnabled] = await Promise.all([
        AccessibilityInfo.isScreenReaderEnabled().catch(() => false),
        AccessibilityInfo.isReduceMotionEnabled().catch(() => false),
        Platform.OS === "ios" && AccessibilityInfo.isBoldTextEnabled ? AccessibilityInfo.isBoldTextEnabled().catch(() => false) : Promise.resolve(false),
        Platform.OS === "ios" && AccessibilityInfo.isInvertColorsEnabled ? AccessibilityInfo.isInvertColorsEnabled().catch(() => false) : Promise.resolve(false),
        Platform.OS === "ios" && AccessibilityInfo.isReduceTransparencyEnabled ? AccessibilityInfo.isReduceTransparencyEnabled().catch(() => false) : Promise.resolve(false),
        Platform.OS === "android" && AccessibilityInfo.isHighTextContrastEnabled ? AccessibilityInfo.isHighTextContrastEnabled().catch(() => false) : Promise.resolve(false),
      ]);

      if (!mounted) return;
      setDevice({ screenReaderEnabled, reduceMotionEnabled, boldTextEnabled, invertColorsEnabled, reduceTransparencyEnabled, highTextContrastEnabled });
    };

    void syncDeviceState();

    const subscriptions = [
      AccessibilityInfo.addEventListener("screenReaderChanged", (screenReaderEnabled) => setDevice((current) => ({ ...current, screenReaderEnabled }))),
      AccessibilityInfo.addEventListener("reduceMotionChanged", (reduceMotionEnabled) => setDevice((current) => ({ ...current, reduceMotionEnabled }))),
      AccessibilityInfo.addEventListener("boldTextChanged" as any, (boldTextEnabled: boolean) => setDevice((current) => ({ ...current, boldTextEnabled }))),
      AccessibilityInfo.addEventListener("invertColorsChanged" as any, (invertColorsEnabled: boolean) => setDevice((current) => ({ ...current, invertColorsEnabled }))),
      AccessibilityInfo.addEventListener("reduceTransparencyChanged" as any, (reduceTransparencyEnabled: boolean) => setDevice((current) => ({ ...current, reduceTransparencyEnabled }))),
      AccessibilityInfo.addEventListener("highTextContrastChanged" as any, (highTextContrastEnabled: boolean) => setDevice((current) => ({ ...current, highTextContrastEnabled }))),
    ];

    return () => {
      mounted = false;
      subscriptions.forEach(removeAccessibilitySubscription);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    let style = document.getElementById(RUNTIME_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = RUNTIME_STYLE_ID;
      document.head.appendChild(style);
    }

    const shouldScaleText = textScale > 1;
    const motionRules = effectiveSettings.reduceMotion
      ? `
        *, *::before, *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 0.001ms !important;
        }
      `
      : "";

    if (!shouldScaleText && !effectiveSettings.reduceMotion) {
      style.remove();
      return;
    }

    const textScaleRules = shouldScaleText
      ? `
        :root {
          --needmap-text-scale: ${textScale};
        }

        [data-testid="root"] span,
        [data-testid="root"] div[dir="auto"],
        #root span,
        #root div[dir="auto"] {
          font-size: calc(1em * var(--needmap-text-scale)) !important;
          max-width: 100%;
          overflow-wrap: anywhere;
          white-space: normal;
          word-break: break-word;
        }
      `
      : "";

    style.textContent = `
      ${textScaleRules}
      ${motionRules}
    `;
  }, [effectiveSettings.reduceMotion, textScale]);

  const updateSettings = (next: AccessibilitySettings) => {
    setSettings(next);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, version: STORAGE_VERSION }));
    }
  };

  const value = useMemo<AccessibilityContextShape>(() => {
    return {
      ...effectiveSettings,
      textScale,
      touchTarget: effectiveSettings.largeTouchTargets ? 48 : 40,
      device,
      setTextSize: (textSize) => updateSettings({ ...settings, textSize }),
      setHighContrast: (highContrast) => updateSettings({ ...settings, highContrast }),
      setReduceMotion: (reduceMotion) => updateSettings({ ...settings, reduceMotion }),
      setScreenReaderOptimized: (screenReaderOptimized) => updateSettings({ ...settings, screenReaderOptimized }),
      setLargeTouchTargets: (largeTouchTargets) => updateSettings({ ...settings, largeTouchTargets }),
      setUseDeviceSettings: (useDeviceSettings) => updateSettings({ ...settings, useDeviceSettings }),
      announceForAccessibility: (message) => AccessibilityInfo.announceForAccessibility(message),
      resetAccessibility: () => updateSettings(defaultSettings),
    };
  }, [device, effectiveSettings, settings, textScale]);

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