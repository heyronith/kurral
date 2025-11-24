import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useUserStore } from '../store/useUserStore';
const ChirpCard = ({ chirp }) => {
    const { getUser } = useUserStore();
    const author = getUser(chirp.authorId);
    const formatTime = (date) => {
        const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
        if (minutesAgo < 1)
            return 'now';
        if (minutesAgo < 60)
            return `${minutesAgo}m`;
        const hoursAgo = Math.floor(minutesAgo / 60);
        if (hoursAgo < 24)
            return `${hoursAgo}h`;
        const daysAgo = Math.floor(hoursAgo / 24);
        return `${daysAgo}d`;
    };
    const getReachLabel = () => {
        if (chirp.reachMode === 'forAll') {
            return 'Reach: For All';
        }
        if (chirp.tunedAudience) {
            const parts = [];
            if (chirp.tunedAudience.allowFollowers)
                parts.push('followers');
            if (chirp.tunedAudience.allowNonFollowers)
                parts.push('non-followers');
            return `Reach: Tuned (${parts.join(', ')})`;
        }
        return 'Reach: Tuned';
    };
    if (!author)
        return null;
    return (_jsx("div", { className: "border-b border-border p-4 hover:bg-background/50 transition-colors", children: _jsx("div", { className: "flex gap-3", children: _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: "font-semibold text-textPrimary", children: author.name }), _jsx("span", { className: "text-textMuted text-sm", children: author.handle }), _jsx("span", { className: "text-textMuted text-sm", children: "\u00B7" }), _jsx("span", { className: "text-textMuted text-sm", children: formatTime(chirp.createdAt) })] }), _jsx("p", { className: "text-textPrimary mb-2 whitespace-pre-wrap", children: chirp.text }), _jsxs("div", { className: "flex items-center gap-3 mb-2", children: [_jsxs("span", { className: "text-xs px-2 py-1 bg-primary/20 text-primary rounded", children: ["#", chirp.topic] }), _jsx("span", { className: "text-xs text-textMuted", children: getReachLabel() })] }), _jsxs("div", { className: "flex items-center gap-6 text-sm text-textMuted", children: [_jsx("button", { className: "hover:text-primary transition-colors", children: "Reply" }), _jsx("button", { className: "hover:text-primary transition-colors", children: "Rechirp" }), _jsx("button", { className: "hover:text-primary transition-colors", children: "Tune" })] })] }) }) }));
};
export default ChirpCard;
