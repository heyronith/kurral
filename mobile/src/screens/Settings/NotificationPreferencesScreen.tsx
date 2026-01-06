import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { colors } from '../../theme/colors';
import type { NotificationPreferences } from '../../types';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const NotificationPreferencesScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    loadPreferences();
  }, [user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const prefsRef = doc(db, 'users', user.id, 'preferences', 'notifications');
      const prefsSnap = await getDoc(prefsRef);

      if (prefsSnap.exists()) {
        const data = prefsSnap.data() as NotificationPreferences;
        setPreferences(data);
      } else {
        // Use default preferences
        const defaultPrefs = getDefaultPreferences(user.id);
        setPreferences(defaultPrefs);
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      Alert.alert('Error', 'Failed to load notification preferences');
      if (user?.id) {
        setPreferences(getDefaultPreferences(user.id));
      }
    } finally {
      setLoading(false);
    }
  };

  const getDefaultPreferences = (userId: string): NotificationPreferences => {
    return {
      userId,
      commentNotifications: true,
      replyNotifications: true,
      rechirpNotifications: true,
      followNotifications: true,
      mentionNotifications: true,
      mutedUserIds: [],
      mutedChirpIds: [],
      mutedThreadIds: [],
    };
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: any) => {
    if (!user?.id || !preferences) return;

    const updated = { ...preferences, [key]: value };
    setPreferences(updated);

    try {
      setSaving(true);
      const prefsRef = doc(db, 'users', user.id, 'preferences', 'notifications');
      
      // Check if document exists
      const prefsSnap = await getDoc(prefsRef);
      if (prefsSnap.exists()) {
        await updateDoc(prefsRef, { [key]: value });
      } else {
        await setDoc(prefsRef, updated);
      }
    } catch (error) {
      console.error('Error updating notification preference:', error);
      Alert.alert('Error', 'Failed to update preference');
      // Revert on error
      setPreferences(preferences);
    } finally {
      setSaving(false);
    }
  };

  const PreferenceRow = ({
    label,
    description,
    value,
    onValueChange,
  }: {
    label: string;
    description?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceContent}>
        <Text style={styles.preferenceLabel}>{label}</Text>
        {description && <Text style={styles.preferenceDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.light.border, true: `${colors.light.accent}80` }}
        thumbColor={value ? colors.light.accent : colors.light.textMuted}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.light.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Preferences</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.light.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!preferences) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.light.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notification Preferences</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load preferences</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Preferences</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          <Text style={styles.sectionDescription}>
            Choose which types of notifications you want to receive
          </Text>

          <PreferenceRow
            label="Comments"
            description="When someone comments on your posts"
            value={preferences.commentNotifications}
            onValueChange={(value) => updatePreference('commentNotifications', value)}
          />

          <PreferenceRow
            label="Replies"
            description="When someone replies to your comments"
            value={preferences.replyNotifications}
            onValueChange={(value) => updatePreference('replyNotifications', value)}
          />

          <PreferenceRow
            label="Rechirps"
            description="When someone rechirps your posts"
            value={preferences.rechirpNotifications}
            onValueChange={(value) => updatePreference('rechirpNotifications', value)}
          />

          <PreferenceRow
            label="New Followers"
            description="When someone follows you"
            value={preferences.followNotifications}
            onValueChange={(value) => updatePreference('followNotifications', value)}
          />

          <PreferenceRow
            label="Mentions"
            description="When someone mentions you in a post or comment"
            value={preferences.mentionNotifications}
            onValueChange={(value) => updatePreference('mentionNotifications', value)}
          />
        </View>

        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color={colors.light.accent} />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
    backgroundColor: colors.light.backgroundElevated,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 15,
    color: colors.light.textMuted,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.light.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.light.backgroundElevated,
    borderRadius: 12,
    marginBottom: 8,
  },
  preferenceContent: {
    flex: 1,
    marginRight: 12,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    color: colors.light.textMuted,
    lineHeight: 18,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  savingText: {
    fontSize: 14,
    color: colors.light.textMuted,
  },
});

export default NotificationPreferencesScreen;

