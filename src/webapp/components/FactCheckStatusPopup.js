import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { reviewContextService } from '../lib/firestore';
import ReviewContextModal from './ReviewContextModal';
import { useUserStore } from '../store/useUserStore';
const FactCheckStatusPopup = ({ open, onClose, chirp, onChirpUpdated }) => {
    const [reviewContexts, setReviewContexts] = useState([]);
    const [loadingContexts, setLoadingContexts] = useState(false);
    const [showReviewContextModal, setShowReviewContextModal] = useState(false);
    const { currentUser } = useUserStore();
    useEffect(() => {
        if (open && chirp) {
            loadReviewContexts();
        }
    }, [open, chirp]);
    const loadReviewContexts = async () => {
        setLoadingContexts(true);
        try {
            const contexts = await reviewContextService.getReviewContextsForChirp(chirp.id);
            setReviewContexts(contexts);
        }
        catch (error) {
            console.error('[FactCheckStatusPopup] Error loading review contexts:', error);
        }
        finally {
            setLoadingContexts(false);
        }
    };
    if (!open)
        return null;
    const getStatusInfo = () => {
        switch (chirp.factCheckStatus) {
            case 'clean':
                return {
                    icon: '✓',
                    label: 'Verified',
                    color: 'text-green-600',
                    bgColor: 'bg-green-500/10',
                    borderColor: 'border-green-500/20',
                };
            case 'needs_review':
                return {
                    icon: '⚠',
                    label: 'Needs Review',
                    color: 'text-yellow-600',
                    bgColor: 'bg-yellow-500/10',
                    borderColor: 'border-yellow-500/20',
                };
            case 'blocked':
                return {
                    icon: '✗',
                    label: 'Blocked',
                    color: 'text-red-600',
                    bgColor: 'bg-red-500/10',
                    borderColor: 'border-red-500/20',
                };
            default:
                return null;
        }
    };
    const statusInfo = getStatusInfo();
    if (!statusInfo)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm", onClick: onClose, children: [_jsx("div", { className: "bg-background rounded-2xl border border-border shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto", onClick: (e) => e.stopPropagation(), children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: `w-10 h-10 rounded-full ${statusInfo.bgColor} ${statusInfo.borderColor} border-2 flex items-center justify-center text-xl`, children: statusInfo.icon }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-textPrimary", children: "Fact-Check Status" }), _jsx("p", { className: `text-sm font-medium ${statusInfo.color}`, children: statusInfo.label })] })] }), _jsx("button", { onClick: onClose, className: "w-8 h-8 flex items-center justify-center rounded-full hover:bg-backgroundElevated/60 transition-colors text-textMuted hover:text-textPrimary", "aria-label": "Close", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", className: "w-5 h-5", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), chirp.claims && chirp.claims.length > 0 && (_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-sm font-semibold text-textPrimary mb-3", children: "Claims & Verification" }), _jsx("div", { className: "space-y-3", children: chirp.claims.map((claim) => {
                                        const factCheck = chirp.factChecks?.find((fc) => fc.claimId === claim.id);
                                        return (_jsxs("div", { className: "p-4 bg-backgroundElevated/40 rounded-lg border border-border/50", children: [_jsxs("div", { className: "flex items-start justify-between gap-2 mb-2", children: [_jsx("p", { className: "text-sm text-textPrimary flex-1", children: claim.text }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [_jsx("span", { className: "text-xs px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50", children: claim.type }), _jsx("span", { className: "text-xs px-2 py-0.5 bg-backgroundElevated/60 text-textMuted rounded border border-border/50", children: claim.domain })] })] }), factCheck && (_jsxs("div", { className: "mt-3 pt-3 border-t border-border/50", children: [_jsxs("div", { className: "flex items-center gap-3 mb-2", children: [_jsx("span", { className: `text-xs font-semibold px-2 py-1 rounded ${factCheck.verdict === 'true'
                                                                        ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                                                        : factCheck.verdict === 'false'
                                                                            ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                                                                            : factCheck.verdict === 'mixed'
                                                                                ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20'
                                                                                : 'bg-backgroundElevated/60 text-textMuted border border-border/50'}`, children: factCheck.verdict.toUpperCase() }), _jsxs("span", { className: "text-xs text-textMuted", children: [(factCheck.confidence * 100).toFixed(0), "% confidence"] })] }), factCheck.evidence && factCheck.evidence.length > 0 && (_jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("p", { className: "text-xs font-semibold text-textPrimary mb-1", children: "Evidence:" }), factCheck.evidence.map((evidence, idx) => (_jsxs("div", { className: "text-xs text-textMuted bg-background/50 p-2 rounded border border-border/30", children: [_jsx("div", { className: "font-medium text-textSecondary mb-1", children: evidence.source }), _jsx("div", { className: "text-textMuted mb-1", children: evidence.snippet }), evidence.url && (_jsx("a", { href: evidence.url, target: "_blank", rel: "noopener noreferrer", className: "text-primary hover:underline inline-flex items-center gap-1", children: "View source \u2192" }))] }, idx)))] })), factCheck.caveats && factCheck.caveats.length > 0 && (_jsxs("div", { className: "mt-2 text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded border border-yellow-500/20", children: [_jsx("strong", { children: "Note:" }), " ", factCheck.caveats.join(' ')] }))] }))] }, claim.id));
                                    }) })] })), chirp.factCheckStatus === 'needs_review' && currentUser && currentUser.id !== chirp.authorId && (_jsx("div", { className: "mb-6 pb-6 border-b border-border/50", children: _jsx("button", { onClick: () => {
                                    setShowReviewContextModal(true);
                                }, className: "w-full px-4 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 transition-colors text-sm font-medium", children: "Add Context for Review" }) })), loadingContexts ? (_jsx("div", { className: "text-sm text-textMuted text-center py-4", children: "Loading review contexts..." })) : reviewContexts.length > 0 ? (_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-sm font-semibold text-textPrimary mb-3", children: "User Reviews" }), _jsx("div", { className: "space-y-3", children: reviewContexts.map((review) => (_jsxs("div", { className: `p-4 rounded-lg border ${review.action === 'validate'
                                            ? 'bg-green-500/10 border-green-500/20'
                                            : 'bg-red-500/10 border-red-500/20'}`, children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: `text-lg ${review.action === 'validate' ? 'text-green-600' : 'text-red-600'}`, children: review.action === 'validate' ? '✓' : '✗' }), _jsx("span", { className: `text-sm font-semibold ${review.action === 'validate' ? 'text-green-600' : 'text-red-600'}`, children: review.action === 'validate' ? 'Validated' : 'Invalidated' }), _jsx("span", { className: "text-xs text-textMuted", children: new Date(review.createdAt).toLocaleDateString() })] }), review.sources && review.sources.length > 0 && (_jsxs("div", { className: "mt-2", children: [_jsx("p", { className: "text-xs font-semibold text-textPrimary mb-1", children: "Sources:" }), _jsx("ul", { className: "space-y-1", children: review.sources.map((source, idx) => (_jsx("li", { children: _jsx("a", { href: source, target: "_blank", rel: "noopener noreferrer", className: "text-xs text-primary hover:underline break-all", children: source }) }, idx))) })] })), review.context && (_jsxs("div", { className: "mt-2 text-xs text-textMuted", children: [_jsx("p", { className: "font-semibold text-textPrimary mb-1", children: "Context:" }), _jsx("p", { children: review.context })] }))] }, review.id))) })] })) : null, !chirp.claims || chirp.claims.length === 0 ? (_jsx("div", { className: "text-sm text-textMuted text-center py-4", children: "No claims have been extracted from this post yet." })) : null] }) }), _jsx(ReviewContextModal, { open: showReviewContextModal, onClose: () => setShowReviewContextModal(false), chirp: chirp, onSubmitted: async () => {
                    // Reload review contexts after submission
                    await loadReviewContexts();
                    // Notify parent that chirp may have been updated
                    onChirpUpdated?.(chirp);
                } })] }));
};
export default FactCheckStatusPopup;
