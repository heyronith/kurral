import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { ALL_TOPICS, isLegacyTopic } from '../types';
import { instructionService } from '../lib/services/instructionService';
const SMART_PRESETS = [
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
        if (!currentUser?.topics?.length)
            return ALL_TOPICS;
        return currentUser.topics
            .map((t) => t.trim().toLowerCase())
            .filter(isLegacyTopic)
            .filter((t, i, arr) => arr.indexOf(t) === i);
    }, [currentUser]);
    const [instructionInput, setInstructionInput] = useState('');
    const [instructionStatus, setInstructionStatus] = useState('idle');
    const [instructionFeedback, setInstructionFeedback] = useState('');
    const [instructionError, setInstructionError] = useState(null);
    const [isSavingInterest, setIsSavingInterest] = useState(false);
    const currentInterests = useMemo(() => currentUser?.interests || [], [currentUser]);
    const handleInterestRemove = async (value) => {
        if (!currentUser)
            return;
        setIsSavingInterest(true);
        try {
            await updateInterests(currentInterests.filter((interest) => interest !== value));
        }
        catch (error) {
            console.error('Error removing interest:', error);
        }
        finally {
            setIsSavingInterest(false);
        }
    };
    const handleInstructionSubmit = async (instruction) => {
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
            const result = await instructionService.interpretInstruction(instructionToUse, forYouConfig, maxInstructionTopics, currentInterests);
            setForYouConfig(result.newConfig);
            setInstructionFeedback(result.explanation);
            setInstructionInput('');
            setInstructionStatus('success');
            if (currentUser &&
                (result.interestsToAdd?.length || result.interestsToRemove?.length)) {
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
                    updated = updated.filter((interest) => !result.interestsToRemove?.includes(interest));
                }
                try {
                    await updateInterests(updated);
                }
                catch (interestUpdateError) {
                    console.error('Failed to update interests from instruction:', interestUpdateError);
                }
            }
            // Clear success message after 5 seconds
            setTimeout(() => {
                setInstructionFeedback('');
                setInstructionStatus('idle');
            }, 5000);
        }
        catch (error) {
            setInstructionError(error?.message || 'Unable to interpret your request right now.');
            setInstructionStatus('error');
        }
    };
    const handlePresetClick = (preset) => {
        handleInstructionSubmit(preset.instruction);
    };
    const handleInstructionKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleInstructionSubmit();
        }
    };
    return (_jsxs("div", { className: `p-6 space-y-6 ${theme === 'dark' ? 'bg-transparent border-b border-white/10' : 'bg-backgroundElevated/20'}`, children: [_jsxs("div", { className: "pb-2", children: [_jsx("h3", { className: `text-base font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-1.5`, children: "Tune Your Feed" }), _jsx("p", { className: `text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} leading-relaxed`, children: "Tell the AI how you want your feed to feel, or use a quick preset." })] }), _jsx("div", { children: _jsx("div", { className: "grid grid-cols-2 gap-2.5", children: SMART_PRESETS.map((preset) => (_jsx("button", { onClick: () => handlePresetClick(preset), disabled: instructionStatus === 'pending', className: `group relative p-3.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left ${theme === 'dark' ? 'border border-white/20 bg-transparent hover:bg-white/10 hover:border-white/40' : 'bg-backgroundSubtle hover:bg-backgroundHover shadow-sm hover:shadow-md'}`, children: _jsxs("div", { className: "flex items-start gap-2.5", children: [_jsx("span", { className: "text-xl", children: preset.icon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: `text-xs font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'}`, children: preset.label }), _jsx("div", { className: `text-[10px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-1 leading-snug`, children: preset.description })] })] }) }, preset.id))) }) }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("div", { className: "flex items-center justify-between mb-2", children: _jsxs("div", { children: [_jsx("p", { className: `text-[10px] font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-textLabel'} uppercase tracking-wider`, children: "Your Interests" }), _jsx("p", { className: `text-[11px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} mt-0.5`, children: "AI extracts interests from your instructions. Click \u2715 to remove." })] }) }), _jsxs("div", { className: "flex flex-wrap gap-2 min-h-[32px]", children: [currentInterests.length === 0 && (_jsx("span", { className: `text-[11px] ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} italic`, children: "No interests yet. Tell the AI what you want to see." })), currentInterests.map((interest) => (_jsxs("button", { onClick: () => handleInterestRemove(interest), className: "px-3 py-1 text-[11px] rounded-full bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors flex items-center gap-1", disabled: isSavingInterest, children: [_jsx("span", { children: interest }), _jsx("span", { className: "text-[10px]", children: "\u2715" })] }, interest)))] })] }), _jsxs("div", { className: "relative", children: [_jsx("textarea", { className: `w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 transition-all resize-none ${theme === 'dark' ? 'border border-white/20 bg-white/5 text-white placeholder:text-white/50 focus:border-accent/60 focus:bg-white/10 focus:ring-accent/20' : 'bg-backgroundSubtle text-textPrimary placeholder:text-textMuted/50 focus:border-accent/60 focus:border focus:ring-accent/20'}`, placeholder: "Tell the AI what you want... e.g. 'Show me react tutorials and AI research', 'More design content, less politics', 'Prioritize startup funding posts'", value: instructionInput, onChange: (e) => setInstructionInput(e.target.value), onKeyDown: handleInstructionKeyDown, disabled: instructionStatus === 'pending', rows: 3 }), _jsx("button", { onClick: () => handleInstructionSubmit(), disabled: instructionStatus === 'pending' || !instructionInput.trim(), className: "absolute bottom-3 right-3 px-4 py-1.5 rounded-md bg-accent text-white text-xs font-semibold hover:bg-accentHover transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-button active:scale-95", children: instructionStatus === 'pending' ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "animate-spin", children: "\u23F3" }), _jsx("span", { children: "Tuning..." })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { children: "\u2728" }), _jsx("span", { children: "Apply" })] })) })] }), instructionError && (_jsx("div", { className: "px-3.5 py-2.5 rounded-lg bg-error/10 border border-error/30", children: _jsx("p", { className: "text-xs text-error font-medium", children: instructionError }) })), instructionStatus === 'success' && instructionFeedback && (_jsx("div", { className: "px-3.5 py-2.5 rounded-lg bg-accent/10 border border-accent/30", children: _jsx("p", { className: "text-xs text-accent font-medium", children: instructionFeedback }) }))] })] }));
};
export default ForYouControls;
