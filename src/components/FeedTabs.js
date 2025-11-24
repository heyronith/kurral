import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const FeedTabs = ({ activeFeed, onFeedChange }) => {
    return (_jsxs("div", { className: "flex border-b border-border", children: [_jsx("button", { onClick: () => onFeedChange('latest'), className: `flex-1 px-4 py-3 text-center font-medium transition-colors ${activeFeed === 'latest'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-textMuted hover:text-textPrimary'}`, children: "Latest" }), _jsx("button", { onClick: () => onFeedChange('forYou'), className: `flex-1 px-4 py-3 text-center font-medium transition-colors ${activeFeed === 'forYou'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-textMuted hover:text-textPrimary'}`, children: "For You" })] }));
};
export default FeedTabs;
