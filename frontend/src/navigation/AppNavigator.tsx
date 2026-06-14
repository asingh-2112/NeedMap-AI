import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAccessibility } from "../context/AccessibilityContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useThemeMode } from "../context/ThemeModeContext";
import { LandingScreen } from "../screens/auth/LandingScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";
import { OrganizationSignupScreen } from "../screens/auth/OrganizationSignupScreen";
import { HomeScreen } from "../screens/main/HomeScreen";
import { NeedsScreen } from "../screens/main/NeedsScreen";
import { NeedDetailScreen } from "../screens/main/NeedDetailScreen";
import { OrganizationsScreen } from "../screens/main/OrganizationsScreen";
import { ProfileScreen } from "../screens/main/ProfileScreen";
import { StatisticsScreen } from "../screens/main/StatisticsScreen";
import { FeedsScreen } from "../screens/main/FeedsScreen";
import { SchemesScreen } from "../screens/main/SchemesScreen";
import { StoriesScreen } from "../screens/main/StoriesScreen";
import { CampsScreen } from "../screens/main/CampsScreen";
import { AssignmentsScreen } from "../screens/main/AssignmentsScreen";
import { StoryDetailScreen } from "../screens/main/StoryDetailScreen";
import { BranchDetailScreen } from "../screens/main/BranchDetailScreen";
import type { RootStackParamList, TabParamList } from "./types";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const LanguageHeaderPicker = ({ borderColor }: { borderColor: string }) => {
  const { highContrast, screenReaderOptimized, textScale, touchTarget } = useAccessibility();
  const { language, languageOptions, setLanguage, t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const selected = languageOptions.find((option) => option.code === language) ?? languageOptions[0];

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={screenReaderOptimized ? t("Language") : undefined}
        style={[styles.languageButton, { minHeight: touchTarget, borderColor }]}
      >
        <Text style={[styles.languageCode, { fontSize: 12 * textScale, lineHeight: 16 * textScale }]}>{selected.code.toUpperCase()}</Text>
        <Text style={[styles.languageChevron, { fontSize: 10 * textScale }]}>▾</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.languageOverlay} onPress={() => setVisible(false)}>
          <View style={[styles.languageMenu, highContrast ? styles.highContrastMenu : null]}>
            <Text style={[styles.languageMenuTitle, { fontSize: 14 * textScale, lineHeight: 19 * textScale }]}>{t("Language")}</Text>
            {languageOptions.map((option) => {
              const isSelected = option.code === language;
              return (
                <Pressable
                  key={option.code}
                  style={[styles.languageOption, isSelected ? styles.languageOptionActive : null]}
                  onPress={() => {
                    setLanguage(option.code);
                    setVisible(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.languageOptionText, { fontSize: 13 * textScale, lineHeight: 18 * textScale }]}>{option.nativeLabel}</Text>
                  <Text style={[styles.languageOptionMeta, { fontSize: 11 * textScale, lineHeight: 15 * textScale }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const ThemeHeaderToggle = ({ mode, onPress, borderColor }: { mode: "dark" | "light"; onPress: () => void; borderColor: string }) => {
  const isDark = mode === "dark";
  const { textScale, touchTarget, screenReaderOptimized } = useAccessibility();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={screenReaderOptimized ? `Switch to ${isDark ? "light" : "dark"} theme` : undefined}
      style={{
        marginRight: 16,
        width: touchTarget,
        height: touchTarget,
        borderRadius: touchTarget / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(24,53,112,0.11)",
        borderWidth: 1,
        borderColor,
        shadowColor: isDark ? "#FBBF24" : "#516DEB",
        shadowOpacity: 0.24,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      <Text style={{ color: isDark ? "#FBBF24" : "#516DEB", fontSize: 18 * textScale, fontWeight: "900", lineHeight: 22 * textScale }}>
        {isDark ? "☀" : "☾"}
      </Text>
    </Pressable>
  );
};

const MainTabs = ({ role }: { role?: string }) => {
  const { mode, toggleMode, theme } = useThemeMode();
  const { highContrast, textScale, touchTarget } = useAccessibility();
  const { t } = useLanguage();
  const canToggleTheme = role === "owner" || role === "admin" || role === "volunteer";

  const headerRight = canToggleTheme
    ? () => (
      <View style={styles.headerActions}>
        <LanguageHeaderPicker borderColor={theme.nav.border} />
        <ThemeHeaderToggle mode={mode} onPress={toggleMode} borderColor={theme.nav.border} />
      </View>
    )
    : undefined;

  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.nav.card },
        headerTintColor: highContrast ? "#FFFFFF" : theme.nav.text,
        headerTitleStyle: { fontWeight: "900", fontSize: 18 * textScale },
        headerShadowVisible: false,
        headerRight,
        tabBarStyle: {
          backgroundColor: theme.nav.card,
          borderTopColor: theme.nav.border,
          borderTopWidth: highContrast ? 2 : 1,
          height: Math.max(64, touchTarget + 22),
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: highContrast ? "#FFFFFF" : theme.nav.primary,
        tabBarInactiveTintColor: highContrast ? "#D1D5DB" : theme.nav.tabInactive,
        tabBarLabelStyle: { fontWeight: "800", fontSize: 11 * textScale },
      }}
    >
    <Tabs.Screen name="Home" component={HomeScreen} options={{ title: t("Home"), tabBarLabel: t("Home") }} />
    <Tabs.Screen name="Needs" component={NeedsScreen} options={{ title: t("Needs"), tabBarLabel: t("Needs") }} />
    {role === "volunteer" ? <Tabs.Screen name="Assignments" component={AssignmentsScreen} options={{ title: t("Assignments"), tabBarLabel: t("Assignments") }} /> : null}
    {role === "owner" ? <Tabs.Screen name="Organizations" component={OrganizationsScreen} options={{ title: t("Organizations"), tabBarLabel: t("Organizations") }} /> : null}
    <Tabs.Screen name="Statistics" component={StatisticsScreen} options={{ title: t("Statistics"), tabBarLabel: t("Statistics") }} />
    <Tabs.Screen name="Feeds" component={FeedsScreen} options={{ title: t("Feeds"), tabBarLabel: t("Feeds") }} />
    </Tabs.Navigator>
  );
};

const AuthFlow = () => {
  const [screen, setScreen] = useState<"landing" | "login" | "signup" | "orgSignup">("login");

  if (screen === "login") {
    return <LoginScreen onBack={() => setScreen("landing")} onSignup={() => setScreen("signup")} />;
  }

  if (screen === "signup") {
    return <SignupScreen onBack={() => setScreen("login")} onLogin={() => setScreen("login")} />;
  }

  if (screen === "orgSignup") {
    return <OrganizationSignupScreen onBack={() => setScreen("login")} />;
  }

  return (
    <LandingScreen
      onLogin={() => setScreen("login")}
      onVolunteerSignup={() => setScreen("signup")}
      onOrganizationSignup={() => setScreen("orgSignup")}
    />
  );
};

export const AppNavigator = () => {
  const { user } = useAuth();
  const { mode, toggleMode, theme } = useThemeMode();
  const { highContrast, textScale } = useAccessibility();
  const { t } = useLanguage();

  const appTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: theme.nav.background,
      card: theme.nav.card,
      text: theme.nav.text,
      primary: theme.nav.primary,
      border: theme.nav.border,
    },
  };

  const canToggleTheme = user?.role === "owner" || user?.role === "admin" || user?.role === "volunteer";
  const headerRight = canToggleTheme
    ? () => (
      <View style={styles.headerActions}>
        <LanguageHeaderPicker borderColor={theme.nav.border} />
        <ThemeHeaderToggle mode={mode} onPress={toggleMode} borderColor={theme.nav.border} />
      </View>
    )
    : undefined;

  return (
    <NavigationContainer theme={appTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <RootStack.Screen name="MainTabs">
              {() => <MainTabs role={user.role} />}
            </RootStack.Screen>
            <RootStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, title: t("Profile"), headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: highContrast ? "#FFFFFF" : theme.nav.text, headerTitleStyle: { fontWeight: "900", fontSize: 18 * textScale }, headerRight }} />
            <RootStack.Screen name="Organizations" component={OrganizationsScreen} options={{ headerShown: true, title: t("Organizations"), headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: highContrast ? "#FFFFFF" : theme.nav.text, headerTitleStyle: { fontWeight: "900", fontSize: 18 * textScale }, headerRight }} />
            <RootStack.Screen name="Schemes" component={SchemesScreen} options={{ headerShown: true, title: t("Schemes"), headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: highContrast ? "#FFFFFF" : theme.nav.text, headerTitleStyle: { fontWeight: "900", fontSize: 18 * textScale }, headerRight }} />
            <RootStack.Screen name="Stories" component={StoriesScreen} options={{ headerShown: true, title: t("Stories"), headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: highContrast ? "#FFFFFF" : theme.nav.text, headerTitleStyle: { fontWeight: "900", fontSize: 18 * textScale }, headerRight }} />
            <RootStack.Screen name="Camps" component={CampsScreen} options={{ headerShown: true, title: t("Camps"), headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: highContrast ? "#FFFFFF" : theme.nav.text, headerTitleStyle: { fontWeight: "900", fontSize: 18 * textScale }, headerRight }} />
            <RootStack.Screen name="Assignments" component={AssignmentsScreen} options={{ headerShown: true, title: t("Assignments"), headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: highContrast ? "#FFFFFF" : theme.nav.text, headerTitleStyle: { fontWeight: "900", fontSize: 18 * textScale }, headerRight }} />
            <RootStack.Screen name="StoryDetail" component={StoryDetailScreen} options={{ headerShown: true, title: t("Story Detail"), headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: highContrast ? "#FFFFFF" : theme.nav.text, headerTitleStyle: { fontWeight: "900", fontSize: 18 * textScale }, headerRight }} />
            <RootStack.Screen name="NeedDetail" component={NeedDetailScreen} options={{ headerShown: false }} />
            <RootStack.Screen name="BranchDetail" component={BranchDetailScreen} options={{ headerShown: true, title: t("Branch Details"), headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: highContrast ? "#FFFFFF" : theme.nav.text, headerTitleStyle: { fontWeight: "900", fontSize: 18 * textScale }, headerRight }} />
          </>
        ) : (
          <RootStack.Screen name="Landing" component={AuthFlow} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8, marginRight: 8 },
  languageButton: {
    minWidth: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
  },
  languageCode: { color: "#FFFFFF", fontWeight: "900" },
  languageChevron: { color: "#D1D5DB", fontWeight: "900" },
  languageOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "flex-end",
    paddingTop: 66,
    paddingRight: 14,
  },
  languageMenu: {
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(11,18,32,0.98)",
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  highContrastMenu: { borderColor: "#FFFFFF", borderWidth: 2, backgroundColor: "#000000" },
  languageMenuTitle: { color: "#FFFFFF", fontWeight: "900", marginBottom: 8 },
  languageOption: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "transparent",
  },
  languageOptionActive: { backgroundColor: "rgba(102,126,234,0.22)", borderColor: "rgba(102,126,234,0.45)" },
  languageOptionText: { color: "#FFFFFF", fontWeight: "900" },
  languageOptionMeta: { color: "#A7B0C0", fontWeight: "700", marginTop: 2 },
});
