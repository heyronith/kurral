import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const steps = [
    {
        number: '01',
        title: 'Control Your Algorithm',
        description: 'Adjust every ranking signal in real-time. See exactly why content appears in your feed. Boost topics, mute noise, prioritize conversations—all transparent and adjustable.',
        demo: true,
    },
    {
        number: '02',
        title: 'Personalize Your Audience',
        description: 'When you post, define who should see it. Target by interests, expertise, or create custom segments. Your content reaches the right people, not just the algorithm\'s guess.',
        demo: true,
    },
    {
        number: '03',
        title: 'Earn Based on Value',
        description: 'Monetization isn\'t about views—it\'s about impact. See transparent metrics: quality engagement, knowledge shared, meaningful conversations started. Get rewarded for creating value.',
        demo: true,
    },
    {
        number: '04',
        title: 'Trust Through Verification',
        description: 'Every post is fact-checked in real-time by sophisticated AI. Authentic content rises. Misinformation is flagged. You stay informed with confidence.',
        demo: true,
    },
];
const HowItWorks = ({ onShowDemo }) => {
    return (_jsx("section", { id: "how-it-works", className: "section-container py-20 md:py-32 bg-background/50", children: _jsxs("div", { className: "max-w-5xl mx-auto space-y-16", children: [_jsxs("div", { className: "text-center max-w-3xl mx-auto space-y-4", children: [_jsx("h2", { className: "text-4xl md:text-5xl font-bold text-textPrimary", children: "How it works" }), _jsx("p", { className: "text-lg md:text-xl text-textMuted", children: "Four simple steps to a better social media experience" })] }), _jsx("div", { className: "space-y-12", children: steps.map((step, index) => (_jsxs("div", { className: "grid md:grid-cols-2 gap-8 items-center", style: { direction: index % 2 === 1 ? 'rtl' : 'ltr' }, children: [_jsxs("div", { style: { direction: 'ltr' }, className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "text-4xl font-bold text-accent/20", children: step.number }), _jsx("h3", { className: "text-2xl md:text-3xl font-semibold text-textPrimary", children: step.title })] }), _jsx("p", { className: "text-lg text-textMuted leading-relaxed", children: step.description }), step.demo && onShowDemo && (_jsx("button", { onClick: onShowDemo, className: "inline-flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-accent transition hover:bg-accent/10 mt-4", children: "View demo \u2192" }))] }), _jsx("div", { style: { direction: 'ltr' }, className: "card-surface p-8", children: _jsxs("div", { className: "rounded-lg bg-background/60 border border-border/40 p-16 text-center", children: [_jsx("div", { className: "text-4xl mb-4", children: "\uD83D\uDCF9" }), _jsx("p", { className: "text-sm text-textMuted font-medium", children: "Interactive demo" }), _jsxs("p", { className: "text-xs text-textLabel mt-2", children: ["See ", step.title.toLowerCase(), " in action"] })] }) })] }, step.number))) })] }) }));
};
export default HowItWorks;
