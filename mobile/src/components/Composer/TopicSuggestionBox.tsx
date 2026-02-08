import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import type { TunedAudience } from '../../types';

export interface TopicSuggestion {
  topic: string;
  confidence: number;
  explanation?: string;
  isUserTopic?: boolean;
}

interface TopicSuggestionBoxProps {
  suggestedTopics: TopicSuggestion[];
  selectedTopics: string[]; // Changed from single to array
  onTopicsChange: (topics: string[]) => void; // Changed from onTopicSelect
  tunedAudience: TunedAudience;
  onAudienceChange: (audience: TunedAudience) => void;
  overallExplanation?: string;
  onApply: () => void;
  onIgnore: () => void;
  allTopics: string[];
}

const MAX_TOPICS = 5; // Maximum number of topics a user can select

const TopicSuggestionBox: React.FC<TopicSuggestionBoxProps> = ({
  suggestedTopics,
  selectedTopics,
  onTopicsChange,
  tunedAudience,
  onAudienceChange,
  overallExplanation,
  onApply,
  onIgnore,
  allTopics,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const handleTopicToggle = (topic: string) => {
    const normalizedTopic = topic.toLowerCase().trim();
    if (selectedTopics.includes(normalizedTopic)) {
      // Remove topic
      onTopicsChange(selectedTopics.filter((t) => t !== normalizedTopic));
    } else {
      // Add topic (if under limit)
      if (selectedTopics.length < MAX_TOPICS) {
        onTopicsChange([...selectedTopics, normalizedTopic]);
      }
    }
  };

  const handleRemoveTopic = (topic: string) => {
    onTopicsChange(selectedTopics.filter((t) => t !== topic));
  };

  const hasSelectedTopics = selectedTopics.length > 0;

  return (
    <View style={styles.container}>
      {/* AI Explanation */}
      {overallExplanation && (
        <Text style={styles.explanation}>{overallExplanation}</Text>
      )}

      {/* Selected Topics Display */}
      {hasSelectedTopics && (
        <View style={styles.selectedTopicsRow}>
          {selectedTopics.map((topic, index) => (
            <View
              key={topic}
              style={[
                styles.selectedTopicChip,
                index === 0 ? styles.primaryTopicChip : styles.secondaryTopicChip,
              ]}
            >
              <Text
                style={[
                  styles.selectedTopicText,
                  index === 0 ? styles.primaryTopicText : styles.secondaryTopicText,
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
                    styles.removeTopicBtn,
                    index === 0 ? styles.primaryRemoveBtn : styles.secondaryRemoveBtn,
                  ]}
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Topic Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          Select topics (up to {MAX_TOPICS}):
        </Text>

        {/* Suggested Topics with Checkboxes */}
        <View style={styles.topicsContainer}>
          {suggestedTopics.map((suggestion) => {
            const isSelected = selectedTopics.includes(suggestion.topic.toLowerCase());
            const isDisabled = !isSelected && selectedTopics.length >= MAX_TOPICS;
            return (
              <TouchableOpacity
                key={suggestion.topic}
                style={[
                  styles.topicOption,
                  isSelected && styles.topicOptionSelected,
                  isDisabled && styles.topicOptionDisabled,
                ]}
                onPress={() => !isDisabled && handleTopicToggle(suggestion.topic)}
                activeOpacity={isDisabled ? 1 : 0.7}
              >
                <View style={styles.topicHeader}>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text
                    style={[
                      styles.topicName,
                      isSelected && styles.topicNameSelected,
                      isDisabled && styles.topicNameDisabled,
                    ]}
                  >
                    #{suggestion.topic}
                  </Text>
                  {suggestion.isUserTopic && (
                    <View style={styles.userTopicBadge}>
                      <Text style={styles.userTopicBadgeText}>Your topic</Text>
                    </View>
                  )}
                  <Text style={styles.confidence}>
                    {(suggestion.confidence * 100).toFixed(0)}% match
                  </Text>
                </View>
                {suggestion.explanation && (
                  <Text style={styles.topicExplanation}>
                    {suggestion.explanation}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Manual topic selection */}
        <View style={styles.manualSection}>
          <Text style={styles.manualLabel}>Or add from available topics:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.manualScroll}
            contentContainerStyle={styles.manualScrollContent}
          >
            {allTopics.slice(0, 20).map((topic) => {
              const normalizedTopic = topic.toLowerCase();
              const isSelected = selectedTopics.includes(normalizedTopic);
              const isSuggested = suggestedTopics.some(
                (s) => s.topic.toLowerCase() === normalizedTopic
              );
              const isDisabled = !isSelected && selectedTopics.length >= MAX_TOPICS;
              if (isSuggested) return null; // Don't show duplicates
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
            <Text style={styles.maxWarning}>
              Maximum {MAX_TOPICS} topics reached
            </Text>
          )}
        </View>
      </View>

      {/* Reach Settings */}
      {hasSelectedTopics && (
        <View style={styles.reachSection}>
          <Text style={styles.sectionLabel}>Reach Settings:</Text>
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
                Non-followers
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      {hasSelectedTopics && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={onApply}
            activeOpacity={0.8}
          >
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.ignoreButton}
            onPress={onIgnore}
            activeOpacity={0.7}
          >
            <Text style={styles.ignoreButtonText}>Ignore</Text>
          </TouchableOpacity>
        </View>
      )}
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
    explanation: {
      fontSize: 13,
      color: colors.textPrimary,
      marginBottom: 12,
      lineHeight: 18,
    },
    selectedTopicsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    selectedTopicChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 4,
    },
    primaryTopicChip: {
      backgroundColor: colors.accent,
    },
    secondaryTopicChip: {
      backgroundColor: colors.accent + '30',
    },
    selectedTopicText: {
      fontSize: 12,
      fontWeight: '600',
    },
    primaryTopicText: {
      color: '#fff',
    },
    secondaryTopicText: {
      color: colors.accent,
    },
    removeTopicBtn: {
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
    section: {
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    topicsContainer: {
      gap: 8,
    },
    topicOption: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: colors.backgroundElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    topicOptionSelected: {
      backgroundColor: colors.accent + '20',
      borderColor: colors.accent + '60',
    },
    topicOptionDisabled: {
      opacity: 0.5,
    },
    topicHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    checkmark: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
    topicName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    topicNameSelected: {
      color: colors.accent,
    },
    topicNameDisabled: {
      color: colors.textMuted,
    },
    userTopicBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: colors.accent + '30',
      borderRadius: 6,
    },
    userTopicBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.accent,
    },
    confidence: {
      fontSize: 11,
      color: colors.textMuted,
      marginLeft: 'auto',
    },
    topicExplanation: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
      marginLeft: 24,
    },
    manualSection: {
      marginTop: 12,
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
      marginTop: 12,
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
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    applyButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    applyButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    ignoreButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: colors.backgroundElevated,
      alignItems: 'center',
    },
    ignoreButtonText: {
      color: colors.textMuted,
      fontWeight: '600',
      fontSize: 14,
    },
  });

export default TopicSuggestionBox;
