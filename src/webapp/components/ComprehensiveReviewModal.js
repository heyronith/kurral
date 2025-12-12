import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { reviewContextService } from '../lib/firestore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
const ComprehensiveReviewModal = ({ open, onClose, chirp, onSubmitted }) => {
    const [action, setAction] = useState(null);
    const [sources, setSources] = useState('');
    const [context, setContext] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [reviewContexts, setReviewContexts] = useState([]);
    const [loadingContexts, setLoadingContexts] = useState(false);
    const { currentUser } = useUserStore();
    const { theme } = useThemeStore();
    useEffect(() => {
        if (open) {
            setAction(null);
            setSources('');
            setContext('');
            setError('');
            loadReviewContexts();
        }
    }, [open, chirp.id]);
    const loadReviewContexts = async () => {
        setLoadingContexts(true);
        try {
            const contexts = await reviewContextService.getReviewContextsForChirp(chirp.id);
            setReviewContexts(contexts);
        }
        catch (error) {
            console.error('[ComprehensiveReviewModal] Error loading review contexts:', error);
        }
        finally {
            setLoadingContexts(false);
        }
    };
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
            // Reload review contexts
            await loadReviewContexts();
            // Reset form
            setAction(null);
            setSources('');
            setContext('');
            onSubmitted?.();
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
    const MIN_REVIEWS_REQUIRED = 50;
    const reviewCount = reviewContexts.length;
    const validateCount = reviewContexts.filter(r => r.action === 'validate').length;
    const invalidateCount = reviewContexts.filter(r => r.action === 'invalidate').length;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", children: _jsx("div", { className: "bg-background rounded-2xl border border-border shadow-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h2", { className: "text-xl font-bold text-textPrimary", children: "Review Post" }), _jsx("button", { onClick: onClose, className: `w-8 h-8 flex items-center justify-center rounded-full transition-colors text-textMuted hover:text-textPrimary ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-backgroundElevated/60'}`, "aria-label": "Close", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", className: "w-5 h-5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "mb-6 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg", children: [_jsxs("p", { className: "text-sm text-textPrimary mb-1", children: ["This post has been marked as ", _jsx("strong", { children: "Needs Review" }), ". Review the fact-check results below and add your assessment."] }), _jsxs("p", { className: "text-xs text-textMuted", children: ["Status will be updated once ", MIN_REVIEWS_REQUIRED, " reviews are collected and consensus is reached. Current: ", reviewCount, "/", MIN_REVIEWS_REQUIRED, " reviews."] })] }), chirp.claims && chirp.claims.length > 0 && (_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-sm font-semibold text-textPrimary mb-3", children: "Claims & Verification" }), _jsx("div", { className: "space-y-3", children: chirp.claims.map((claim) => {
                                    const factCheck = chirp.factChecks?.find((fc) => fc.claimId === claim.id);
                                    return (_jsxs("div", { className: "p-4 bg-backgroundElevated/40 rounded-lg border border-border/50", children: [_jsxs("div", { className: "flex items-start justify-between gap-2 mb-2", children: [_jsx("p", { className: "text-sm text-textPrimary flex-1", children: claim.text }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [_jsx("span", { className: "text-xs px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50", children: claim.type }), _jsx("span", { className: "text-xs px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50", children: claim.domain })] })] }), factCheck && (_jsxs("div", { className: "mt-3 pt-3 border-t border-border/50", children: [_jsxs("div", { className: "flex items-center gap-3 mb-2", children: [_jsx("span", { className: `text-xs font-semibold px-2 py-1 rounded ${factCheck.verdict === 'true'
                                                                    ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                                                    : factCheck.verdict === 'false'
                                                                        ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                                                                        : factCheck.verdict === 'mixed'
                                                                            ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                                                                            : 'bg-backgroundElevated/60 text-textMuted border border-border/50'}`, children: factCheck.verdict.toUpperCase() }), _jsxs("span", { className: "text-xs text-textMuted", children: [(factCheck.confidence * 100).toFixed(0), "% confidence"] })] }), factCheck.evidence && factCheck.evidence.length > 0 && (_jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("p", { className: "text-xs font-semibold text-textPrimary mb-1", children: "Evidence:" }), factCheck.evidence.map((evidence, idx) => (_jsxs("div", { className: "text-xs text-textMuted bg-background/50 p-2 rounded border border-border/30", children: [_jsx("div", { className: "font-medium text-textSecondary mb-1", children: evidence.source }), _jsx("div", { className: "text-textMuted mb-1", children: evidence.snippet }), evidence.url && (_jsx("a", { href: evidence.url, target: "_blank", rel: "noopener noreferrer", className: "text-primary hover:underline inline-flex items-center gap-1", children: "View source \u2192" }))] }, idx)))] })), factCheck.caveats && factCheck.caveats.length > 0 && (_jsxs("div", { className: "mt-2 text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded border border-yellow-500/20", children: [_jsx("strong", { children: "Note:" }), " ", factCheck.caveats.join(' ')] }))] }))] }, claim.id));
                                }) })] })), _jsxs("div", { className: "mb-6", children: [_jsxs("h3", { className: "text-sm font-semibold text-textPrimary mb-3", children: ["Existing Reviews (", reviewCount, "/", MIN_REVIEWS_REQUIRED, " required)"] }), loadingContexts ? (_jsx("div", { className: "text-sm text-textMuted text-center py-4", children: "Loading reviews..." })) : reviewContexts.length > 0 ? (_jsx("div", { className: "space-y-3 max-h-48 overflow-y-auto", children: reviewContexts.map((review) => (_jsxs("div", { className: `p-3 rounded-lg border ${review.action === 'validate'
                                        ? 'bg-green-500/10 border-green-500/20'
                                        : 'bg-red-500/10 border-red-500/20'}`, children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: `text-lg ${review.action === 'validate' ? 'text-green-600' : 'text-red-600'}`, children: review.action === 'validate' ? '✓' : '✗' }), _jsx("span", { className: `text-xs font-semibold ${review.action === 'validate' ? 'text-green-600' : 'text-red-600'}`, children: review.action === 'validate' ? 'Validated' : 'Invalidated' }), _jsx("span", { className: "text-xs text-textMuted", children: new Date(review.createdAt).toLocaleDateString() })] }), review.sources && review.sources.length > 0 && (_jsxs("div", { className: "mt-1", children: [_jsx("p", { className: "text-xs font-semibold text-textPrimary mb-1", children: "Sources:" }), _jsxs("ul", { className: "space-y-0.5", children: [review.sources.slice(0, 2).map((source, idx) => (_jsx("li", { children: _jsx("a", { href: source, target: "_blank", rel: "noopener noreferrer", className: "text-xs text-primary hover:underline break-all", children: source }) }, idx))), review.sources.length > 2 && (_jsxs("li", { className: "text-xs text-textMuted", children: ["+", review.sources.length - 2, " more"] }))] })] }))] }, review.id))) })) : (_jsx("div", { className: "text-sm text-textMuted text-center py-4", children: "No reviews yet. Be the first to review this post." })), reviewContexts.length > 0 && (_jsxs("div", { className: "mt-3 text-xs text-textMuted", children: ["Summary: ", validateCount, " validate, ", invalidateCount, " invalidate"] }))] }), currentUser && currentUser.id !== chirp.authorId && (_jsxs("div", { className: "border-t border-border/50 pt-6", children: [_jsx("h3", { className: "text-sm font-semibold text-textPrimary mb-4", children: "Add Your Review" }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-textPrimary mb-3", children: "Your assessment:" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { type: "button", onClick: () => setAction('validate'), className: `flex-1 px-4 py-3 rounded-lg border-2 transition-all ${action === 'validate'
                                                            ? 'border-green-500 bg-green-500/10 text-green-600'
                                                            : 'border-border bg-backgroundElevated/60 text-textPrimary hover:border-green-500/50'}`, children: _jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("span", { className: "text-xl", children: "\u2713" }), _jsx("span", { className: "font-semibold text-sm", children: "Validate Claim" })] }) }), _jsx("button", { type: "button", onClick: () => setAction('invalidate'), className: `flex-1 px-4 py-3 rounded-lg border-2 transition-all ${action === 'invalidate'
                                                            ? 'border-red-500 bg-red-500/10 text-red-600'
                                                            : 'border-border bg-backgroundElevated/60 text-textPrimary hover:border-red-500/50'}`, children: _jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("span", { className: "text-xl", children: "\u2717" }), _jsx("span", { className: "font-semibold text-sm", children: "Invalidate Claim" })] }) })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "sources", className: "block text-sm font-medium text-textPrimary mb-2", children: "Sources * (URLs, one per line or comma-separated)" }), _jsx("textarea", { id: "sources", value: sources, onChange: (e) => setSources(e.target.value), placeholder: "https://example.com/source1\nhttps://example.com/source2", className: "w-full px-4 py-3 bg-backgroundElevated/60 border border-border rounded-lg text-textPrimary placeholder-textMuted resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary font-mono text-sm", rows: 4, disabled: loading, required: true }), _jsx("div", { className: "mt-1 text-xs text-textMuted", children: "Provide at least one source URL supporting your assessment. URLs must start with http:// or https://" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "context", className: "block text-sm font-medium text-textPrimary mb-2", children: "Additional context (required, min 20 chars)" }), _jsx("textarea", { id: "context", value: context, onChange: (e) => setContext(e.target.value), placeholder: "Any additional explanation or context...", className: "w-full px-4 py-3 bg-backgroundElevated/60 border border-border rounded-lg text-textPrimary placeholder-textMuted resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary", rows: 3, maxLength: 500, disabled: loading, required: true }), _jsxs("div", { className: "mt-1 text-xs text-textMuted text-right", children: [context.length, "/500 characters"] })] }), _jsxs("div", { className: "flex items-center gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: onClose, className: `flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-border text-textPrimary ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-backgroundElevated/60 hover:bg-backgroundElevated/80'}`, disabled: loading, children: "Cancel" }), _jsx("button", { type: "submit", className: `flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed ${action === 'validate'
                                                    ? 'bg-green-600 hover:bg-green-700'
                                                    : action === 'invalidate'
                                                        ? 'bg-red-600 hover:bg-red-700'
                                                        : 'bg-yellow-600 hover:bg-yellow-700'}`, disabled: loading || !action || !sources.trim() || context.trim().length < 20, children: loading ? 'Submitting...' : action ? `Submit ${action === 'validate' ? 'Validation' : 'Invalidation'}` : 'Select Action' })] })] })] }))] }) }) }));
};
export default ComprehensiveReviewModal;
