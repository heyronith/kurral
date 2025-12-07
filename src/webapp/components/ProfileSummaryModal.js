import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useThemeStore } from '../store/useThemeStore';
const ProfileSummaryModal = ({ open, onClose, user }) => {
    const { theme } = useThemeStore();
    if (!open)
        return null;
    const formatDate = (date) => {
        if (!date)
            return 'Never';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1)
            return 'Just now';
        if (diffMins < 60)
            return `${diffMins}m`;
        if (diffHours < 24)
            return `${diffHours}h`;
        if (diffDays < 7)
            return `${diffDays}d`;
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };
    const hasSummary = user.profileSummary && user.profileSummary.trim().length > 0;
    const summaryText = user.profileSummary || '';
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-4", onClick: onClose, children: _jsxs("div", { className: `relative w-full max-w-lg rounded-2xl border shadow-2xl transition-all duration-300 ${theme === 'dark'
                ? 'border-white/10 bg-black/95'
                : 'border-border/40 bg-white/95'}`, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between px-6 pt-6 pb-4 border-b border-transparent", children: [_jsx("h3", { className: `text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`, children: "Summary" }), _jsx("button", { onClick: onClose, className: `p-1.5 rounded-lg transition-colors ${theme === 'dark'
                                ? 'hover:bg-white/10 text-white/70 hover:text-white'
                                : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`, "aria-label": "Close", children: _jsx("svg", { className: "w-5 h-5", fill: "none", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsx("div", { className: "px-6 py-5", children: hasSummary ? (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: `rounded-xl p-5 ${theme === 'dark'
                                    ? 'bg-white/5'
                                    : 'bg-gray-50'}`, children: _jsx("p", { className: `text-[15px] leading-relaxed whitespace-pre-wrap ${theme === 'dark' ? 'text-white/90' : 'text-gray-800'}`, children: summaryText }) }), _jsx("div", { className: `flex items-center gap-4 text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`, children: _jsx("span", { children: formatDate(user.profileSummaryUpdatedAt) }) })] })) : (_jsx("div", { className: `text-center py-12 rounded-xl ${theme === 'dark'
                            ? 'bg-white/5'
                            : 'bg-gray-50'}`, children: _jsx("p", { className: `text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`, children: "No summary available" }) })) })] }) }));
};
export default ProfileSummaryModal;
