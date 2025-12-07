import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { userService } from '../lib/firestore';
import { useUserStore } from '../store/useUserStore';
const FollowSuggestionsModal = ({ open, onClose }) => {
    const { currentUser, followUser, isFollowing } = useUserStore();
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        let active = true;
        const loadSuggestions = async () => {
            if (!currentUser)
                return;
            setIsLoading(true);
            try {
                const similar = await userService.getUsersWithSimilarInterests(currentUser.interests || [], currentUser.id, 6);
                if (!active)
                    return;
                if (similar.length > 0) {
                    setSuggestions(similar);
                }
                else {
                    const popular = await userService.getPopularAccounts(6);
                    if (!active)
                        return;
                    setSuggestions(popular.filter((user) => user.id !== currentUser.id));
                }
            }
            catch (error) {
                console.error('[FollowSuggestionsModal] Error loading suggestions:', error);
            }
            finally {
                if (active)
                    setIsLoading(false);
            }
        };
        if (open) {
            loadSuggestions();
        }
        return () => {
            active = false;
        };
    }, [open, currentUser]);
    if (!open || !currentUser)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4", children: _jsxs("div", { className: "w-full max-w-lg rounded-3xl border border-border bg-backgroundElevated p-6 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-lg font-semibold text-textPrimary", children: "People to follow" }), _jsx("button", { onClick: onClose, className: "text-xs text-textMuted hover:text-textPrimary", children: "Close" })] }), isLoading ? (_jsx("p", { className: "text-sm text-textMuted", children: "Loading suggestions..." })) : suggestions.length === 0 ? (_jsx("p", { className: "text-sm text-textMuted", children: "No suggestions right now. Try again later." })) : (_jsx("div", { className: "space-y-3", children: suggestions.map((user) => {
                        const following = isFollowing(user.id);
                        return (_jsxs("div", { className: "flex items-center justify-between gap-3 rounded-2xl border border-border p-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-textPrimary", children: user.name }), _jsxs("p", { className: "text-xs text-textMuted", children: ["@", user.handle] }), user.bio && (_jsx("p", { className: "text-[11px] text-textMuted mt-1 line-clamp-2", children: user.bio }))] }), _jsx("button", { type: "button", onClick: () => followUser(user.id), className: `px-3 py-1.5 text-xs font-semibold rounded-lg transition ${following
                                        ? 'border border-border text-textMuted'
                                        : 'bg-gradient-to-r from-primary to-accent text-white hover:from-primaryHover hover:to-accentHover'}`, children: following ? 'Following' : 'Follow' })] }, user.id));
                    }) }))] }) }));
};
export default FollowSuggestionsModal;
