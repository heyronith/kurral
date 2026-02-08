// Audience Description Box - User describes target audience in natural language
// Topics are extracted from the description
import { useState, useEffect, useRef } from 'react';
import type { TunedAudience } from '../types';
import { extractInterestsFromStatement } from '../lib/services/profileInterestAgent';
import { tryGenerateEmbedding } from '../lib/services/embeddingService';

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

const AudienceDescriptionBox = ({
  audienceDescription,
  onDescriptionChange,
  selectedTopics,
  onTopicsChange,
  tunedAudience,
  onAudienceChange,
  allTopics,
}: AudienceDescriptionBoxProps) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [manualTopic, setManualTopic] = useState('');
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
          // Extraction returned empty - might be too short or unclear
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

  const handleManualAdd = () => {
    if (manualTopic && selectedTopics.length < MAX_TOPICS) {
      const normalizedTopic = manualTopic.toLowerCase().trim();
      if (normalizedTopic && !selectedTopics.includes(normalizedTopic)) {
        onTopicsChange([...selectedTopics, normalizedTopic]);
        setManualTopic('');
      }
    }
  };

  const hasSelectedTopics = selectedTopics.length > 0;

  return (
    <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
      {/* Audience Description Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-textPrimary mb-2">
          Who should see this post?
        </label>
        <textarea
          value={audienceDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe your target audience... e.g., 'People interested in AI, machine learning, and tech startups'"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-textPrimary placeholder-textMuted focus:border-primary focus:outline-none resize-none"
          rows={2}
        />
        {isExtracting && (
          <div className="flex items-center gap-2 mt-2 text-xs text-textMuted">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Detecting topics...</span>
          </div>
        )}
        {extractionError && (
          <p className="mt-2 text-xs text-warning">{extractionError}</p>
        )}
      </div>

      {/* Extracted/Selected Topics */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-textMuted mb-2">
          Topics detected (up to {MAX_TOPICS}):
        </label>
        
        {hasSelectedTopics ? (
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
        ) : (
          <p className="text-xs text-textMuted mb-3">
            {audienceDescription.trim().length > 0
              ? 'Type at least 10 characters to detect topics, or add manually below.'
              : 'Describe your audience above to auto-detect topics, or add manually.'}
          </p>
        )}

        {/* Manual Topic Selection */}
        <div className="flex gap-2">
          <select
            value={manualTopic}
            onChange={(e) => setManualTopic(e.target.value)}
            disabled={selectedTopics.length >= MAX_TOPICS}
            className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded text-textPrimary focus:border-primary focus:outline-none disabled:opacity-50"
          >
            <option value="">Add topic manually...</option>
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
          <p className="text-xs text-warning mt-1">Maximum {MAX_TOPICS} topics reached</p>
        )}
      </div>

      {/* Reach Settings */}
      <div className="pt-3 border-t border-border">
        <label className="block text-xs font-medium text-textMuted mb-2">
          Who can see:
        </label>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-1.5 text-textMuted cursor-pointer">
            <input
              type="checkbox"
              checked={tunedAudience.allowFollowers}
              onChange={(e) =>
                onAudienceChange({ ...tunedAudience, allowFollowers: e.target.checked })
              }
              className="rounded"
            />
            <span className={tunedAudience.allowFollowers ? 'text-textPrimary font-medium' : ''}>
              Followers
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
            <span className={tunedAudience.allowNonFollowers ? 'text-textPrimary font-medium' : ''}>
              Non-followers with matching interests
            </span>
          </label>
        </div>
        {!tunedAudience.allowFollowers && !tunedAudience.allowNonFollowers && (
          <p className="text-xs text-warning mt-2">
            Select at least one audience group
          </p>
        )}
      </div>
    </div>
  );
};

export default AudienceDescriptionBox;
