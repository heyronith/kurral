import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/Home/HomeScreen';
import SearchScreen from '../screens/Search/SearchScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import BookmarksScreen from '../screens/Bookmarks/BookmarksScreen';
import PostDetailScreen from '../screens/Post/PostDetailScreen';
import TopicDetailScreen from '../screens/Topic/TopicDetailScreen';
import NewsDetailScreen from '../screens/News/NewsDetailScreen';
import ForYouControlsScreen from '../screens/Settings/ForYouControlsScreen';
import NotificationPreferencesScreen from '../screens/Settings/NotificationPreferencesScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import { useTheme } from '../hooks/useTheme';

// Stack param lists for each tab
export type HomeStackParamList = {
  HomeMain: undefined;
  Search: undefined;
  PostDetail: { postId: string };
  TopicDetail: { topicName: string };
  NewsDetail: { newsId: string };
  ForYouControls: undefined;
  Settings: undefined;
  Profile: { userId?: string } | undefined;
  Bookmarks: undefined;
  Dashboard: undefined;
};

export type NotificationsStackParamList = {
  NotificationsMain: undefined;
  NotificationPreferences: undefined;
  PostDetail: { postId: string };
};

export type BookmarksStackParamList = {
  BookmarksMain: undefined;
};

export type SearchStackParamList = {
  SearchMain: undefined;
  PostDetail: { postId: string };
  TopicDetail: { topicName: string };
  NewsDetail: { newsId: string };
  Profile: { userId?: string } | undefined;
};

export type ProfileStackParamList = {
  ProfileMain: { userId?: string } | undefined;
  Dashboard: undefined;
};

export type AppTabParamList = {
  HomeStack: undefined;
  NotificationsStack: undefined;
  SearchStack: undefined;
};

const Tab = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const NotificationsStack = createNativeStackNavigator<NotificationsStackParamList>();
const BookmarksStack = createNativeStackNavigator<BookmarksStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

// Home Stack Navigator (includes Search, PostDetail, TopicDetail, NewsDetail, Profile)
const HomeStackNavigator = () => (
  <HomeStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <HomeStack.Screen name="HomeMain" component={HomeScreen} />
    <HomeStack.Screen name="Search" component={SearchScreen} />
    <HomeStack.Screen name="PostDetail" component={PostDetailScreen} />
    <HomeStack.Screen name="TopicDetail" component={TopicDetailScreen} />
    <HomeStack.Screen name="NewsDetail" component={NewsDetailScreen} />
    <HomeStack.Screen name="ForYouControls" component={ForYouControlsScreen} />
    <HomeStack.Screen name="Settings" component={SettingsScreen} />
    <HomeStack.Screen name="Profile" component={ProfileScreen} />
    <HomeStack.Screen name="Bookmarks" component={BookmarksScreen} />
    <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
  </HomeStack.Navigator>
);

// Notifications Stack Navigator
const NotificationsStackNavigator = () => (
  <NotificationsStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <NotificationsStack.Screen name="NotificationsMain" component={NotificationsScreen} />
    <NotificationsStack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
    <NotificationsStack.Screen name="PostDetail" component={PostDetailScreen} />
  </NotificationsStack.Navigator>
);

// Bookmarks Stack Navigator
const BookmarksStackNavigator = () => (
  <BookmarksStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <BookmarksStack.Screen name="BookmarksMain" component={BookmarksScreen} />
  </BookmarksStack.Navigator>
);

// Search Stack Navigator
const SearchStackNavigator = () => (
  <SearchStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <SearchStack.Screen name="SearchMain" component={SearchScreen} />
    <SearchStack.Screen name="PostDetail" component={PostDetailScreen} />
    <SearchStack.Screen name="TopicDetail" component={TopicDetailScreen} />
    <SearchStack.Screen name="NewsDetail" component={NewsDetailScreen} />
    <SearchStack.Screen name="Profile" component={ProfileScreen} />
  </SearchStack.Navigator>
);

// Profile Stack Navigator
const ProfileStackNavigator = () => (
  <ProfileStack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
    <ProfileStack.Screen name="Dashboard" component={DashboardScreen} />
  </ProfileStack.Navigator>
);

// Main Tab Navigator
const MainTabs = () => {
  const { colors } = useTheme();
  
  return (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      tabBarShowLabel: false,
      tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
        borderTopWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
        height: 60,
        paddingBottom: 8,
        paddingTop: 8,
      },
      tabBarIcon: ({ color, size, focused }) => {
        let iconName: keyof typeof Ionicons.glyphMap = 'home';

        if (route.name === 'HomeStack') {
          iconName = focused ? 'home' : 'home-outline';
        } else if (route.name === 'NotificationsStack') {
          iconName = focused ? 'notifications' : 'notifications-outline';
        } else if (route.name === 'SearchStack') {
          iconName = focused ? 'search' : 'search-outline';
        }

        return (
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={iconName}
              size={focused ? 28 : 24}
              color={color}
            />
          </View>
        );
      },
    })}
  >
    <Tab.Screen name="HomeStack" component={HomeStackNavigator} />
    <Tab.Screen name="NotificationsStack" component={NotificationsStackNavigator} />
    <Tab.Screen name="SearchStack" component={SearchStackNavigator} />
  </Tab.Navigator>
);
};

const AppNavigator = () => <MainTabs />;

export default AppNavigator;

