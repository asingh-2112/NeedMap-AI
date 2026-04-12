import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CampaignDetailScreen from './screens/CampaignDetailScreen';
// Import your screens
import ProfileScreen from './screens/ProfileScreen';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import FoodScreen from './screens/FoodScreen';
import VolunteerScreen from './screens/VolunteerScreen';
import BooksScreen from './screens/BooksScreen';
import HealthScreen from './screens/HealthScreen';
import StoryDetailScreen from './screens/StoryDetailScreen';
import RegisterScreen from './screens/RegisterScreen';
const Stack = createNativeStackNavigator();

const StackNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
<Stack.Screen name="Home" component={HomeScreen} options={{headerShown: false}} />
      <Stack.Screen name="Food" component={FoodScreen} />
      <Stack.Screen name="Volunteer" component={VolunteerScreen} />
      <Stack.Screen name="Books" component={BooksScreen} />
      <Stack.Screen name="Health" component={HealthScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen 
  name="StoryDetail" 
  component={StoryDetailScreen} 
  options={{ headerShown: false }} 
/>
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default StackNavigator;