import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import FormInput from '../../components/FormInput';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import { userService } from '../../services/userService';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Step1Profile'>;

const OnboardingStep1Profile = ({ navigation, route }: Props) => {
  const { profileData, onUpdate } = route.params;
  const [displayName, setDisplayName] = useState(profileData?.displayName || '');
  const [handle, setHandle] = useState(profileData?.handle || '');
  const [bio, setBio] = useState(profileData?.bio || '');
  const [url, setUrl] = useState(profileData?.url || '');
  const [location, setLocation] = useState(profileData?.location || '');
  const [handleStatus, setHandleStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [handleError, setHandleError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const handleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const normalizedHandle = handle.trim().toLowerCase();

  // Check handle availability with debouncing
  useEffect(() => {
    if (!normalizedHandle) {
      setHandleStatus('idle');
      setHandleError('');
      return;
    }

    if (normalizedHandle.length < 3) {
      setHandleStatus('idle');
      setHandleError('Handle must be at least 3 characters');
      return;
    }

    if (!/^[a-z0-9_]+$/i.test(normalizedHandle)) {
      setHandleStatus('idle');
      setHandleError('Handle can only contain letters, numbers, and underscores');
      return;
    }

    setHandleStatus('checking');
    setHandleError('');

    if (handleTimerRef.current) {
      clearTimeout(handleTimerRef.current);
    }

    handleTimerRef.current = setTimeout(async () => {
      try {
        const existing = await userService.getUserByHandle(normalizedHandle);
        const currentUserId = route.params.currentUserId;
        
        // Available if no user exists, or if it's the current user's handle
        const isAvailable = !existing || (currentUserId && existing.id === currentUserId);
        
        setHandleStatus(isAvailable ? 'available' : 'taken');
        if (!isAvailable) {
          setHandleError('This handle is already taken');
        }
      } catch (error) {
        console.error('[OnboardingStep1] Error checking handle availability:', error);
        setHandleStatus('idle');
      }
    }, 600);

    return () => {
      if (handleTimerRef.current) {
        clearTimeout(handleTimerRef.current);
      }
    };
  }, [normalizedHandle, route.params.currentUserId]);

  const handleContinue = () => {
    setGeneralError('');

    // Validation
    if (!displayName.trim()) {
      setGeneralError('Display name is required');
      return;
    }

    if (!normalizedHandle) {
      setGeneralError('Handle is required');
      return;
    }

    if (!/^[a-z0-9_]+$/i.test(normalizedHandle)) {
      setGeneralError('Handle can only contain letters, numbers, and underscores');
      return;
    }

    if (normalizedHandle.length < 3) {
      setGeneralError('Handle must be at least 3 characters');
      return;
    }

    if (handleStatus === 'taken') {
      setGeneralError('This handle is already taken');
      return;
    }

    if (handleStatus === 'checking') {
      setGeneralError('Please wait while we check handle availability');
      return;
    }

    // Update parent with current data
    onUpdate({
      displayName: displayName.trim(),
      handle: normalizedHandle,
      bio: bio.trim() || undefined,
      url: url.trim() || undefined,
      location: location.trim() || undefined,
    });

    // Navigate to next step
    navigation.navigate('Step2Interests', {
      profileData: {
        displayName: displayName.trim(),
        handle: normalizedHandle,
        bio: bio.trim() || undefined,
        url: url.trim() || undefined,
        location: location.trim() || undefined,
      },
      interests: route.params.interests || [],
      onUpdate: route.params.onUpdate,
      currentUserId: route.params.currentUserId,
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>Step 1 of 3</Text>
          <Text style={styles.title}>Profile Basics</Text>
          <Text style={styles.subtitle}>Set up your profile information</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <FormInput
            label="Display Name *"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            autoCapitalize="words"
            maxLength={50}
            error={generalError && !displayName.trim() ? generalError : undefined}
          />

          <View style={styles.handleContainer}>
            <Text style={styles.handleLabel}>Handle *</Text>
            <View style={styles.handleInputContainer}>
              <Text style={styles.handlePrefix}>@</Text>
              <FormInput
                label=""
                value={handle}
                onChangeText={(text) => {
                  // Only allow alphanumeric and underscore
                  const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
                  setHandle(cleaned);
                }}
                placeholder="yourhandle"
                autoCapitalize="none"
                maxLength={30}
                style={styles.handleInput}
                error={
                  handleError
                    ? handleError
                    : generalError && (!normalizedHandle || handleStatus === 'taken')
                    ? generalError
                    : undefined
                }
              />
            </View>
            {handleStatus === 'checking' && normalizedHandle.length >= 3 && (
              <Text style={styles.handleStatus}>Checking availability...</Text>
            )}
            {handleStatus === 'available' && (
              <Text style={[styles.handleStatus, styles.handleStatusAvailable]}>
                ✓ Handle available
              </Text>
            )}
            {handleStatus === 'taken' && (
              <Text style={[styles.handleStatus, styles.handleStatusTaken]}>
                ✗ Handle already taken
              </Text>
            )}
            {handleStatus === 'idle' && normalizedHandle.length === 0 && (
              <Text style={styles.handleHint}>
                Letters, numbers, and underscores only
              </Text>
            )}
          </View>

          <FormInput
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people what you share"
            multiline
            numberOfLines={3}
            maxLength={160}
            style={styles.bioInput}
          />
          {bio.length > 0 && (
            <Text style={styles.charCount}>{bio.length}/160</Text>
          )}

          <FormInput
            label="Website"
            value={url}
            onChangeText={setUrl}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
          />

          <FormInput
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="City, State"
            autoCapitalize="words"
            maxLength={50}
          />

          {generalError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{generalError}</Text>
            </View>
          )}

          <PrimaryButton
            title="Continue"
            onPress={handleContinue}
            disabled={handleStatus === 'checking' || handleStatus === 'taken'}
            style={styles.continueButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  stepIndicator: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.light.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  handleContainer: {
    marginBottom: 16,
  },
  handleLabel: {
    fontSize: 14,
    color: colors.light.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  handleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  handlePrefix: {
    fontSize: 16,
    color: colors.light.textMuted,
    marginRight: 4,
    paddingTop: 12,
  },
  handleInput: {
    flex: 1,
  },
  handleStatus: {
    fontSize: 12,
    marginTop: 4,
    color: colors.light.textMuted,
  },
  handleStatusAvailable: {
    color: '#10b981',
  },
  handleStatusTaken: {
    color: colors.light.error,
  },
  handleHint: {
    fontSize: 12,
    marginTop: 4,
    color: colors.light.textMuted,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: colors.light.textMuted,
    textAlign: 'right',
    marginTop: -12,
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderColor: colors.light.error,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.light.error,
    fontSize: 14,
  },
  continueButton: {
    marginTop: 8,
  },
});

export default OnboardingStep1Profile;

