import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const topics = ['dev', 'startups', 'music', 'sports', 'productivity', 'design', 'politics', 'crypto'];
const Composer = () => {
    const [text, setText] = useState('');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [reachMode, setReachMode] = useState('forAll');
    const [tunedAudience, setTunedAudience] = useState({
        allowFollowers: true,
        allowNonFollowers: false,
    });
    const charLimit = 280;
    const remaining = charLimit - text.length;
    const canPost = text.trim().length > 0 && selectedTopic !== '';
    const handlePost = () => {
        if (!canPost)
            return;
        // Will be implemented in Step 2
        console.log('Post chirp:', { text, selectedTopic, reachMode, tunedAudience });
    };
    return (_jsxs("div", { className: "border-b border-border p-4", children: [_jsx("textarea", { value: text, onChange: (e) => setText(e.target.value.slice(0, charLimit)), placeholder: "What's happening?", className: "w-full bg-transparent text-textPrimary placeholder-textMuted resize-none outline-none mb-3", rows: 3 }), _jsx("div", { className: "flex flex-wrap gap-2 mb-3", children: topics.map((topic) => (_jsxs("button", { onClick: () => setSelectedTopic(topic), className: `px-3 py-1 text-xs rounded transition-colors ${selectedTopic === topic
                        ? 'bg-primary text-white'
                        : 'bg-background/50 text-textMuted hover:bg-background/70'}`, children: ["#", topic] }, topic))) }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-textMuted", children: "Reach:" }), _jsx("button", { onClick: () => setReachMode('forAll'), className: `px-3 py-1 text-xs rounded transition-colors ${reachMode === 'forAll'
                                            ? 'bg-primary text-white'
                                            : 'bg-background/50 text-textMuted hover:bg-background/70'}`, children: "For All" }), _jsx("button", { onClick: () => setReachMode('tuned'), className: `px-3 py-1 text-xs rounded transition-colors ${reachMode === 'tuned'
                                            ? 'bg-primary text-white'
                                            : 'bg-background/50 text-textMuted hover:bg-background/70'}`, children: "Tuned" })] }), reachMode === 'tuned' && (_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsxs("label", { className: "flex items-center gap-1 text-textMuted", children: [_jsx("input", { type: "checkbox", checked: tunedAudience.allowFollowers, onChange: (e) => setTunedAudience({ ...tunedAudience, allowFollowers: e.target.checked }), className: "rounded" }), "Followers"] }), _jsxs("label", { className: "flex items-center gap-1 text-textMuted", children: [_jsx("input", { type: "checkbox", checked: tunedAudience.allowNonFollowers, onChange: (e) => setTunedAudience({ ...tunedAudience, allowNonFollowers: e.target.checked }), className: "rounded" }), "Non-followers"] }), ] }))] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: `text-sm ${remaining < 20 ? 'text-warning' : 'text-textMuted'}`, children: remaining }), _jsx("button", { onClick: handlePost, disabled: !canPost, className: `px-4 py-2 rounded font-medium transition-colors ${canPost
                                    ? 'bg-primary text-white hover:bg-primary/90'
                                    : 'bg-background/50 text-textMuted cursor-not-allowed'}`, children: "Post" })] })] })] }));
};
export default Composer;
