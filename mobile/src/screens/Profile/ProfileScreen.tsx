import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';
import { useAuthStore } from '../../stores/useAuthStore';
import { authService } from '../../services/authService';

const ProfileScreen = () => {
  const { user } = useAuthStore();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{user?.name || 'User'}</Text>
        <Text style={styles.handle}>@{user?.handle || 'your-handle'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email || 'Not set'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Joined</Text>
        <Text style={styles.value}>
          {user?.createdAt
            ? new Date(user.createdAt).toDateString()
            : 'Unknown'}
        </Text>
      </View>

      <TouchableOpacity style={styles.logout} onPress={authService.logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.background,
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.light.textPrimary,
  },
  handle: {
    marginTop: 4,
    color: colors.light.textMuted,
    fontSize: 14,
  },
  section: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
  },
  label: {
    fontSize: 13,
    color: colors.light.textMuted,
  },
  value: {
    marginTop: 4,
    fontSize: 16,
    color: colors.light.textPrimary,
  },
  logout: {
    marginTop: 24,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.light.accent,
    borderRadius: 12,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default ProfileScreen;


