import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Tuning Suggestion Modal - Shows AI suggestions for algorithm tuning
import { useState } from 'react';
import { tuningService } from '../lib/services/tuningService';
const TuningSuggestionModal = ({ suggestion, onClose, onApply }) => {
    const [isApplying, setIsApplying] = useState(false);
    const handleApply = async () => {
        setIsApplying(true);
        try {
            tuningService.applySuggestion(suggestion);
            onApply();
        }
        catch (error) {
            console.error('Error applying suggestion:', error);
        }
        finally {
            setIsApplying(false);
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm", children: _jsxs("div", { className: "bg-background border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-xl font-semibold text-textPrimary", children: "Feed Algorithm Suggestion" }), _jsx("button", { onClick: onClose, className: "text-textMuted hover:text-textPrimary transition-colors", "aria-label": "Close", children: "\u2715" })] }), _jsxs("div", { className: "mb-4", children: [_jsx("p", { className: "text-sm text-textMuted mb-4", children: suggestion.explanation }), _jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-textMuted", children: "Following boost:" }), _jsx("span", { className: "text-textPrimary capitalize", children: suggestion.followingWeight })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-textMuted", children: "Boost active conversations:" }), _jsx("span", { className: "text-textPrimary", children: suggestion.boostActiveConversations ? 'On' : 'Off' })] }), suggestion.likedTopics.length > 0 && (_jsxs("div", { children: [_jsx("span", { className: "text-textMuted block mb-1", children: "Suggested liked topics:" }), _jsx("div", { className: "flex flex-wrap gap-2", children: suggestion.likedTopics.map(topic => (_jsxs("span", { className: "px-2 py-1 bg-primary/20 text-primary rounded text-xs", children: ["#", topic] }, topic))) })] })), suggestion.mutedTopics.length > 0 && (_jsxs("div", { children: [_jsx("span", { className: "text-textMuted block mb-1", children: "Suggested muted topics:" }), _jsx("div", { className: "flex flex-wrap gap-2", children: suggestion.mutedTopics.map(topic => (_jsxs("span", { className: "px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs", children: ["#", topic] }, topic))) })] })), _jsx("div", { className: "pt-2 border-t border-border", children: _jsxs("span", { className: "text-xs text-textMuted", children: ["Confidence: ", (suggestion.confidence * 100).toFixed(0), "%"] }) })] })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleApply, disabled: isApplying, className: "flex-1 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed", children: isApplying ? 'Applying...' : 'Apply Suggestions' }), _jsx("button", { onClick: onClose, className: "px-4 py-2 bg-background/50 text-textMuted rounded hover:bg-background/70 transition-colors", children: "Later" })] })] }) }));
};
export default TuningSuggestionModal;
