import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { chirpDataset } from '../data/chirps';
const topicOptions = ['dev', 'startups', 'music', 'sports'];
const mutedOptions = ['politics', 'crypto'];
const InteractiveDemo = () => {
    const [activeTab, setActiveTab] = useState('latest');
    const [mix, setMix] = useState('balanced');
    const [boostPeople, setBoostPeople] = useState(true);
    const [boostActive, setBoostActive] = useState(true);
    const [topicPrefs, setTopicPrefs] = useState(['dev', 'startups']);
    const [mutedTopics, setMutedTopics] = useState(['politics']);
    const latestFeed = useMemo(() => [...chirpDataset].sort((a, b) => a.minutesAgo - b.minutesAgo), []);
    const forYouFeed = useMemo(() => computeForYouFeed(chirpDataset, {
        mix,
        boostPeople,
        boostActive,
        topicPrefs,
        mutedTopics,
    }), [boostActive, boostPeople, mix, mutedTopics, topicPrefs]);
    const feed = activeTab === 'latest' ? latestFeed : forYouFeed;
    const controlsDisabled = activeTab === 'latest';
    const reasonFor = (chirp) => activeTab === 'latest'
        ? 'Because: Latest - pure chronological'
        : buildForYouReason(chirp, { mix, boostPeople, boostActive, topicPrefs });
    const toggleTopic = (topic, list, setter) => {
        if (list.includes(topic)) {
            setter(list.filter((item) => item !== topic));
        }
        else {
            setter([...list, topic]);
        }
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.3em] text-textLabel", children: "Interactive demo" }), _jsx("h2", { className: "text-3xl font-semibold text-textPrimary", children: "Tune For You without leaving Kural" }), _jsx("p", { className: "text-textMuted", children: "Flip between Latest and For You, adjust the controls, and watch the feed update live." })] }), _jsxs("div", { className: "card-surface overflow-hidden rounded-[32px] border border-border/80 bg-[#050911] shadow-card", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-border/70 px-6 py-4 text-sm text-textLabel", children: [_jsx("span", { className: "h-3 w-3 rounded-full bg-red-500" }), _jsx("span", { className: "h-3 w-3 rounded-full bg-yellow-500" }), _jsx("span", { className: "h-3 w-3 rounded-full bg-green-500" }), _jsx("div", { className: "mx-auto text-textMuted", children: "kural.app/demo" })] }), _jsxs("div", { className: "grid gap-8 px-6 py-10 lg:grid-cols-3", children: [_jsxs("div", { className: "space-y-6 lg:col-span-2", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("div", { className: "inline-flex rounded-full border border-border p-1 text-sm", children: ['latest', 'forYou'].map((tab) => (_jsx("button", { onClick: () => setActiveTab(tab), className: `flex-1 rounded-full px-4 py-2 font-semibold capitalize transition ${activeTab === tab ? 'bg-textPrimary text-background' : 'text-textMuted'}`, children: tab === 'latest' ? 'Latest' : 'For You' }, tab))) }), _jsx("p", { className: "text-xs text-textLabel", children: activeTab === 'latest'
                                                    ? 'Latest is pure chronological. No ranking applied.'
                                                    : 'For You reflects your controls. Every change updates the feed.' })] }), _jsx("div", { className: "space-y-4", children: feed.map((chirp) => (_jsx(ChirpCard, { chirp: chirp, reason: reasonFor(chirp) }, chirp.id))) })] }), _jsxs("div", { className: "relative", children: [_jsxs("div", { className: `card-surface space-y-5 p-5 transition ${controlsDisabled ? 'pointer-events-none opacity-40' : 'opacity-100'}`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("p", { className: "text-sm font-semibold text-textPrimary", children: "For You controls" }), _jsx("span", { className: "text-xs text-textLabel", children: "live" })] }), _jsxs("div", { className: "space-y-2 text-xs text-textLabel", children: [_jsx("p", { children: "Following vs Everyone" }), _jsx("div", { className: "flex gap-2", children: [
                                                            { id: 'following', label: 'Mostly Following' },
                                                            { id: 'balanced', label: 'Mixed' },
                                                            { id: 'everyone', label: 'Mostly Everyone' },
                                                        ].map((option) => (_jsx("button", { onClick: () => setMix(option.id), className: `flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${mix === option.id
                                                                ? 'border-accent bg-accent/10 text-accent'
                                                                : 'border-border text-textMuted hover:text-textPrimary'}`, children: option.label }, option.id))) })] }), _jsx(ToggleControl, { label: "Boost people you talk to", description: "Prioritize posts from recent conversations.", enabled: boostPeople, onToggle: () => setBoostPeople((prev) => !prev) }), _jsx(ToggleControl, { label: "Boost active conversations", description: "Lift posts with fresh replies.", enabled: boostActive, onToggle: () => setBoostActive((prev) => !prev) }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.2em] text-textLabel", children: "Topics to prioritize" }), _jsx("div", { className: "flex flex-wrap gap-2", children: topicOptions.map((topic) => (_jsxs("button", { onClick: () => toggleTopic(topic, topicPrefs, setTopicPrefs), className: `rounded-full border px-3 py-1 text-sm capitalize transition ${topicPrefs.includes(topic)
                                                                ? 'border-accent bg-accent/10 text-accent'
                                                                : 'border-border text-textMuted hover:text-textPrimary'}`, children: ["#", topic] }, topic))) })] }), _jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.2em] text-textLabel", children: "Muted topics" }), _jsx("div", { className: "flex flex-wrap gap-2", children: mutedOptions.map((topic) => (_jsxs("button", { onClick: () => toggleTopic(topic, mutedTopics, setMutedTopics), className: `rounded-full border px-3 py-1 text-sm capitalize transition ${mutedTopics.includes(topic)
                                                                ? 'border-border bg-border/30 text-textMuted'
                                                                : 'border-border text-textMuted hover:border-accent/40 hover:text-textPrimary'}`, children: ["#", topic] }, topic))) })] })] }), controlsDisabled && (_jsx("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs text-textLabel", children: "For You controls are only applied when you're in the For You feed." }))] })] })] })] }));
};
const ToggleControl = ({ label, description, enabled, onToggle, }) => (_jsx("div", { className: "rounded-2xl border border-border/70 p-4 text-sm", children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-textPrimary", children: label }), _jsx("p", { className: "text-xs text-textMuted", children: description })] }), _jsx("button", { type: "button", onClick: onToggle, className: `relative h-6 w-11 rounded-full border transition ${enabled ? 'border-accent bg-accent/20' : 'border-border'}`, children: _jsx("span", { className: `absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${enabled ? 'translate-x-5' : 'translate-x-1'}` }) })] }) }));
const computeForYouFeed = (dataset, { mix, boostPeople, boostActive, topicPrefs, mutedTopics, }) => {
    return dataset
        .map((chirp) => {
        const muted = mutedTopics.includes(chirp.topic);
        let score = 100 - chirp.minutesAgo;
        if (mix === 'following') {
            score += chirp.authorFollowed ? 40 : -5;
        }
        else if (mix === 'balanced') {
            score += chirp.authorFollowed ? 25 : 10;
        }
        else {
            score += chirp.authorFollowed ? 10 : 35;
        }
        if (boostPeople && chirp.recentInteraction)
            score += 30;
        if (boostActive && chirp.activeComments)
            score += 25;
        if (topicPrefs.includes(chirp.topic))
            score += 35;
        score += chirp.commentCount;
        if (muted)
            score -= 120;
        return { chirp, score };
    })
        .sort((a, b) => b.score - a.score)
        .map(({ chirp }) => chirp);
};
const buildForYouReason = (chirp, { mix, boostPeople, boostActive, topicPrefs, }) => {
    const reasons = [];
    if (topicPrefs.includes(chirp.topic))
        reasons.push(`topic #${chirp.topic}`);
    if (boostPeople && chirp.recentInteraction)
        reasons.push(`you replied to ${chirp.handle}`);
    if (boostActive && chirp.activeComments)
        reasons.push('active conversation');
    if (chirp.authorFollowed && mix !== 'everyone')
        reasons.push(`following ${chirp.handle}`);
    if (!chirp.authorFollowed && mix === 'everyone')
        reasons.push('from everyone');
    if (!reasons.length)
        reasons.push('recency');
    return `Because: ${reasons.slice(0, 2).join(' + ')}`;
};
const ChirpCard = ({ chirp, reason }) => {
    return (_jsxs("article", { className: "rounded-2xl border border-border/70 bg-background/50 p-4 shadow-inner", children: [_jsxs("div", { className: "flex items-start justify-between text-sm text-textMuted", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-textPrimary", children: chirp.name }), _jsx("p", { children: chirp.handle })] }), _jsx("span", { className: "text-xs text-textLabel", children: chirp.timestamp })] }), _jsx("p", { className: "mt-3 text-sm text-textPrimary", children: chirp.text }), _jsxs("div", { className: "mt-4 flex items-center justify-between text-xs text-textLabel", children: [_jsx("span", { children: chirp.activeComments
                            ? `Active now - ${chirp.commentCount} people discussing`
                            : `${chirp.commentCount} replies - calm` }), _jsx("span", { className: "rounded-full border border-border px-3 py-1 text-[11px] text-textMuted", children: reason })] }), _jsxs("div", { className: "mt-3 text-xs text-textLabel", children: ["#", chirp.topic] })] }));
};
export default InteractiveDemo;
