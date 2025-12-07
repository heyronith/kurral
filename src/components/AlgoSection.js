import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
const mixOptions = [
    {
        id: 'mostly-following',
        label: 'Mostly Following',
        description: 'Lean into people you already follow.',
    },
    {
        id: 'mixed',
        label: 'Mixed',
        description: 'Blend Following with Everyone.',
    },
    {
        id: 'mostly-everyone',
        label: 'Mostly Everyone',
        description: 'See more from the wider network.',
    },
];
const topicOptions = ['dev', 'startups', 'music', 'sports'];
const mutedOptions = ['politics', 'crypto'];
const AlgoSection = () => {
    const [mix, setMix] = useState('mixed');
    const [boostPeople, setBoostPeople] = useState(true);
    const [boostActive, setBoostActive] = useState(true);
    const [topics, setTopics] = useState(new Set(['dev', 'startups']));
    const [muted, setMuted] = useState(new Set(['politics']));
    const summary = useMemo(() => {
        const mixLabel = mix.split('-').join(' ');
        const parts = [
            `Your For You feed is currently ${mixLabel}`,
            boostPeople ? 'boosting people you talk to' : '',
            boostActive ? 'prioritizing active conversations' : '',
        ].filter(Boolean);
        const topicList = Array.from(topics).map((topic) => `#${topic}`).join(', ');
        const mutedList = Array.from(muted).map((topic) => `#${topic}`).join(', ');
        if (topicList)
            parts.push(`showing ${topicList}`);
        if (mutedList)
            parts.push(`muting ${mutedList}`);
        return `${parts.join(', ')}.`;
    }, [boostActive, boostPeople, mix, muted, topics]);
    const toggleTopic = (topic, collection, setter) => {
        const next = new Set(collection);
        if (next.has(topic)) {
            next.delete(topic);
        }
        else {
            next.add(topic);
        }
        setter(next);
    };
    return (_jsxs("section", { id: "algorithm", className: "section-container grid gap-12 py-20 lg:grid-cols-2", children: [_jsxs("div", { className: "space-y-6", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-textLabel", children: "The algorithm" }), _jsx("h2", { className: "text-3xl font-semibold text-textPrimary", children: "The Algorithm (For You, not for us)" }), _jsx("p", { className: "text-textMuted", children: "Kural doesn't run a giant AI to guess what will hook you. Latest stays chronological. For You is the only ranked feed - and you can see, tweak, and trust every rule that powers it." }), _jsxs("ul", { className: "list-disc space-y-3 pl-6 text-sm text-textMuted", children: [_jsx("li", { children: "Signals are simple: Following, Everyone, tags you care about, and active conversations." }), _jsx("li", { children: "No long posts to boost - every post is short, so we focus on what it's about and who it's from." }), _jsx("li", { children: "Every ranked post carries a tiny \"because\u2026\" chip so you always know why it showed up." })] })] }), _jsxs("div", { className: "card-surface space-y-6 p-6", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-textPrimary", children: "For You controls" }), _jsx("span", { className: "text-xs text-textLabel", children: "Live preview" })] }), _jsx("div", { className: "flex gap-2", children: mixOptions.map((option) => (_jsx("button", { onClick: () => setMix(option.id), className: `flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${mix === option.id
                                        ? 'border-accent bg-accent/10 text-accent'
                                        : 'border-border text-textMuted hover:border-accent/40 hover:text-textPrimary'}`, children: option.label }, option.id))) })] }), _jsxs("div", { className: "space-y-4", children: [_jsx(ToggleRow, { label: "Boost people you talk to", description: "Prioritize posts from people you've commented with recently.", enabled: boostPeople, onToggle: () => setBoostPeople((prev) => !prev) }), _jsx(ToggleRow, { label: "Boost active conversations", description: "Prioritize posts with fresh replies.", enabled: boostActive, onToggle: () => setBoostActive((prev) => !prev) })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm font-semibold text-textPrimary", children: "Topics to show more" }), _jsx("div", { className: "flex flex-wrap gap-2", children: topicOptions.map((topic) => (_jsxs("button", { onClick: () => toggleTopic(topic, topics, setTopics), className: `rounded-full border px-3 py-1 text-sm capitalize transition ${topics.has(topic)
                                        ? 'border-accent bg-accent/10 text-accent'
                                        : 'border-border text-textMuted hover:text-textPrimary'}`, children: ["#", topic] }, topic))) })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm font-semibold text-textPrimary", children: "Muted topics" }), _jsx("div", { className: "flex flex-wrap gap-2", children: mutedOptions.map((topic) => (_jsxs("button", { onClick: () => toggleTopic(topic, muted, setMuted), className: `rounded-full border px-3 py-1 text-sm capitalize transition ${muted.has(topic)
                                        ? 'border-border bg-border/20 text-textMuted'
                                        : 'border-border text-textMuted hover:border-accent/40 hover:text-textPrimary'}`, children: ["#", topic] }, topic))) })] }), _jsx("div", { className: "rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-textMuted", children: summary })] })] }));
};
const ToggleRow = ({ label, description, enabled, onToggle, }) => (_jsxs("div", { className: "flex items-start justify-between gap-4 rounded-2xl border border-border/70 p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-textPrimary", children: label }), _jsx("p", { className: "text-xs text-textMuted", children: description })] }), _jsx("button", { type: "button", onClick: onToggle, className: `relative h-6 w-12 rounded-full border transition ${enabled ? 'border-accent bg-accent/20' : 'border-border'}`, children: _jsx("span", { className: `absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${enabled ? 'translate-x-6' : 'translate-x-1'}` }) })] }));
export default AlgoSection;
