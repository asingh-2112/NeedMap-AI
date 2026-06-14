import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AccessibilityProvider } from "./src/context/AccessibilityContext";
import { AuthProvider } from "./src/context/AuthContext";
import { LanguageProvider } from "./src/context/LanguageContext";
import { RealtimeProvider } from "./src/context/RealtimeContext";
import { ThemeModeProvider } from "./src/context/ThemeModeContext";
import { ToastProvider } from "./src/context/ToastContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <AccessibilityProvider>
        <LanguageProvider>
          <ThemeModeProvider>
            <AuthProvider>
              <ToastProvider>
                <RealtimeProvider>
                  <StatusBar style="light" />
                  <AppNavigator />
                </RealtimeProvider>
              </ToastProvider>
            </AuthProvider>
          </ThemeModeProvider>
        </LanguageProvider>
      </AccessibilityProvider>
    </SafeAreaProvider>
  );
}
