import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUserStore } from '../../stores/useUserStore';
import { ALL_TOPICS, isLegacyTopic, type Topic } from '../../types';
import { instructionService } from '../../services/instructionService';
import { colors } from '../../theme/colors';

interface SmartPreset {
  id: string;
  label: string;
  description: string;
  instruction: string;
  icon: string;
}

const SMART_PRESETS: SmartPreset[] = [
  {
    id: 'discovery',
    label: 'Discovery',
    description: 'Explore new voices',
    instruction: 'Show me more diverse content from people I don\'t follow, prioritize discovery over following',
    icon: '🔍',
  },
  {
    id: 'following',
    label: 'Stay Connected',
    description: 'Focus on people you follow',
    instruction: 'Show me more posts from people I follow, prioritize following over discovery',
    icon: '👥',
  },
  {
    id: 'active',
    label: 'Lively Discussions',
    description: 'Boost active conversations',
    instruction: 'Show me posts with active discussions and conversations, boost active threads',
    icon: '💬',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Mix of everything',
    instruction: 'Show me a balanced mix of following and discovery, moderate settings',
    icon: '⚖️',
  },
];

const ForYouControlsScreen = () => {
  const navigation = useNavigation();
  const { forYouConfig, setForYouConfig } = useConfigStore();
  const { user: currentUser } = useAuthStore();
  const { updateInterests } = useUserStore();

  const maxInstructionTopics = useMemo(() => {
    if (!currentUser?.topics?.length) return ALL_TOPICS;
    return currentUser.topics
      .map((t) => t.trim().toLowerCase())
      .filter(isLegacyTopic)
      .filter((t, i, arr) => arr.indexOf(t) === i);
  }, [currentUser]);

  const [instructionInput, setInstructionInput] = useState('');
  const [instructionStatus, setInstructionStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [instructionFeedback, setInstructionFeedback] = useState('');
  const [instructionError, setInstructionError] = useState<string | null>(null);
  const [isSavingInterest, setIsSavingInterest] = useState(false);

  const currentInterests = useMemo(() => currentUser?.interests || [], [currentUser]);

  const handleInterestRemove = async (value: string) => {
    if (!currentUser) return;
    setIsSavingInterest(true);
    try {
      const updated = currentInterests.filter((interest) => interest !== value);
      // Update in user store (which will sync to Firestore)
      await updateInterests(updated);
    } catch (error) {
      console.error('Error removing interest:', error);
      Alert.alert('Error', 'Failed to remove interest');
    } finally {
      setIsSavingInterest(false);
    }
  };

  const handleInstructionSubmit = async (instruction?: string) => {
    const instructionToUse = instruction || instructionInput.trim();
    
    if (!instructionToUse) {
      setInstructionError('Tell the AI how you want your feed to feel.');
      setInstructionStatus('error');
      return;
    }

    setInstructionStatus('pending');
    setInstructionError(null);
    setInstructionFeedback('');

    try {
      const result = await instructionService.interpretInstruction(
        instructionToUse,
        forYouConfig,
        maxInstructionTopics,
        currentInterests
      );

      setForYouConfig(result.newConfig);
      setInstructionFeedback(result.explanation);
      setInstructionInput('');
      setInstructionStatus('success');

      if (
        currentUser &&
        (result.interestsToAdd?.length || result.interestsToRemove?.length)
      ) {
        const existing = currentUser.interests || [];
        let updated = [...existing];

        if (result.interestsToAdd?.length) {
          result.interestsToAdd.forEach((interest) => {
            if (!updated.includes(interest)) {
              updated.push(interest);
            }
          });
        }

        if (result.interestsToRemove?.length) {
          updated = updated.filter(
            (interest) => !result.interestsToRemove?.includes(interest)
          );
        }

        try {
          await updateInterests(updated);
        } catch (interestUpdateError) {
          console.error('Failed to update interests from instruction:', interestUpdateError);
        }
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setInstructionFeedback('');
        setInstructionStatus('idle');
      }, 5000);
    } catch (error: any) {
      setInstructionError(error?.message || 'Unable to interpret your request right now.');
      setInstructionStatus('error');
    }
  };

  const handlePresetClick = (preset: SmartPreset) => {
    handleInstructionSubmit(preset.instruction);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tune Your Feed</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Presets</Text>
          <Text style={styles.sectionDescription}>
            Tell the AI how you want your feed to feel, or use a quick preset.
          </Text>

          <View style={styles.presetsGrid}>
            {SMART_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                onPress={() => handlePresetClick(preset)}
                disabled={instructionStatus === 'pending'}
                style={[
                  styles.presetButton,
                  instructionStatus === 'pending' && styles.presetButtonDisabled,
                ]}
              >
                <Text style={styles.presetIcon}>{preset.icon}</Text>
                <View style={styles.presetContent}>
                  <Text style={styles.presetLabel}>{preset.label}</Text>
                  <Text style={styles.presetDescription}>{preset.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Interests</Text>
          <Text style={styles.sectionDescription}>
            AI extracts interests from your instructions. Tap ✕ to remove.
          </Text>

          <View style={styles.interestsContainer}>
            {currentInterests.length === 0 ? (
              <Text style={styles.emptyInterests}>
                No interests yet. Tell the AI what you want to see.
              </Text>
            ) : (
              <View style={styles.interestsList}>
                {currentInterests.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    onPress={() => handleInterestRemove(interest)}
                    disabled={isSavingInterest}
                    style={styles.interestTag}
                  >
                    <Text style={styles.interestText}>{interest}</Text>
                    <Text style={styles.interestRemove}>✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Instruction</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Tell the AI what you want... e.g. 'Show me react tutorials and AI research', 'More design content, less politics'"
              placeholderTextColor={colors.light.textMuted}
              value={instructionInput}
              onChangeText={setInstructionInput}
              multiline
              numberOfLines={4}
              editable={instructionStatus !== 'pending'}
            />
            <TouchableOpacity
              onPress={() => handleInstructionSubmit()}
              disabled={instructionStatus === 'pending' || !instructionInput.trim()}
              style={[
                styles.applyButton,
                (instructionStatus === 'pending' || !instructionInput.trim()) && styles.applyButtonDisabled,
              ]}
            >
              {instructionStatus === 'pending' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.applyButtonIcon}>✨</Text>
                  <Text style={styles.applyButtonText}>Apply</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {instructionError && (
            <View style={styles.feedbackContainer}>
              <Text style={styles.errorText}>{instructionError}</Text>
            </View>
          )}
          
          {instructionStatus === 'success' && instructionFeedback && (
            <View style={[styles.feedbackContainer, styles.successContainer]}>
              <Text style={styles.successText}>{instructionFeedback}</Text>
            </View>
          )}
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 12,
    color: colors.light.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  presetButtonDisabled: {
    opacity: 0.5,
  },
  presetIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  presetContent: {
    flex: 1,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 2,
  },
  presetDescription: {
    fontSize: 10,
    color: colors.light.textMuted,
    lineHeight: 14,
  },
  interestsContainer: {
    minHeight: 40,
  },
  emptyInterests: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.light.textMuted,
    paddingVertical: 8,
  },
  interestsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.light.accent + '25',
    borderWidth: 1,
    borderColor: colors.light.accent + '50',
  },
  interestText: {
    fontSize: 11,
    color: colors.light.accent,
    marginRight: 4,
  },
  interestRemove: {
    fontSize: 10,
    color: colors.light.accent,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  textInput: {
    minHeight: 100,
    padding: 12,
    paddingBottom: 50,
    borderRadius: 12,
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
    color: colors.light.textPrimary,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  applyButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.light.accent,
    gap: 6,
  },
  applyButtonDisabled: {
    opacity: 0.4,
  },
  applyButtonIcon: {
    fontSize: 14,
  },
  applyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  feedbackContainer: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  successContainer: {
    backgroundColor: colors.light.accent + '20',
    borderColor: colors.light.accent + '50',
  },
  errorText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
  },
  successText: {
    fontSize: 12,
    color: colors.light.accent,
    fontWeight: '600',
  },
});

export default ForYouControlsScreen;

