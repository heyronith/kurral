import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { TunedAudience } from '../../types';
import { extractInterestsFromStatement } from '../../services/profileInterestAgent';
import { tryGenerateEmbedding } from '../../services/embeddingService';

interface AudienceDescriptionBoxProps {
  audienceDescription: string;
  onDescriptionChange: (description: string) => void;
  selectedTopics: string[];
  onTopicsChange: (topics: string[]) => void;
  tunedAudience: TunedAudience;
  onAudienceChange: (audience: TunedAudience) => void;
  allTopics: string[]; // For manual selection
}

const MAX_TOPICS = 5;
const EXTRACTION_DEBOUNCE_MS = 800;

const AudienceDescriptionBox: React.FC<AudienceDescriptionBoxProps> = ({
  audienceDescription,
  onDescriptionChange,
  selectedTopics,
  onTopicsChange,
  tunedAudience,
  onAudienceChange,
  allTopics,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExtractedDescRef = useRef<string>('');

  // Extract topics when description changes (debounced)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmedDesc = audienceDescription.trim();

    // Skip if empty or same as last extraction
    if (!trimmedDesc || trimmedDesc === lastExtractedDescRef.current) {
      return;
    }

    // Only extract if description is meaningful (at least 10 chars)
    if (trimmedDesc.length < 10) {
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsExtracting(true);
      setExtractionError(null);

      try {
        console.log('[AudienceDescriptionBox] Extracting topics from:', trimmedDesc);
        const extractedTopics = await extractInterestsFromStatement(trimmedDesc);

        if (extractedTopics.length > 0) {
          // Normalize and dedupe
          const normalized = extractedTopics
            .map((t) => t.toLowerCase().trim())
            .filter((t) => t.length > 0)
            .slice(0, MAX_TOPICS);

          const unique = Array.from(new Set(normalized));
          onTopicsChange(unique);
          lastExtractedDescRef.current = trimmedDesc;

          // Also generate embedding for semantic matching
          try {
            const embedding = await tryGenerateEmbedding(trimmedDesc);
            if (embedding) {
              onAudienceChange({
                ...tunedAudience,
                targetAudienceDescription: trimmedDesc,
                targetAudienceEmbedding: embedding,
              });
            }
          } catch (embeddingError) {
            console.warn('[AudienceDescriptionBox] Failed to generate embedding:', embeddingError);
            // Still update description even if embedding fails
            onAudienceChange({
              ...tunedAudience,
              targetAudienceDescription: trimmedDesc,
            });
          }
        } else {
          setExtractionError('Could not detect topics. Try being more specific.');
        }
      } catch (error: any) {
        console.error('[AudienceDescriptionBox] Extraction error:', error);
        if (error?.message?.includes('rate limit') || error?.message?.includes('429')) {
          setExtractionError('AI temporarily unavailable. Add topics manually below.');
        } else {
          setExtractionError('Failed to extract topics. Add manually below.');
        }
      } finally {
        setIsExtracting(false);
      }
    }, EXTRACTION_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [audienceDescription]);

  const handleRemoveTopic = (topic: string) => {
    onTopicsChange(selectedTopics.filter((t) => t !== topic));
  };

  const handleTopicToggle = (topic: string) => {
    const normalizedTopic = topic.toLowerCase().trim();
    if (selectedTopics.includes(normalizedTopic)) {
      onTopicsChange(selectedTopics.filter((t) => t !== normalizedTopic));
    } else if (selectedTopics.length < MAX_TOPICS) {
      onTopicsChange([...selectedTopics, normalizedTopic]);
    }
  };

  const hasSelectedTopics = selectedTopics.length > 0;

  return (
    <View style={styles.container}>
      {/* Audience Description Input */}
      <View style={styles.descriptionSection}>
        <Text style={styles.label}>Who should see this post?</Text>
        <TextInput
          style={styles.descriptionInput}
          value={audienceDescription}
          onChangeText={onDescriptionChange}
          placeholder="Describe your target audience... e.g., 'People interested in AI, machine learning, and tech startups'"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
        {isExtracting && (
          <View style={styles.extractingRow}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.extractingText}>Detecting topics...</Text>
          </View>
        )}
        {extractionError && (
          <Text style={styles.errorText}>{extractionError}</Text>
        )}
      </View>

      {/* Extracted/Selected Topics */}
      <View style={styles.topicsSection}>
        <Text style={styles.smallLabel}>
          Topics detected (up to {MAX_TOPICS}):
        </Text>

        {hasSelectedTopics ? (
          <View style={styles.selectedTopicsRow}>
            {selectedTopics.map((topic, index) => (
              <View
                key={topic}
                style={[
                  styles.topicChip,
                  index === 0 ? styles.primaryChip : styles.secondaryChip,
                ]}
              >
                <Text
                  style={[
                    styles.topicChipText,
                    index === 0 ? styles.primaryChipText : styles.secondaryChipText,
                  ]}
                >
                  #{topic}
                  {index === 0 && ' (primary)'}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemoveTopic(topic)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[
                      styles.removeChipBtn,
                      index === 0 ? styles.primaryRemoveBtn : styles.secondaryRemoveBtn,
                    ]}
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noTopicsText}>
            {audienceDescription.trim().length > 0
              ? 'Type at least 10 characters to detect topics, or add manually below.'
              : 'Describe your audience above to auto-detect topics, or add manually.'}
          </Text>
        )}

        {/* Manual Topic Selection */}
        <View style={styles.manualSection}>
          <Text style={styles.manualLabel}>Add topics manually:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.manualScroll}
            contentContainerStyle={styles.manualScrollContent}
          >
            {allTopics.slice(0, 20).map((topic) => {
              const normalizedTopic = topic.toLowerCase();
              const isSelected = selectedTopics.includes(normalizedTopic);
              const isDisabled = !isSelected && selectedTopics.length >= MAX_TOPICS;
              return (
                <TouchableOpacity
                  key={topic}
                  style={[
                    styles.manualChip,
                    isSelected && styles.manualChipSelected,
                    isDisabled && styles.manualChipDisabled,
                  ]}
                  onPress={() => !isDisabled && handleTopicToggle(topic)}
                  activeOpacity={isDisabled ? 1 : 0.7}
                >
                  <Text
                    style={[
                      styles.manualChipText,
                      isSelected && styles.manualChipTextSelected,
                      isDisabled && styles.manualChipTextDisabled,
                    ]}
                  >
                    #{topic}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {selectedTopics.length >= MAX_TOPICS && (
            <Text style={styles.maxWarning}>Maximum {MAX_TOPICS} topics reached</Text>
          )}
        </View>
      </View>

      {/* Reach Settings */}
      <View style={styles.reachSection}>
        <Text style={styles.smallLabel}>Who can see:</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              tunedAudience.allowFollowers && styles.toggleButtonActive,
            ]}
            onPress={() =>
              onAudienceChange({
                ...tunedAudience,
                allowFollowers: !tunedAudience.allowFollowers,
              })
            }
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.toggleCheckbox,
                tunedAudience.allowFollowers && styles.toggleCheckboxChecked,
              ]}
            >
              {tunedAudience.allowFollowers && (
                <Text style={styles.toggleCheckmark}>✓</Text>
              )}
            </View>
            <Text
              style={[
                styles.toggleLabel,
                tunedAudience.allowFollowers && styles.toggleLabelActive,
              ]}
            >
              Followers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleButton,
              tunedAudience.allowNonFollowers && styles.toggleButtonActive,
            ]}
            onPress={() =>
              onAudienceChange({
                ...tunedAudience,
                allowNonFollowers: !tunedAudience.allowNonFollowers,
              })
            }
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.toggleCheckbox,
                tunedAudience.allowNonFollowers && styles.toggleCheckboxChecked,
              ]}
            >
              {tunedAudience.allowNonFollowers && (
                <Text style={styles.toggleCheckmark}>✓</Text>
              )}
            </View>
            <Text
              style={[
                styles.toggleLabel,
                tunedAudience.allowNonFollowers && styles.toggleLabelActive,
              ]}
            >
              Matching interests
            </Text>
          </TouchableOpacity>
        </View>
        {!tunedAudience.allowFollowers && !tunedAudience.allowNonFollowers && (
          <Text style={styles.warningText}>Select at least one audience group</Text>
        )}
      </View>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      marginTop: 12,
      padding: 12,
      backgroundColor: colors.accent + '15',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.accent + '40',
    },
    descriptionSection: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    descriptionInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      minHeight: 60,
    },
    extractingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    extractingText: {
      fontSize: 12,
      color: colors.textMuted,
    },
    errorText: {
      fontSize: 12,
      color: '#F59E0B',
      marginTop: 8,
    },
    topicsSection: {
      marginBottom: 16,
    },
    smallLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    selectedTopicsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    topicChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 4,
    },
    primaryChip: {
      backgroundColor: colors.accent,
    },
    secondaryChip: {
      backgroundColor: colors.accent + '30',
    },
    topicChipText: {
      fontSize: 12,
      fontWeight: '600',
    },
    primaryChipText: {
      color: '#fff',
    },
    secondaryChipText: {
      color: colors.accent,
    },
    removeChipBtn: {
      fontSize: 16,
      fontWeight: '700',
      marginLeft: 2,
    },
    primaryRemoveBtn: {
      color: '#fff',
    },
    secondaryRemoveBtn: {
      color: colors.accent,
    },
    noTopicsText: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 12,
    },
    manualSection: {
      marginTop: 8,
    },
    manualLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 8,
    },
    manualScroll: {
      marginHorizontal: -4,
    },
    manualScrollContent: {
      paddingHorizontal: 4,
      gap: 6,
    },
    manualChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    manualChipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    manualChipDisabled: {
      opacity: 0.5,
    },
    manualChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    manualChipTextSelected: {
      color: '#fff',
    },
    manualChipTextDisabled: {
      color: colors.textMuted,
    },
    maxWarning: {
      fontSize: 11,
      color: '#F59E0B',
      marginTop: 8,
      fontWeight: '500',
    },
    reachSection: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    toggleRow: {
      flexDirection: 'row',
      gap: 10,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.backgroundElevated,
      gap: 6,
    },
    toggleButtonActive: {
      backgroundColor: colors.accent + '20',
    },
    toggleCheckbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleCheckboxChecked: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    toggleCheckmark: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    toggleLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    toggleLabelActive: {
      color: colors.textPrimary,
    },
    warningText: {
      fontSize: 11,
      color: '#F59E0B',
      marginTop: 8,
      fontWeight: '500',
    },
  });

export default AudienceDescriptionBox;
