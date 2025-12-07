import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const FeedTabs = ({ activeFeed, onFeedChange }) => {
    return (_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("button", { onClick: () => onFeedChange('latest'), className: `px-3 py-2 text-sm font-medium transition-colors ${activeFeed === 'latest'
                    ? 'text-accent font-semibold'
                    : 'text-textMuted hover:text-textPrimary'}`, children: "Friends" }), _jsx("button", { onClick: () => onFeedChange('forYou'), className: `px-3 py-2 text-sm font-medium transition-colors ${activeFeed === 'forYou'
                    ? 'text-accent font-semibold'
                    : 'text-textMuted hover:text-textPrimary'}`, children: "Curated Kurals" })] }));
};
export default FeedTabs;
