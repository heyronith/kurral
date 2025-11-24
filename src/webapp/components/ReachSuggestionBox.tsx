import type { TunedAudience } from '../types';

interface ReachSuggestionBoxProps {
  suggestion: {
    tunedAudience: TunedAudience;
    explanation: string;
  };
  onApply: () => void;
  onIgnore: () => void;
}

const ReachSuggestionBox = ({ suggestion, onApply, onIgnore }: ReachSuggestionBoxProps) => {
  return (
    <div className="mb-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-textPrimary mb-2">{suggestion.explanation}</p>
          <div className="text-xs text-textMuted space-y-1">
            <div className="flex items-center gap-2">
              <span className={suggestion.tunedAudience.allowFollowers ? 'text-primary' : 'text-textMuted'}>
                {suggestion.tunedAudience.allowFollowers ? '✓' : '✕'} Followers
              </span>
              <span className={suggestion.tunedAudience.allowNonFollowers ? 'text-primary' : 'text-textMuted'}>
                {suggestion.tunedAudience.allowNonFollowers ? '✓' : '✕'} Non-followers
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onApply}
            className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={onIgnore}
            className="px-3 py-1.5 text-xs bg-background/50 text-textMuted rounded hover:bg-background/70 transition-colors"
          >
            Ignore
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReachSuggestionBox;

