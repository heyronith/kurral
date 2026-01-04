import React from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/Home/HomeScreen';
import SearchScreen from '../screens/Search/SearchScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import PostDetailScreen from '../screens/Post/PostDetailScreen';
import { colors } from '../theme/colors';
import { useComposer } from '../context/ComposerContext';
import icon from '../../assets/icon.png';

export type AppTabParamList = {
  Home: undefined;
  Search: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  PostDetail: { postId: string };
};

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Search: 'search',
  Notifications: 'notifications',
  Profile: 'person',
};

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const { open } = useComposer();

  const handlePress = (routeName: string) => {
    navigation.navigate(routeName);
  };

  return (
    <View style={styles.tabBarWrapper}>
      <View style={styles.tabContainer}>
        {state.routes.map((route, index) => {
          if (index === 2) {
            return <View key="center-spacer" style={styles.centerSpacer} />;
          }

          const isFocused = state.index === index;
          const iconName = ICON_MAP[route.name] || 'ellipse';

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabButton}
              onPress={() => handlePress(route.name)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFocused ? iconName : `${iconName}-outline`}
                size={24}
                color={isFocused ? colors.light.accent : colors.light.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={styles.centerButton} onPress={open} activeOpacity={0.85}>
        <View style={styles.centerButtonInner}>
          <Image source={icon} style={styles.centerLogo} resizeMode="contain" />
        </View>
      </TouchableOpacity>
    </View>
  );
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        display: 'none',
      },
    }}
    tabBar={(props) => <CustomTabBar {...props} />}
  >
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Search" component={SearchScreen} />
    <Tab.Screen name="Notifications" component={NotificationsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const AppNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="MainTabs" component={MainTabs} />
    <Stack.Screen name="PostDetail" component={PostDetailScreen} />
  </Stack.Navigator>
);

export default AppNavigator;

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    borderRadius: 40,
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.light.border,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  centerSpacer: {
    width: 85,
  },
  centerButton: {
    position: 'absolute',
    top: -28,
    alignSelf: 'center',
  },
  centerButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  centerLogo: {
    width: 36,
    height: 36,
    tintColor: '#fff',
  },
});

