import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const WaitlistCTA = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const handleSubmit = (event) => {
        event.preventDefault();
        if (!email.trim())
            return;
        setSubmitted(true);
    };
    return (_jsx("section", { id: "waitlist", className: "section-container py-16", children: _jsxs("div", { className: "max-w-2xl mx-auto space-y-8 text-center", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("h2", { className: "text-3xl font-semibold text-textPrimary", children: "Join the founding community" }), _jsx("p", { className: "text-lg text-textMuted leading-relaxed", children: "Kurral is in private beta. We're inviting people who want a minimalist social feed they control - chronological by default, transparent when it's ranked, and calm enough that you can be fully caught up in minutes, not hours. Help us prove social media doesn't need manipulation to work." }), _jsxs("div", { className: "flex items-center justify-center gap-6 text-sm text-textMuted flex-wrap", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-2 w-2 rounded-full bg-accent" }), _jsx("span", { children: "Early access opens January 2025" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "h-2 w-2 rounded-full bg-accent" }), _jsx("span", { children: "Limited spots available" })] })] })] }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4 text-left max-w-md mx-auto", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-textLabel mb-2", children: "Email address" }), _jsx("input", { type: "email", value: email, onChange: (event) => setEmail(event.target.value), placeholder: "your@email.com", className: "w-full border-b border-border bg-transparent py-2 text-base text-textPrimary outline-none placeholder:text-textMuted focus:border-accent", required: true })] }), _jsx("button", { type: "submit", className: "w-full rounded-md bg-accent px-6 py-3 font-semibold text-background transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60", disabled: submitted, children: submitted ? "✓ You're on the list" : 'Request early access' }), submitted && _jsx("p", { className: "text-sm text-textMuted text-center", children: "Thanks. We'll email you with access details before launch." })] })] }) }));
};
export default WaitlistCTA;
