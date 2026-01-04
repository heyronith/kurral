import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthLayout from '../../components/AuthLayout';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import { userService } from '../../services/userService';
import { useAuthStore } from '../../stores/useAuthStore';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

const OnboardingScreen = ({ navigation }: Props) => {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [handle, setHandle] = useState(user?.handle || '');
  const [interests, setInterests] = useState((user?.interests || []).join(', '));
  const [bio, setBio] = useState(user?.bio || '');
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again.');
      return;
    }
    if (!displayName || !handle) {
      Alert.alert('Missing fields', 'Name and handle are required.');
      return;
    }
    setLoading(true);
    try {
      const updated = {
        name: displayName.trim(),
        handle: handle.trim(),
        interests: interests
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        bio: bio.trim() || undefined,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(),
      };
      await userService.updateUser(user.id, updated);
      setUser({ ...user, ...updated });
      // RootNavigator will transition to the main app once onboardingCompleted is true
    } catch (err: any) {
      Alert.alert('Onboarding failed', err?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Finish setting up"
      subtitle="Tell us a bit about you and your interests."
      showBack
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormInput
          label="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
        <FormInput
          label="Handle"
          value={handle}
          onChangeText={setHandle}
          autoCapitalize="none"
          placeholder="yourhandle"
        />
        <FormInput
          label="Interests (comma separated)"
          value={interests}
          onChangeText={setInterests}
          placeholder="ai, startups, design"
        />
        <FormInput
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people what you share"
          multiline
          style={{ height: 100, textAlignVertical: 'top' }}
        />

        <PrimaryButton
          title="Complete Onboarding"
          onPress={handleComplete}
          loading={loading}
          style={{ marginTop: 8 }}
        />
        <Text style={styles.helper}>
          You can change these later in Profile.
        </Text>
      </ScrollView>
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 32,
  },
  helper: {
    marginTop: 12,
    color: colors.light.textMuted,
    fontSize: 13,
  },
});

export default OnboardingScreen;

