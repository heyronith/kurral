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
const ValuePropositionSection = ({ onShowDemo }) => {
    return (_jsx("section", { id: "how-it-works", className: "section-container py-20 md:py-32", children: _jsx("div", { className: "max-w-5xl mx-auto", children: _jsxs("div", { className: "card-surface p-12 md:p-16 space-y-12", children: [_jsxs("div", { className: "text-center space-y-4", children: [_jsxs("h2", { className: "text-3xl md:text-4xl font-bold text-textPrimary", children: ["The future of social media is", ' ', _jsx("span", { className: "bg-gradient-to-r from-accent to-accentSecondary bg-clip-text text-transparent", children: "transparent, controlled, and valuable" })] }), _jsx("p", { className: "text-lg text-textMuted max-w-2xl mx-auto", children: "Four simple steps to a better social media experience" })] }), _jsx("div", { className: "pt-4 space-y-8", children: steps.map((step, index) => (_jsxs("div", { className: `flex flex-col md:flex-row gap-6 items-start ${index < steps.length - 1 ? 'pb-8 border-b border-border/40' : ''}`, children: [_jsxs("div", { className: "flex-shrink-0 flex items-center gap-3", children: [_jsx("span", { className: "text-3xl font-bold text-accent/30", children: step.number }), _jsx("h3", { className: "text-xl md:text-2xl font-semibold text-textPrimary", children: step.title })] }), _jsxs("div", { className: "flex-1 space-y-3", children: [_jsx("p", { className: "text-textMuted leading-relaxed", children: step.description }), step.demo && onShowDemo && (_jsx("button", { onClick: onShowDemo, className: "inline-flex items-center gap-2 rounded-lg border border-accent px-4 py-2 text-sm text-accent transition hover:bg-accent/10", children: "View demo \u2192" }))] })] }, step.number))) })] }) }) }));
};
export default ValuePropositionSection;
