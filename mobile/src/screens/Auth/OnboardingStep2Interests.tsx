import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PrimaryButton from '../../components/PrimaryButton';
import { colors } from '../../theme/colors';
import { extractInterestsFromStatement } from '../../services/profileInterestAgent';
import { useTopicStore } from '../../stores/useTopicStore';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Step2Interests'>;

const OnboardingStep2Interests = ({ navigation, route }: Props) => {
  const { interests: initialInterests, onUpdate } = route.params;
  const { trendingTopics, isLoadingTrending, loadTrendingTopics } = useTopicStore();
  const [semanticInterests, setSemanticInterests] = useState<string[]>(initialInterests || []);
  const [unifiedInterestInput, setUnifiedInterestInput] = useState('');
  const [interestError, setInterestError] = useState('');
  const [interestLoading, setInterestLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [forceAIExtraction, setForceAIExtraction] = useState(false);

  useEffect(() => {
    loadTrendingTopics(6);
  }, [loadTrendingTopics]);

  // Detect if input looks like a statement (natural language) vs direct interest
  // More lenient: any multi-word input (3+ words) or contains sentence indicators
  const looksLikeStatement = (text: string): boolean => {
    const trimmed = text.trim();
    if (trimmed.length < 5) return false;
    
    // Count words - if 3+ words, likely a statement
    const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount >= 3) return true;
    
    // Check for sentence indicators (more lenient patterns)
    const statementIndicators = [
      /\b(i|i'd|i'll|i've|i'm|i want|i like|i prefer|i need|i'm interested|show me|give me|more|less|fewer|about|related to)\b/i,
      /[.!?]\s*$/,
      /\b(and|or|but|because|since|when|where|how|what|why|with|without)\b/i,
      /\b(should|would|could|might|may|can|will|want|like|prefer|need)\b/i,
      /\b(in|on|at|for|to|from|about|related|regarding|concerning)\b/i,
    ];
    
    return statementIndicators.some(pattern => pattern.test(trimmed));
  };

  const handleAddInterest = async () => {
    const input = unifiedInterestInput.trim();
    if (!input) {
      setInterestError('Enter an interest or describe what you want to see.');
      return;
    }

    setInterestError('');
    setInterestLoading(true);

    try {
      const shouldUseAI = forceAIExtraction || looksLikeStatement(input);
      
      if (shouldUseAI) {
        console.log('[OnboardingStep2] Attempting AI extraction for:', input);
        const extracted = await extractInterestsFromStatement(input);
        
        if (extracted.length === 0) {
          // Fallback: if AI extraction fails, try to intelligently split the input
          console.warn('[OnboardingStep2] AI extraction returned empty, falling back to smart split');
          
          // Smart fallback: split by common delimiters and clean up
          const fallbackInterests = input
            .split(/[,;]|\band\b|\bor\b/i)
            .map(s => s.trim())
            .filter(s => s.length >= 2)
            .map(s => s.toLowerCase());
          
          if (fallbackInterests.length > 0) {
            setSemanticInterests((prev) => {
              const combined = [...prev, ...fallbackInterests];
              const unique = Array.from(new Set(combined.map(i => i.toLowerCase())));
              return unique;
            });
            setUnifiedInterestInput('');
            setForceAIExtraction(false);
            setInterestError('AI extraction unavailable; added your interests directly.');
            setInterestLoading(false);
            return;
          }
          
          setInterestError('Could not extract interests. Try adding keywords directly or rephrase your statement.');
          setInterestLoading(false);
          setForceAIExtraction(false);
          return;
        }

        console.log('[OnboardingStep2] AI extracted interests:', extracted);
        setSemanticInterests((prev) => {
          const combined = [...prev, ...extracted];
          const unique = Array.from(new Set(combined.map(i => i.toLowerCase())));
          return unique;
        });
        setUnifiedInterestInput('');
        setForceAIExtraction(false);
      } else {
        const normalized = input.toLowerCase();
        if (semanticInterests.includes(normalized)) {
          setInterestError('Interest already added.');
          setInterestLoading(false);
          return;
        }
        if (normalized.length < 2) {
          setInterestError('Interest must be at least 2 characters.');
          setInterestLoading(false);
          return;
        }
        setSemanticInterests([...semanticInterests, normalized]);
        setUnifiedInterestInput('');
      }
    } catch (error: any) {
      console.error('[OnboardingStep2] Error processing interest:', error);
      setInterestError(`Failed to process: ${error?.message || 'Unknown error'}. Try again or add keywords directly.`);
      setForceAIExtraction(false);
    } finally {
      setInterestLoading(false);
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setSemanticInterests(semanticInterests.filter(i => i !== interest));
  };

  const handleAddTrendingTopic = (topicName: string) => {
    const normalized = topicName.toLowerCase();
    if (!semanticInterests.includes(normalized)) {
      setSemanticInterests([...semanticInterests, normalized]);
    }
  };

  const handleContinue = () => {
    setGeneralError('');

    if (semanticInterests.length === 0) {
      setGeneralError('Please add at least one interest to personalize your feed.');
      return;
    }

    // Update parent with current interests
    onUpdate({
      interests: semanticInterests,
    });

    // Navigate to next step
    navigation.navigate('Step3Follow', {
      profileData: route.params.profileData,
      interests: semanticInterests,
      onUpdate: route.params.onUpdate,
      currentUserId: route.params.currentUserId,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.stepIndicator}>Step 2 of 3</Text>
        <Text style={styles.title}>Your Interests</Text>
        <Text style={styles.subtitle}>What do you want to see in your feed?</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>How this works</Text>
            <Text style={styles.infoText}>
              • Add a keyword and tap Add{'\n'}
              • Write a full sentence and tap Extract to auto-pull topics{'\n'}
              • Tap a chip to remove it, or pick from Trending below
            </Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Interests *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.interestInput}
                value={unifiedInterestInput}
                onChangeText={(text) => {
                  setUnifiedInterestInput(text);
                  if (interestError) setInterestError('');
                  // Auto-detect if user wants AI extraction
                  if (!forceAIExtraction && looksLikeStatement(text)) {
                    // User is typing a statement, suggest AI extraction
                  }
                }}
                placeholder={
                  forceAIExtraction || looksLikeStatement(unifiedInterestInput)
                    ? 'e.g. I want more AI research and less politics'
                    : 'e.g. ai research, react development, or describe what you want'
                }
                placeholderTextColor={colors.light.textMuted}
                onSubmitEditing={handleAddInterest}
                returnKeyType="done"
              />
              <View style={styles.buttonGroup}>
                {!forceAIExtraction && !looksLikeStatement(unifiedInterestInput) && unifiedInterestInput.trim().length > 0 && (
                  <TouchableOpacity
                    style={styles.aiToggleButton}
                    onPress={() => setForceAIExtraction(true)}
                  >
                    <Text style={styles.aiToggleText}>AI</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    (interestLoading || !unifiedInterestInput.trim()) && styles.addButtonDisabled,
                  ]}
                  onPress={handleAddInterest}
                  disabled={interestLoading || !unifiedInterestInput.trim()}
                >
                  {interestLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.addButtonText}>
                      {forceAIExtraction || looksLikeStatement(unifiedInterestInput) ? 'Extract' : 'Add'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            {forceAIExtraction && (
              <TouchableOpacity
                style={styles.aiIndicator}
                onPress={() => setForceAIExtraction(false)}
              >
                <Text style={styles.aiIndicatorText}>
                  ✓ AI extraction enabled - tap to disable
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {interestError ? (
            <Text style={styles.errorText}>{interestError}</Text>
          ) : null}

          {semanticInterests.length > 0 && (
            <View style={styles.interestsContainer}>
              <Text style={styles.interestsLabel}>
                Your interests ({semanticInterests.length})
              </Text>
              <View style={styles.chipsContainer}>
                {semanticInterests.map((interest) => (
                  <TouchableOpacity
                    key={interest}
                    style={styles.chip}
                    onPress={() => handleRemoveInterest(interest)}
                  >
                    <Text style={styles.chipText}>{interest}</Text>
                    <Text style={styles.chipRemove}>×</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {semanticInterests.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Add interests to personalize your feed
              </Text>
            </View>
          )}

          <View style={styles.trendingSection}>
            <Text style={styles.trendingLabel}>Trending Topics</Text>
            {isLoadingTrending ? (
              <ActivityIndicator color={colors.light.accent} style={styles.loading} />
            ) : trendingTopics.length === 0 ? (
              <Text style={styles.noTrending}>No trending topics yet</Text>
            ) : (
              <View style={styles.trendingChips}>
                {trendingTopics.slice(0, 5).map((topic) => (
                  <TouchableOpacity
                    key={topic.name}
                    style={styles.trendingChip}
                    onPress={() => handleAddTrendingTopic(topic.name)}
                  >
                    <Text style={styles.trendingChipText}>#{topic.name}</Text>
                    {topic.postsLast1h !== undefined && (
                      <Text style={styles.trendingChipCount}>
                        {' '}· {topic.postsLast1h} posts
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {generalError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{generalError}</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <PrimaryButton
              title="Continue"
              onPress={handleContinue}
              disabled={semanticInterests.length === 0}
              style={styles.continueButton}
            />
          </View>
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
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.light.border,
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
    paddingBottom: 100,
  },
  infoBox: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.light.textMuted,
    lineHeight: 20,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.light.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  interestInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.light.textPrimary,
    backgroundColor: colors.light.backgroundElevated,
    minHeight: 44,
    maxHeight: 100,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  aiToggleButton: {
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.accent,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  aiToggleText: {
    color: colors.light.accent,
    fontWeight: '600',
    fontSize: 12,
  },
  aiIndicator: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: `${colors.light.accent}15`,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  aiIndicatorText: {
    color: colors.light.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: colors.light.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
    minHeight: 44,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  errorText: {
    color: colors.light.error,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
    marginLeft: 4,
  },
  interestsContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  interestsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.light.textSecondary,
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginRight: -4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.light.accent}20`,
    borderWidth: 1,
    borderColor: `${colors.light.accent}40`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 13,
    color: colors.light.accent,
    fontWeight: '600',
    flexShrink: 1,
  },
  chipRemove: {
    fontSize: 16,
    color: colors.light.accent,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 13,
    color: colors.light.textMuted,
    fontStyle: 'italic',
  },
  trendingSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  trendingLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  loading: {
    marginVertical: 12,
  },
  noTrending: {
    fontSize: 13,
    color: colors.light.textMuted,
    fontStyle: 'italic',
  },
  trendingChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginRight: -4,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trendingChipText: {
    fontSize: 13,
    color: colors.light.textPrimary,
    fontWeight: '600',
  },
  trendingChipCount: {
    fontSize: 11,
    color: colors.light.textMuted,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderColor: colors.light.error,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.light.textMuted,
    fontWeight: '600',
    fontSize: 16,
  },
  continueButton: {
    flex: 2,
  },
});

export default OnboardingStep2Interests;

