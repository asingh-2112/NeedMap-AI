import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Home: undefined;
  Needs: undefined;
  Volunteers: undefined;
  Organizations: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Signup: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Schemes: undefined;
  Stories: undefined;
  Camps: undefined;
  Assignments: undefined;
  StoryDetail: { storyId: string };
};

export type TabParamList = MainTabParamList;
