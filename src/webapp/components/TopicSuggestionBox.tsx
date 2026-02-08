// Topic Suggestion Box - Shows AI-suggested topics and reach settings
// Supports multi-topic selection
import { useState } from 'react';
import type { TopicSuggestion } from '../lib/agents/reachAgent';
import type { TunedAudience } from '../types';

interface TopicSuggestionBoxProps {
  suggestedTopics: TopicSuggestion[]; // Max 3 topics
  selectedTopics: string[]; // Changed from single to array
  onTopicsChange: (topics: string[]) => void; // Changed from onTopicSelect
  tunedAudience: TunedAudience;
  onAudienceChange: (audience: TunedAudience) => void;
  overallExplanation: string;
  onApply: () => void;
  onIgnore: () => void;
  allTopics: string[]; // For manual selection dropdown
}

const MAX_TOPICS = 5; // Maximum number of topics a user can select

const TopicSuggestionBox = ({
  suggestedTopics,
  selectedTopics,
  onTopicsChange,
  tunedAudience,
  onAudienceChange,
  overallExplanation,
  onApply,
  onIgnore,
  allTopics,
}: TopicSuggestionBoxProps) => {
  const [manualTopic, setManualTopic] = useState('');

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

  const handleManualAdd = () => {
    if (manualTopic && selectedTopics.length < MAX_TOPICS) {
      const normalizedTopic = manualTopic.toLowerCase().trim();
      if (normalizedTopic && !selectedTopics.includes(normalizedTopic)) {
        onTopicsChange([...selectedTopics, normalizedTopic]);
        setManualTopic('');
      }
    }
  };

  const handleRemoveTopic = (topic: string) => {
    onTopicsChange(selectedTopics.filter((t) => t !== topic));
  };

  const hasSelectedTopics = selectedTopics.length > 0;

  return (
    <div className="mb-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
      <div className="mb-3">
        <p className="text-sm text-textPrimary mb-3">{overallExplanation}</p>
        
        {/* Topic Selection */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-textMuted mb-2">
            Select topics (up to {MAX_TOPICS}):
          </label>
          
          {/* Selected Topics Display */}
          {hasSelectedTopics && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedTopics.map((topic, index) => (
                <span
                  key={topic}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                    index === 0
                      ? 'bg-primary text-white'
                      : 'bg-primary/20 text-primary'
                  }`}
                >
                  #{topic}
                  {index === 0 && (
                    <span className="text-[10px] opacity-75">(primary)</span>
                  )}
                  <button
                    onClick={() => handleRemoveTopic(topic)}
                    className="ml-1 hover:opacity-70"
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          
          {/* AI Suggested Topics */}
          <div className="space-y-2 mb-2">
            {suggestedTopics.map((suggestion) => {
              const isSelected = selectedTopics.includes(suggestion.topic.toLowerCase());
              const isDisabled = !isSelected && selectedTopics.length >= MAX_TOPICS;
              return (
                <label
                  key={suggestion.topic}
                  className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary/20 border-primary/50'
                      : isDisabled
                      ? 'bg-background/30 border-border/50 opacity-50 cursor-not-allowed'
                      : 'bg-background/50 border-border hover:bg-background/70'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => !isDisabled && handleTopicToggle(suggestion.topic)}
                    disabled={isDisabled}
                    className="mt-1 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-textPrimary">
                        #{suggestion.topic}
                      </span>
                      {suggestion.isUserTopic && (
                        <span className="px-1.5 py-0.5 text-xs bg-primary/30 text-primary rounded">
                          Your topic
                        </span>
                      )}
                      <span className="text-xs text-textMuted">
                        {(suggestion.confidence * 100).toFixed(0)}% match
                      </span>
                    </div>
                    {suggestion.explanation && (
                      <p className="text-xs text-textMuted mt-0.5">{suggestion.explanation}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Manual Selection */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-textMuted mb-1">
              Or add manually:
            </label>
            <div className="flex gap-2">
              <select
                value={manualTopic}
                onChange={(e) => setManualTopic(e.target.value)}
                disabled={selectedTopics.length >= MAX_TOPICS}
                className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded text-textPrimary focus:border-primary focus:outline-none disabled:opacity-50"
              >
                <option value="">Select a topic...</option>
                {allTopics
                  .filter((t) => !selectedTopics.includes(t.toLowerCase()))
                  .map((topic) => (
                    <option key={topic} value={topic}>
                      #{topic}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleManualAdd}
                disabled={!manualTopic || selectedTopics.length >= MAX_TOPICS}
                className="px-3 py-1.5 text-xs bg-background border border-border rounded text-textPrimary hover:bg-background/70 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                Add
              </button>
            </div>
            {selectedTopics.length >= MAX_TOPICS && (
              <p className="text-xs text-warning mt-1">
                Maximum {MAX_TOPICS} topics reached
              </p>
            )}
          </div>
        </div>

        {/* Reach Settings */}
        {hasSelectedTopics && (
          <div className="mb-3 pt-3 border-t border-border">
            <label className="block text-xs font-medium text-textMuted mb-2">
              Reach Settings:
            </label>
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1.5 text-textMuted cursor-pointer">
                <input
                  type="checkbox"
                  checked={tunedAudience.allowFollowers}
                  onChange={(e) =>
                    onAudienceChange({ ...tunedAudience, allowFollowers: e.target.checked })
                  }
                  className="rounded"
                />
                <span className={tunedAudience.allowFollowers ? 'text-textPrimary' : ''}>
                  Allow Followers
                </span>
              </label>
              <label className="flex items-center gap-1.5 text-textMuted cursor-pointer">
                <input
                  type="checkbox"
                  checked={tunedAudience.allowNonFollowers}
                  onChange={(e) =>
                    onAudienceChange({ ...tunedAudience, allowNonFollowers: e.target.checked })
                  }
                  className="rounded"
                />
                <span className={tunedAudience.allowNonFollowers ? 'text-textPrimary' : ''}>
                  Allow Non-followers
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {hasSelectedTopics && (
        <div className="flex gap-2">
          <button
            onClick={onApply}
            className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors"
            type="button"
          >
            Apply
          </button>
          <button
            onClick={onIgnore}
            className="px-3 py-1.5 text-xs bg-background/50 text-textMuted rounded hover:bg-background/70 transition-colors"
            type="button"
          >
            Ignore
          </button>
        </div>
      )}
    </div>
  );
};

export default TopicSuggestionBox;
