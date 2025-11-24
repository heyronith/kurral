// Tuning Suggestion Modal - Shows AI suggestions for algorithm tuning
import { useState } from 'react';
import type { TuningSuggestion } from '../lib/agents/tuningAgent';
import { tuningService } from '../lib/services/tuningService';

interface TuningSuggestionModalProps {
  suggestion: TuningSuggestion;
  onClose: () => void;
  onApply: () => void;
}

const TuningSuggestionModal = ({ suggestion, onClose, onApply }: TuningSuggestionModalProps) => {
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      tuningService.applySuggestion(suggestion);
      onApply();
    } catch (error) {
      console.error('Error applying suggestion:', error);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-textPrimary">Feed Algorithm Suggestion</h2>
          <button
            onClick={onClose}
            className="text-textMuted hover:text-textPrimary transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-textMuted mb-4">{suggestion.explanation}</p>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-textMuted">Following boost:</span>
              <span className="text-textPrimary capitalize">{suggestion.followingWeight}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-textMuted">Boost active conversations:</span>
              <span className="text-textPrimary">{suggestion.boostActiveConversations ? 'On' : 'Off'}</span>
            </div>
            
            {suggestion.likedTopics.length > 0 && (
              <div>
                <span className="text-textMuted block mb-1">Suggested liked topics:</span>
                <div className="flex flex-wrap gap-2">
                  {suggestion.likedTopics.map(topic => (
                    <span key={topic} className="px-2 py-1 bg-primary/20 text-primary rounded text-xs">
                      #{topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {suggestion.mutedTopics.length > 0 && (
              <div>
                <span className="text-textMuted block mb-1">Suggested muted topics:</span>
                <div className="flex flex-wrap gap-2">
                  {suggestion.mutedTopics.map(topic => (
                    <span key={topic} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                      #{topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            <div className="pt-2 border-t border-border">
              <span className="text-xs text-textMuted">
                Confidence: {(suggestion.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? 'Applying...' : 'Apply Suggestions'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-background/50 text-textMuted rounded hover:bg-background/70 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default TuningSuggestionModal;

