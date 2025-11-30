import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const faqs = [
    {
        question: `How much does Kurral cost?`,
        answer: (_jsxs(_Fragment, { children: ["Kurral offers a free tier with core features. Personalized features like Audience Tuning, advanced feed controls, and monetization eligibility will be available through a monthly subscription ($14.99/month). However,", ' ', _jsx("strong", { children: "all users who join during our beta period will receive lifetime access to these premium features at no cost" }), "."] })),
    },
    {
        question: `Is my data private and secure?`,
        answer: `Yes. You own your data completely. We provide full export capabilities, transparent privacy controls, and we never sell your data to third parties. Your algorithm preferences, audience targeting settings, and all content are yours to control and export at any time. No dark patterns. No addiction optimization.`,
    },
    {
        question: `What is the Kurral Score and why does it matter?`,
        answer: `The Kurral Score (0-100) measures your content's quality, trustworthiness, and value across 5 dimensions: factual rigor (epistemic), novelty and insight, practical value, tone and discourse quality, and effort/depth. High-quality, verified content improves your score and gets you recognized. Sharing false information or violating policies lowers it significantly. In the future, monetization will be based on this value system.`,
    },
    {
        question: `What happens if I share false information?`,
        answer: `Our Truth intelligence verifies every post using systems and human intervention when needed before your post goes live. False information is immediately blocked, not labeled days later. Your Kurral Score gets penalized, which affects your credibility and reach. We prioritize truth and authenticity.`,
    },
    {
        question: `What types of media can I post?`,
        answer: `Kurral is designed as a value-first, minimalistic social platform. We support text posts and images - the formats that best enable thoughtful discussion and meaningful content. By focusing on these core media types, we prioritize depth over distraction, quality over quantity, and substance over spectacle. Based on community feedback, we may consider adding other media types in the future, but only if they align with our value-first philosophy.`,
    },
    {
        question: `How is Kurral different from other social platforms?`,
        answer: `Unlike other platforms: (1) You control your feed with natural language - just tell it what you want. (2) You choose who sees your posts, not the algorithm. (3) Value is measured across 5 dimensions, not just clicks. (4) Truth intelligence verifies every post before you see it, not days later. (5) Every recommendation is explained. It's social media with transparency, not manipulation.`,
    },
];
const FAQ = () => {
    const [openIndex, setOpenIndex] = useState(null);
    const toggleQuestion = (index) => {
        setOpenIndex(openIndex === index ? null : index);
    };
    return (_jsx("section", { id: "faq", className: "section-container py-16", children: _jsxs("div", { className: "max-w-3xl mx-auto space-y-10", children: [_jsx("div", { className: "text-center", children: _jsx("h2", { className: "text-3xl font-semibold text-textPrimary mb-6", children: "Questions we get" }) }), _jsx("div", { className: "space-y-4", children: faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        return (_jsxs("div", { className: "rounded-2xl border border-white/10 bg-white/[0.02] transition-colors hover:border-white/20", children: [_jsxs("button", { onClick: () => toggleQuestion(index), "aria-expanded": isOpen, className: "w-full px-5 py-4 text-left flex items-center justify-between gap-4 transition hover:bg-background/60", children: [_jsx("h3", { className: "text-base sm:text-lg font-semibold text-textPrimary pr-4", children: faq.question }), _jsx("svg", { className: `flex-shrink-0 w-5 h-5 text-textMuted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", "aria-hidden": "true", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) })] }), isOpen && (_jsx("div", { className: "px-5 pb-4 pt-0", children: _jsx("div", { className: "text-textMuted leading-relaxed", children: faq.answer }) }))] }, faq.question));
                    }) })] }) }));
};
export default FAQ;
