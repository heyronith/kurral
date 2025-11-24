import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const faqs = [
    {
        question: `What does "100% algorithm control" actually mean?`,
        answer: `You can see and adjust every ranking signal in real-time. Boost or mute topics, prioritize active conversations, adjust the mix of following vs. discovery content—all with full transparency. Every post shows why it appeared in your feed. No hidden signals, no black boxes.`,
    },
    {
        question: `How does audience personalization work?`,
        answer: `When you create content, you can define exactly who should see it. Target by interests (e.g., "developers interested in AI"), expertise level, location, or create custom audience segments. Your content reaches the right people based on your intent, not just algorithm guesses.`,
    },
    {
        question: `How is value-based monetization different from views/impressions?`,
        answer: `Instead of rewarding creators for raw views, Kurral measures actual value: quality of engagement, knowledge shared, meaningful conversations started, and real impact. Transparent metrics show creators exactly how their content creates value, and monetization follows.`,
    },
    {
        question: `How accurate is the fact-checking?`,
        answer: `Our AI fact-checking system uses sophisticated algorithms to verify claims in real-time against trusted sources. It flags potential misinformation, verifies statistics, and checks sources. While no system is perfect, we're at the forefront of keeping content authentic and true.`,
    },
    {
        question: `Can I still use Kurral like a traditional social network?`,
        answer: `Absolutely. You can follow people, post content, engage in conversations—all the core social features. The difference is you have full control over what you see, who sees your content, and how value is measured. It's social media, just better.`,
    },
    {
        question: `What makes Kurral "agentic"?`,
        answer: `Kurral uses AI agents to help you control your experience. The platform intelligently adapts to your preferences, helps you find the right audience, verifies content authenticity, and measures value—all while keeping you in full control. The AI works for you, not against you.`,
    },
    {
        question: `Is my data private and secure?`,
        answer: `Yes. You own your data. We provide full export capabilities, transparent privacy controls, and never sell your data. Your algorithm preferences, audience targeting, and content are yours to control.`,
    },
    {
        question: `Who is Kurral for?`,
        answer: `Creators who want fair monetization. Users tired of algorithm manipulation. Anyone who values authentic, verified content. People who want to reach the right audience, not just the largest one. If you care about control, transparency, and value, Kurral is for you.`,
    },
];
const FAQ = () => {
    const [openIndex, setOpenIndex] = useState(null);
    const toggleQuestion = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };
    return (_jsx("section", { id: "faq", className: "section-container py-16", children: _jsxs("div", { className: "max-w-3xl mx-auto space-y-10", children: [_jsx("div", { className: "text-center", children: _jsx("h2", { className: "text-3xl font-semibold text-textPrimary mb-6", children: "Questions we get" }) }), _jsx("div", { className: "space-y-4", children: faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (_jsxs("div", { className: "rounded-2xl border border-border/70 bg-background/40 transition", children: [_jsxs("button", { onClick: () => toggleQuestion(index), className: "w-full px-5 py-4 text-left flex items-center justify-between gap-4 transition hover:bg-background/60", children: [_jsx("h3", { className: "text-lg font-semibold text-textPrimary pr-4", children: faq.question }), _jsx("span", { className: `flex-shrink-0 text-textMuted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`, children: "\u2193" })] }), isOpen && (_jsx("div", { className: "px-5 pb-4 pt-0", children: _jsx("p", { className: "text-textMuted leading-relaxed", children: faq.answer }) }))] }, faq.question));
                    }) })] }) }));
};
export default FAQ;
