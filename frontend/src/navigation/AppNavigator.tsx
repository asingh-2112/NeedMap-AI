import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useAuth } from "../context/AuthContext";
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

const MainTabs = ({ role }: { role?: string }) => {
  const { mode, toggleMode, theme } = useThemeMode();
  const canToggleTheme = role === "owner";

  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.nav.card },
        headerTintColor: theme.nav.text,
        headerTitleStyle: { fontWeight: "700", fontSize: 18 },
        headerShadowVisible: false,
        headerRight: canToggleTheme
          ? () => (
              <Pressable
                onPress={toggleMode}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(24,53,112,0.1)",
                  borderWidth: 1,
                  borderColor: theme.nav.border,
                }}
              >
                <Text style={{ fontSize: 16 }}>{mode === "dark" ? "☀️" : "🌙"}</Text>
              </Pressable>
            )
          : undefined,
        tabBarStyle: {
          backgroundColor: theme.nav.card,
          borderTopColor: theme.nav.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: theme.nav.primary,
        tabBarInactiveTintColor: theme.nav.tabInactive,
        tabBarLabelStyle: { fontWeight: "600", fontSize: 11 },
      }}
    >
    <Tabs.Screen name="Home" component={HomeScreen} />
    <Tabs.Screen name="Needs" component={NeedsScreen} />
    {role === "volunteer" ? <Tabs.Screen name="Assignments" component={AssignmentsScreen} /> : null}
    {role === "owner" || role === "admin" ? <Tabs.Screen name="Organizations" component={OrganizationsScreen} /> : null}
    <Tabs.Screen name="Statistics" component={StatisticsScreen} />
    <Tabs.Screen name="Feeds" component={FeedsScreen} />
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

  const ownerHeaderRight = user?.role === "owner"
    ? () => (
        <Pressable
          onPress={toggleMode}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(24,53,112,0.1)",
            borderWidth: 1,
            borderColor: theme.nav.border,
          }}
        >
          <Text style={{ fontSize: 16 }}>{mode === "dark" ? "☀️" : "🌙"}</Text>
        </Pressable>
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
            <RootStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true, headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: theme.nav.text, headerTitleStyle: { fontWeight: "700" }, headerRight: ownerHeaderRight }} />
            <RootStack.Screen name="Organizations" component={OrganizationsScreen} options={{ headerShown: true, headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: theme.nav.text, headerTitleStyle: { fontWeight: "700" }, headerRight: ownerHeaderRight }} />
            <RootStack.Screen name="Schemes" component={SchemesScreen} options={{ headerShown: true, headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: theme.nav.text, headerTitleStyle: { fontWeight: "700" }, headerRight: ownerHeaderRight }} />
            <RootStack.Screen name="Stories" component={StoriesScreen} options={{ headerShown: true, headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: theme.nav.text, headerTitleStyle: { fontWeight: "700" }, headerRight: ownerHeaderRight }} />
            <RootStack.Screen name="Camps" component={CampsScreen} options={{ headerShown: true, headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: theme.nav.text, headerTitleStyle: { fontWeight: "700" }, headerRight: ownerHeaderRight }} />
            <RootStack.Screen name="Assignments" component={AssignmentsScreen} options={{ headerShown: true, headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: theme.nav.text, headerTitleStyle: { fontWeight: "700" }, headerRight: ownerHeaderRight }} />
            <RootStack.Screen name="StoryDetail" component={StoryDetailScreen} options={{ headerShown: true, title: "Story Detail", headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: theme.nav.text, headerTitleStyle: { fontWeight: "700" }, headerRight: ownerHeaderRight }} />
            <RootStack.Screen name="NeedDetail" component={NeedDetailScreen} options={{ headerShown: false }} />
            <RootStack.Screen name="BranchDetail" component={BranchDetailScreen} options={{ headerShown: true, title: "Branch Details", headerStyle: { backgroundColor: theme.nav.card }, headerTintColor: theme.nav.text, headerTitleStyle: { fontWeight: "700" }, headerRight: ownerHeaderRight }} />
          </>
        ) : (
          <RootStack.Screen name="Landing" component={AuthFlow} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
