import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { RealtimeProvider } from "./src/context/RealtimeContext";
import { ThemeModeProvider } from "./src/context/ThemeModeContext";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeModeProvider>
        <AuthProvider>
          <RealtimeProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </RealtimeProvider>
        </AuthProvider>
      </ThemeModeProvider>
    </SafeAreaProvider>
  );
}
