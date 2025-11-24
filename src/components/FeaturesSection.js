import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const features = [
    {
        id: 'algorithm-control',
        title: '100% Algorithm Control',
        description: 'Every ranking signal is visible and adjustable. You control what you see, how it\'s ranked, and why. No black boxes. No hidden manipulation.',
        icon: '⚙️',
        demoPlaceholder: true,
    },
    {
        id: 'audience-personalization',
        title: 'Personalize Your Audience',
        description: 'Define exactly who sees your content. Target by interests, expertise, location, or create custom audience segments. Reach the right people, not just the most.',
        icon: '🎯',
        demoPlaceholder: true,
    },
    {
        id: 'value-system',
        title: 'Value-Based Monetization',
        description: 'Creators earn based on the value their content creates, not views or impressions. Transparent metrics show real impact: engagement quality, knowledge shared, conversations started.',
        icon: '💎',
        demoPlaceholder: true,
    },
    {
        id: 'fact-checking',
        title: 'Real-Time Fact-Checking',
        description: 'Sophisticated AI algorithms verify claims instantly. Authentic content rises. Misinformation is flagged before it spreads. Stay at the forefront of truth.',
        icon: '✅',
        demoPlaceholder: true,
    },
];
const FeaturesSection = () => {
    const [activeFeature, setActiveFeature] = useState(null);
    return (_jsx("section", { id: "features", className: "section-container py-20 md:py-32", children: _jsxs("div", { className: "max-w-6xl mx-auto space-y-16", children: [_jsxs("div", { className: "text-center max-w-3xl mx-auto space-y-4", children: [_jsx("h2", { className: "text-4xl md:text-5xl font-bold text-textPrimary", children: "What makes Kurral different" }), _jsx("p", { className: "text-lg md:text-xl text-textMuted", children: "Four core innovations that put you in control and keep content authentic" })] }), _jsx("div", { className: "grid md:grid-cols-2 gap-6", children: features.map((feature) => (_jsx("div", { className: "card-surface p-8 space-y-4 cursor-pointer group", onMouseEnter: () => setActiveFeature(feature.id), onMouseLeave: () => setActiveFeature(null), children: _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "text-4xl", children: feature.icon }), _jsxs("div", { className: "flex-1 space-y-3", children: [_jsx("h3", { className: "text-2xl font-semibold text-textPrimary group-hover:text-accent transition-colors", children: feature.title }), _jsx("p", { className: "text-textMuted leading-relaxed", children: feature.description }), feature.demoPlaceholder && (_jsx("div", { className: "pt-4 border-t border-border/60", children: _jsxs("div", { className: "rounded-lg bg-background/60 border border-border/40 p-12 text-center", children: [_jsx("div", { className: "text-3xl mb-2", children: "\uD83D\uDCF9" }), _jsx("p", { className: "text-sm text-textMuted", children: "Demo placeholder" }), _jsx("p", { className: "text-xs text-textLabel mt-1", children: "Interactive demo coming soon" })] }) }))] })] }) }, feature.id))) })] }) }));
};
export default FeaturesSection;
