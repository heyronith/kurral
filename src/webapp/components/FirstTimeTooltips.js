import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const tips = [
    { id: 1, title: 'For You feed', description: 'Personalized by what you told us you care about.' },
    { id: 2, title: 'Latest feed', description: 'Chronological posts from people you follow.' },
    {
        id: 3,
        title: 'See why this appeared',
        description: 'Every card explains why it showed up so you stay in control.',
    },
];
const FirstTimeTooltips = () => {
    return (_jsx("div", { className: "pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-3", children: tips.map((tip) => (_jsxs("div", { className: "max-w-xs rounded-2xl border border-border bg-backgroundElevated/80 p-3 text-sm leading-relaxed shadow-lg backdrop-blur", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-textMuted", children: tip.title }), _jsx("p", { className: "text-[13px] text-textPrimary", children: tip.description })] }, tip.id))) }));
};
export default FirstTimeTooltips;
