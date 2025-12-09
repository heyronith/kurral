import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import { reviewRequestService } from '../lib/services/reviewRequestService';
import ReviewContextModal from './ReviewContextModal';
const ReviewRequestsPanel = () => {
    const { currentUser } = useUserStore();
    const { theme } = useThemeStore();
    const navigate = useNavigate();
    const [reviewRequests, setReviewRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedChirp, setSelectedChirp] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    useEffect(() => {
        if (currentUser?.id) {
            loadReviewRequests();
        }
    }, [currentUser?.id]);
    const loadReviewRequests = async () => {
        if (!currentUser?.id)
            return;
        setIsLoading(true);
        try {
            const requests = await reviewRequestService.getPendingReviewRequests(currentUser.id);
            setReviewRequests(requests);
        }
        catch (error) {
            console.error('[ReviewRequestsPanel] Error loading review requests:', error);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleReviewClick = (chirp) => {
        setSelectedChirp(chirp);
        setShowReviewModal(true);
    };
    const handleViewPost = (chirpId) => {
        navigate(`/post/${chirpId}`);
    };
    const handleReviewSubmitted = async () => {
        await loadReviewRequests();
        setShowReviewModal(false);
        setSelectedChirp(null);
    };
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high':
                return theme === 'dark'
                    ? 'border-red-500/40 bg-red-500/10'
                    : 'border-red-500/50 bg-red-500/10';
            case 'medium':
                return theme === 'dark'
                    ? 'border-yellow-500/40 bg-yellow-500/10'
                    : 'border-yellow-500/50 bg-yellow-500/10';
            default:
                return theme === 'dark'
                    ? 'border-blue-500/40 bg-blue-500/10'
                    : 'border-blue-500/50 bg-blue-500/10';
        }
    };
    const getPriorityLabel = (priority) => {
        switch (priority) {
            case 'high':
                return 'High Priority';
            case 'medium':
                return 'Medium Priority';
            default:
                return 'Low Priority';
        }
    };
    if (!currentUser) {
        return null;
    }
    // Only show to users with high kurralScore
    const kurralScore = currentUser.kurralScore?.score ?? 0;
    if (kurralScore < 700) {
        return null;
    }
    return (_jsxs("div", { className: `rounded-xl border ${theme === 'dark' ? 'border-darkBorder bg-darkBgElevated/30' : 'border-border bg-backgroundElevated'} p-4 mb-4`, children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-lg", children: "\uD83D\uDD0D" }), _jsx("h3", { className: `text-sm font-semibold ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`, children: "Review Requests" })] }), reviewRequests.length > 0 && (_jsx("span", { className: `text-xs font-medium px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-accent/20 text-accent' : 'bg-accent/10 text-accent'}`, children: reviewRequests.length }))] }), isLoading ? (_jsx("div", { className: `text-center py-4 text-sm ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`, children: "Loading review requests..." })) : reviewRequests.length === 0 ? (_jsxs("div", { className: `text-center py-4 text-sm ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`, children: [_jsx("p", { children: "No pending review requests" }), _jsx("p", { className: "text-xs mt-1", children: "Posts matching your interests will appear here" })] })) : (_jsx("div", { className: "space-y-3", children: reviewRequests.map((request) => (_jsxs("div", { className: `rounded-lg border p-3 ${getPriorityColor(request.priority)} transition-all hover:opacity-80 cursor-pointer`, onClick: () => handleViewPost(request.chirp.id), children: [_jsx("div", { className: "flex items-start justify-between gap-2 mb-2", children: _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "flex items-center gap-2 mb-1", children: _jsx("span", { className: `text-xs font-semibold px-2 py-0.5 rounded ${request.priority === 'high'
                                                ? 'bg-red-500/20 text-red-600'
                                                : request.priority === 'medium'
                                                    ? 'bg-yellow-500/20 text-yellow-600'
                                                    : 'bg-blue-500/20 text-blue-600'}`, children: getPriorityLabel(request.priority) }) }), _jsx("p", { className: `text-sm font-medium line-clamp-2 ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`, children: request.chirp.text || 'Post needs review' }), request.chirp.semanticTopics && request.chirp.semanticTopics.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1 mt-1", children: request.chirp.semanticTopics.slice(0, 2).map((topic, idx) => (_jsx("span", { className: `text-xs px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-white/10 text-darkTextMuted' : 'bg-backgroundElevated text-textMuted'}`, children: topic }, idx))) }))] }) }), _jsxs("div", { className: "flex gap-2 mt-2", children: [_jsx("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        handleReviewClick(request.chirp);
                                    }, className: `flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === 'dark'
                                        ? 'bg-accent/20 text-accent hover:bg-accent/30'
                                        : 'bg-accent/10 text-accent hover:bg-accent/20'}`, children: "Review Now" }), _jsx("button", { onClick: (e) => {
                                        e.stopPropagation();
                                        handleViewPost(request.chirp.id);
                                    }, className: `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${theme === 'dark'
                                        ? 'bg-white/10 text-darkTextPrimary hover:bg-white/20'
                                        : 'bg-backgroundElevated text-textPrimary hover:bg-backgroundElevated/80'}`, children: "View" })] })] }, request.chirp.id))) })), selectedChirp && (_jsx(ReviewContextModal, { open: showReviewModal, onClose: () => {
                    setShowReviewModal(false);
                    setSelectedChirp(null);
                }, chirp: selectedChirp, onSubmitted: handleReviewSubmitted }))] }));
};
export default ReviewRequestsPanel;
