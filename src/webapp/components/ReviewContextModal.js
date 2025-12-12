import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { reviewContextService } from '../lib/firestore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
const ReviewContextModal = ({ open, onClose, chirp, onSubmitted }) => {
    const [action, setAction] = useState(null);
    const [sources, setSources] = useState('');
    const [context, setContext] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { currentUser } = useUserStore();
    const { theme } = useThemeStore();
    useEffect(() => {
        if (open) {
            setAction(null);
            setSources('');
            setContext('');
            setError('');
        }
    }, [open]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser) {
            setError('You must be logged in to submit a review');
            return;
        }
        if (!action) {
            setError('Please select whether to validate or invalidate the claim');
            return;
        }
        // Parse sources - split by newline or comma, filter empty strings
        const sourcesArray = sources
            .split(/[,\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 0);
        if (sourcesArray.length === 0) {
            setError('Please provide at least one source URL');
            return;
        }
        // Validate URLs
        const urlPattern = /^https?:\/\/.+/i;
        const invalidUrls = sourcesArray.filter(url => !urlPattern.test(url));
        if (invalidUrls.length > 0) {
            setError(`Invalid URL(s): ${invalidUrls.join(', ')}. URLs must start with http:// or https://`);
            return;
        }
        const trimmedContext = context.trim();
        if (trimmedContext.length < 20) {
            setError('Please provide at least 20 characters of context');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await reviewContextService.createReviewContext(chirp.id, currentUser.id, action, sourcesArray, trimmedContext);
            // Reset form
            setAction(null);
            setSources('');
            setContext('');
            onSubmitted?.();
            onClose();
        }
        catch (error) {
            console.error('Error submitting review context:', error);
            setError(error.message || 'Failed to submit review. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", children: _jsx("div", { className: "bg-background rounded-2xl border border-border shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-xl font-bold text-textPrimary", children: "Review Post" }), _jsx("button", { onClick: onClose, className: `w-8 h-8 flex items-center justify-center rounded-full transition-colors text-textMuted hover:text-textPrimary ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'}`, "aria-label": "Close", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", className: "w-5 h-5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsx("div", { className: "mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg", children: _jsxs("p", { className: "text-sm text-textPrimary", children: ["This post has been marked as ", _jsx("strong", { children: "Needs Review" }), ". Help verify the claims by either validating or invalidating them with sources."] }) }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-textPrimary mb-3", children: "Your assessment:" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "button", onClick: () => setAction('validate'), className: `flex-1 px-4 py-3 rounded-lg border-2 transition-all ${action === 'validate'
                                                    ? 'border-green-500 bg-green-500/10 text-green-600'
                                                    : 'border-border bg-backgroundElevated/60 text-textPrimary hover:border-green-500/50'}`, children: _jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("span", { className: "text-xl", children: "\u2713" }), _jsx("span", { className: "font-semibold text-sm", children: "Validate Claim" })] }) }), _jsx("button", { type: "button", onClick: () => setAction('invalidate'), className: `flex-1 px-4 py-3 rounded-lg border-2 transition-all ${action === 'invalidate'
                                                    ? 'border-red-500 bg-red-500/10 text-red-600'
                                                    : 'border-border bg-backgroundElevated/60 text-textPrimary hover:border-red-500/50'}`, children: _jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("span", { className: "text-xl", children: "\u2717" }), _jsx("span", { className: "font-semibold text-sm", children: "Invalidate Claim" })] }) })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "sources", className: "block text-sm font-medium text-textPrimary mb-2", children: "Sources * (URLs, one per line or comma-separated)" }), _jsx("textarea", { id: "sources", value: sources, onChange: (e) => setSources(e.target.value), placeholder: "https://example.com/source1\nhttps://example.com/source2", className: "w-full px-4 py-3 bg-backgroundElevated/60 border border-border rounded-lg text-textPrimary placeholder-textMuted resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono text-sm", rows: 4, disabled: loading, required: true }), _jsx("div", { className: "mt-1 text-xs text-textMuted", children: "Provide at least one source URL supporting your assessment. URLs must start with http:// or https://" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "context", className: "block text-sm font-medium text-textPrimary mb-2", children: "Additional context (required, min 20 chars)" }), _jsx("textarea", { id: "context", value: context, onChange: (e) => setContext(e.target.value), placeholder: "Any additional explanation or context...", className: "w-full px-4 py-3 bg-backgroundElevated/60 border border-border rounded-lg text-textPrimary placeholder-textMuted resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary", rows: 3, maxLength: 500, disabled: loading, required: true }), _jsxs("div", { className: "mt-1 text-xs text-textMuted text-right", children: [context.length, "/500 characters"] })] }), _jsxs("div", { className: "flex items-center gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: `flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-border text-textPrimary ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-backgroundElevated/60 hover:bg-backgroundElevated/80'}`, disabled: loading, children: "Cancel" }), _jsx("button", { type: "submit", className: `flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed ${action === 'validate'
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : action === 'invalidate'
                                                ? 'bg-red-600 hover:bg-red-700'
                                                : 'bg-yellow-600 hover:bg-yellow-700'}`, disabled: loading || !action || !sources.trim() || context.trim().length < 20, children: loading ? 'Submitting...' : action ? `Submit ${action === 'validate' ? 'Validation' : 'Invalidation'}` : 'Select Action' })] })] })] }) }) }));
};
export default ReviewContextModal;
