// Topic Suggestion Box - Shows AI-suggested topics and reach settings
import type { TopicSuggestion } from '../lib/agents/reachAgent';
import type { TunedAudience } from '../types';

interface TopicSuggestionBoxProps {
  suggestedTopics: TopicSuggestion[]; // Max 3 topics
  selectedTopic: string | null;
  onTopicSelect: (topic: string) => void;
  tunedAudience: TunedAudience;
  onAudienceChange: (audience: TunedAudience) => void;
  overallExplanation: string;
  onApply: () => void;
  onIgnore: () => void;
  allTopics: string[]; // For manual selection dropdown
}

const TopicSuggestionBox = ({
  suggestedTopics,
  selectedTopic,
  onTopicSelect,
  tunedAudience,
  onAudienceChange,
  overallExplanation,
  onApply,
  onIgnore,
  allTopics,
}: TopicSuggestionBoxProps) => {
  return (
    <div className="mb-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
      <div className="mb-3">
        <p className="text-sm text-textPrimary mb-3">{overallExplanation}</p>
        
        {/* Topic Selection */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-textMuted mb-2">
            Suggested Topics (select one):
          </label>
          
          {/* AI Suggested Topics */}
          <div className="space-y-2 mb-2">
            {suggestedTopics.map((suggestion, index) => (
              <label
                key={suggestion.topic}
                className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition-colors ${
                  selectedTopic === suggestion.topic
                    ? 'bg-primary/20 border-primary/50'
                    : 'bg-background/50 border-border hover:bg-background/70'
                }`}
              >
                <input
                  type="radio"
                  name="suggested-topic"
                  value={suggestion.topic}
                  checked={selectedTopic === suggestion.topic}
                  onChange={() => onTopicSelect(suggestion.topic)}
                  className="mt-1"
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
                  <p className="text-xs text-textMuted mt-0.5">{suggestion.explanation}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Manual Selection Dropdown */}
          <div className="mt-2">
            <label className="block text-xs font-medium text-textMuted mb-1">
              Or choose manually:
            </label>
            <select
              value={selectedTopic || ''}
              onChange={(e) => {
                if (e.target.value) {
                  onTopicSelect(e.target.value);
                }
              }}
              className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded text-textPrimary focus:border-primary focus:outline-none"
            >
              <option value="">Select a topic...</option>
              {allTopics.map((topic) => (
                <option key={topic} value={topic}>
                  #{topic}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reach Settings */}
        {selectedTopic && (
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
      {selectedTopic && (
        <div className="flex gap-2">
          <button
            onClick={onApply}
            className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          >
            Apply & Post
          </button>
          <button
            onClick={onIgnore}
            className="px-3 py-1.5 text-xs bg-background/50 text-textMuted rounded hover:bg-background/70 transition-colors"
          >
            Ignore
          </button>
        </div>
      )}
    </div>
  );
};

export default TopicSuggestionBox;

