import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Home: undefined;
  Needs: undefined;
  Statistics: undefined;
  Feeds: undefined;
  Assignments: undefined;
  Organizations: undefined;
};

export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Signup: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Profile: undefined;
  Organizations: undefined;
  Schemes: undefined;
  Stories: undefined;
  Camps: undefined;
  Assignments: undefined;
  StoryDetail: { storyId: string };
  NeedDetail: { needId: number };
  BranchDetail: { branchId: number };
  FullMap: undefined;
};

export type TabParamList = MainTabParamList;
