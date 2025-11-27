import { useState, useMemo, type KeyboardEvent } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { ALL_TOPICS, type Topic } from '../types';
import { instructionService } from '../lib/services/instructionService';

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

const ForYouControls = () => {
  const { forYouConfig, setForYouConfig } = useConfigStore();
  const { currentUser, updateInterests } = useUserStore();
  const { theme } = useThemeStore();

  const maxInstructionTopics = useMemo(() => {
    if (!currentUser?.topics?.length) return ALL_TOPICS;
    return currentUser.topics
      .map((t) => t.trim().toLowerCase())
      .filter((t): t is Topic => ALL_TOPICS.includes(t as Topic))
      .filter((t, i, arr) => arr.indexOf(t) === i) as Topic[];
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
      await updateInterests(currentInterests.filter((interest) => interest !== value));
    } catch (error) {
      console.error('Error removing interest:', error);
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

  const handleInstructionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleInstructionSubmit();
    }
  };

  return (
    <div className={`p-6 space-y-6 ${theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-backgroundElevated/20 border-border/60'} border-b`}>
      {/* Header */}
      <div className="pb-2">
        <h3 className={`text-base font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-1.5`}>Tune Your Feed</h3>
        <p className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} leading-relaxed`}>
          Tell the AI how you want your feed to feel, or use a quick preset.
        </p>
      </div>

      {/* Smart Presets */}
      <div>
        <div className="grid grid-cols-2 gap-2.5">
          {SMART_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              disabled={instructionStatus === 'pending'}
              className={`group relative p-3.5 rounded-lg border ${theme === 'dark' ? 'border-white/20 bg-transparent hover:bg-white/10 hover:border-white/40' : 'border-border/60 bg-card/40 hover:bg-card/60 hover:border-accent/40'} transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left ${theme === 'dark' ? '' : 'shadow-button hover:shadow-elevated'}`}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-xl">{preset.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`}>{preset.label}</div>
                  <div className={`text-[10px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1 leading-snug`}>{preset.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* AI Instruction Input - Unified Interest & Feed Tuning */}
      <div className="space-y-3">
        {/* Your Interests Display */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className={`text-[10px] font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textLabel'} uppercase tracking-wider`}>
                Your Interests
              </p>
              <p className={`text-[11px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-0.5`}>
                AI extracts interests from your instructions. Click ✕ to remove.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 min-h-[32px]">
            {currentInterests.length === 0 && (
              <span className={`text-[11px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} italic`}>
                No interests yet. Tell the AI what you want to see.
              </span>
            )}
            {currentInterests.map((interest) => (
              <button
                key={interest}
                onClick={() => handleInterestRemove(interest)}
                className="px-3 py-1 text-[11px] rounded-full bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors flex items-center gap-1"
                disabled={isSavingInterest}
              >
                <span>{interest}</span>
                <span className="text-[10px]">✕</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <textarea
            className={`w-full rounded-lg border ${theme === 'dark' ? 'border-white/20 bg-white/5 text-white placeholder:text-white/50 focus:border-accent/60 focus:bg-white/10 focus:ring-accent/20' : 'border-border/60 bg-card/40 text-textPrimary placeholder:text-textMuted/50 focus:border-accent/60 focus:bg-card/60 focus:ring-accent/20'} px-4 py-3 text-sm outline-none focus:ring-2 transition-all resize-none ${theme === 'dark' ? '' : 'shadow-inner'}`}
            placeholder="Tell the AI what you want... e.g. 'Show me react tutorials and AI research', 'More design content, less politics', 'Prioritize startup funding posts'"
            value={instructionInput}
            onChange={(e) => setInstructionInput(e.target.value)}
            onKeyDown={handleInstructionKeyDown}
            disabled={instructionStatus === 'pending'}
            rows={3}
          />
          <button
            onClick={() => handleInstructionSubmit()}
            disabled={instructionStatus === 'pending' || !instructionInput.trim()}
            className="absolute bottom-3 right-3 px-4 py-1.5 rounded-md bg-accent text-white text-xs font-semibold hover:bg-accentHover transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-button active:scale-95"
          >
            {instructionStatus === 'pending' ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Tuning...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Apply</span>
              </>
            )}
          </button>
        </div>

        {/* Feedback Messages */}
        {instructionError && (
          <div className="px-3.5 py-2.5 rounded-lg bg-error/10 border border-error/30">
            <p className="text-xs text-error font-medium">{instructionError}</p>
          </div>
        )}
        
        {instructionStatus === 'success' && instructionFeedback && (
          <div className="px-3.5 py-2.5 rounded-lg bg-accent/10 border border-accent/30">
            <p className="text-xs text-accent font-medium">{instructionFeedback}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForYouControls;
