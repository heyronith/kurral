import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const HowItWorksNew = () => {
    const steps = [
        {
            number: '01',
            title: 'Take Control',
            description: 'Customize your algorithm with full transparency. Every setting visible, every ranking explained.',
        },
        {
            number: '02',
            title: 'Target Your Audience',
            description: 'Define who sees your content. Personalize by interests, expertise, or create custom segments.',
        },
        {
            number: '03',
            title: 'Create Value',
            description: 'Share authentic content that gets verified in real-time. Quality over quantity, always.',
        },
        {
            number: '04',
            title: 'Earn Fairly',
            description: 'Get compensated based on the value your content creates, not just views or impressions.',
        },
    ];
    return (_jsx("section", { id: "how-it-works", className: "section-container py-20 md:py-28 bg-card/30", children: _jsxs("div", { className: "max-w-6xl mx-auto space-y-16", children: [_jsxs("div", { className: "text-center max-w-3xl mx-auto space-y-4", children: [_jsx("h2", { className: "text-4xl md:text-5xl font-bold text-textPrimary", children: "How Kurral Works" }), _jsx("p", { className: "text-lg text-textMuted", children: "A new paradigm for social media\u2014built on control, transparency, and value." })] }), _jsx("div", { className: "grid md:grid-cols-2 lg:grid-cols-4 gap-8", children: steps.map((step, index) => (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "text-5xl font-bold text-accent/20", children: step.number }), _jsx("div", { className: "h-px flex-1 bg-border/60" })] }), _jsx("h3", { className: "text-xl font-bold text-textPrimary", children: step.title }), _jsx("p", { className: "text-textMuted leading-relaxed", children: step.description })] }, step.number))) })] }) }));
};
export default HowItWorksNew;
