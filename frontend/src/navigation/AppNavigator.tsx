import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";
import { LandingScreen } from "../screens/auth/LandingScreen";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";
import { OrganizationSignupScreen } from "../screens/auth/OrganizationSignupScreen";
import { HomeScreen } from "../screens/main/HomeScreen";
import { NeedsScreen } from "../screens/main/NeedsScreen";
import { VolunteersScreen } from "../screens/main/VolunteersScreen";
import { OrganizationsScreen } from "../screens/main/OrganizationsScreen";
import { ProfileScreen } from "../screens/main/ProfileScreen";
import { SchemesScreen } from "../screens/main/SchemesScreen";
import { StoriesScreen } from "../screens/main/StoriesScreen";
import { CampsScreen } from "../screens/main/CampsScreen";
import { AssignmentsScreen } from "../screens/main/AssignmentsScreen";
import { StoryDetailScreen } from "../screens/main/StoryDetailScreen";
import type { RootStackParamList, TabParamList } from "./types";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    primary: colors.accent,
    border: colors.border,
  },
};

const MainTabs = () => (
  <Tabs.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.card },
      headerTintColor: colors.textStrong,
      headerShadowVisible: false,
      tabBarStyle: {
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        height: 62,
        paddingBottom: 6,
        paddingTop: 6,
      },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted,
    }}
  >
    <Tabs.Screen name="Home" component={HomeScreen} />
    <Tabs.Screen name="Needs" component={NeedsScreen} />
    <Tabs.Screen name="Volunteers" component={VolunteersScreen} />
    <Tabs.Screen name="Organizations" component={OrganizationsScreen} />
    <Tabs.Screen name="Profile" component={ProfileScreen} />
  </Tabs.Navigator>
);

const AuthFlow = () => {
  const [screen, setScreen] = useState<"landing" | "login" | "signup" | "orgSignup">("landing");

  if (screen === "login") {
    return <LoginScreen onBack={() => setScreen("landing")} />;
  }

  if (screen === "signup") {
    return <SignupScreen onBack={() => setScreen("landing")} />;
  }

  if (screen === "orgSignup") {
    return <OrganizationSignupScreen onBack={() => setScreen("landing")} />;
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

  return (
    <NavigationContainer theme={appTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen name="Schemes" component={SchemesScreen} options={{ headerShown: true }} />
            <RootStack.Screen name="Stories" component={StoriesScreen} options={{ headerShown: true }} />
            <RootStack.Screen name="Camps" component={CampsScreen} options={{ headerShown: true }} />
            <RootStack.Screen name="Assignments" component={AssignmentsScreen} options={{ headerShown: true }} />
            <RootStack.Screen name="StoryDetail" component={StoryDetailScreen} options={{ headerShown: true, title: "Story Detail" }} />
          </>
        ) : (
          <RootStack.Screen name="Landing" component={AuthFlow} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
