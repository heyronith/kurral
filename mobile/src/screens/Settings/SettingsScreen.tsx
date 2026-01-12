import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { authService } from '../../services/authService';
import type { HomeStackParamList } from '../../navigation/AppNavigator';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProp = NativeStackNavigationProp<HomeStackParamList>;

interface SettingsRowProps {
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showArrow?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  description,
  icon,
  onPress,
  rightElement,
  showArrow = true,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.settingsRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingsRowLeft}>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: colors.accent + '15' }]}>
            <Ionicons name={icon} size={20} color={colors.accent} />
          </View>
        )}
        <View style={styles.settingsRowText}>
          <Text style={[styles.settingsRowLabel, { color: colors.textPrimary }]}>
            {label}
          </Text>
          {description && (
            <Text style={[styles.settingsRowDescription, { color: colors.textMuted }]}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.settingsRowRight}>
        {rightElement}
        {showArrow && onPress && (
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        )}
      </View>
    </TouchableOpacity>
  );
};

const SettingsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const { theme, toggleTheme } = useThemeStore();
  const { setUser } = useAuthStore();

  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error: any) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPEARANCE</Text>
          
          <View style={[styles.settingsGroup, { backgroundColor: colors.backgroundElevated }]}>
            <SettingsRow
              label="Dark Mode"
              description="Switch between light and dark theme"
              icon="moon"
              showArrow={false}
              rightElement={
                <Switch
                  value={theme === 'dark'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.border, true: colors.accent + '80' }}
                  thumbColor={theme === 'dark' ? colors.accent : '#f4f3f4'}
                  ios_backgroundColor={colors.border}
                />
              }
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>FEED</Text>
          
          <View style={[styles.settingsGroup, { backgroundColor: colors.backgroundElevated }]}>
            <SettingsRow
              label="Tune Your Feed"
              description="Customize what appears in your For You feed"
              icon="tune"
              onPress={() => navigation.navigate('ForYouControls')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>NOTIFICATIONS</Text>
          
          <View style={[styles.settingsGroup, { backgroundColor: colors.backgroundElevated }]}>
            <SettingsRow
              label="Notification Preferences"
              description="Manage your notification settings"
              icon="notifications-outline"
              onPress={() => navigation.navigate('NotificationPreferences' as never)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ACCOUNT</Text>
          
          <View style={[styles.settingsGroup, { backgroundColor: colors.backgroundElevated }]}>
            <SettingsRow
              label="Log Out"
              description="Sign out of your account"
              icon="log-out-outline"
              onPress={handleLogout}
              showArrow={false}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  settingsGroup: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsRowText: {
    flex: 1,
  },
  settingsRowLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingsRowDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default SettingsScreen;

