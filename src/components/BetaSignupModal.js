import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { betaSignupService } from '../webapp/lib/services/betaSignupService';
const BetaSignupModal = ({ open, onClose }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [expectedHandle, setExpectedHandle] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const modalRef = useRef(null);
    const firstInputRef = useRef(null);
    // Handle ESC key to close modal
    useEffect(() => {
        if (!open)
            return;
        const handleEscape = (e) => {
            if (e.key === 'Escape' && !loading) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open, loading, onClose]);
    // Focus first input when modal opens
    useEffect(() => {
        if (open && firstInputRef.current && !success) {
            setTimeout(() => {
                firstInputRef.current?.focus();
            }, 100);
        }
    }, [open, success]);
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        }
        else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);
    if (!open)
        return null;
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        if (!name.trim() || !email.trim()) {
            setError('Please fill in all required fields');
            return;
        }
        setLoading(true);
        try {
            await betaSignupService.submitBetaSignup(name, email, expectedHandle.trim() || undefined);
            setSuccess(true);
            setName('');
            setEmail('');
            setExpectedHandle('');
            // Auto close after 3 seconds
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 3000);
        }
        catch (err) {
            setError(err.message || 'Failed to submit. Please try again.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleClose = () => {
        if (!loading) {
            setName('');
            setEmail('');
            setExpectedHandle('');
            setError('');
            setSuccess(false);
            onClose();
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-4", onClick: (e) => {
            if (e.target === e.currentTarget && !loading) {
                onClose();
            }
        }, role: "dialog", "aria-modal": "true", "aria-labelledby": "beta-signup-title", children: _jsxs("div", { ref: modalRef, className: "relative w-full max-w-5xl max-h-[95vh] flex flex-col md:flex-row bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { "aria-label": "Close beta signup", onClick: handleClose, disabled: loading, className: "absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm w-8 h-8 flex items-center justify-center text-white transition hover:border-white/30 hover:bg-white/20 disabled:opacity-50", children: _jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }), _jsx("div", { className: "flex-1 p-6 md:p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10 bg-[#030712]", children: _jsxs("div", { className: "space-y-5 text-white leading-relaxed", children: [_jsx("p", { className: "text-base md:text-lg", children: "Hello friend," }), _jsx("p", { className: "text-base md:text-lg text-white/95", children: "We're building Kural because we're frustrated. We're tired of watching thoughtful posts get buried while rage-bait goes viral. We're tired of algorithms that optimize for engagement instead of value." }), _jsx("p", { className: "text-base md:text-lg text-white/95", children: "So we built something different. We measure quality content by what actually matters: factual rigor, insight, practical value, tone, and effort. Quality creators get recognized. Your Kural Score reflects real impact, not vanity metrics." }), _jsxs("p", { className: "text-base md:text-lg text-white/95", children: ["We're opening early access in ", _jsx("span", { className: "font-semibold text-accentLight", children: "January 2025" }), ". If you join us during beta, you'll get ", _jsx("span", { className: "font-semibold text-accentSecondary", children: "lifetime premium access, forever free" }), ". It's our way of saying thanks for believing in value over virality."] }), _jsxs("p", { className: "text-base md:text-lg text-white/85 italic mt-6", children: ["With Love,", _jsx("br", {}), "R & the Kural Team"] })] }) }), _jsx("div", { className: "flex-1 p-6 md:p-8 overflow-y-auto max-h-[95vh]", children: success ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-full min-h-[300px] text-center", children: [_jsx("div", { className: "rounded-full bg-green-500/20 border border-green-500/30 w-16 h-16 flex items-center justify-center mb-4", children: _jsx("svg", { className: "w-8 h-8 text-green-400", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }) }), _jsx("h3", { className: "text-xl font-semibold text-white mb-2", children: "You're on the list!" }), _jsx("p", { className: "text-white/70 text-sm", children: "We'll email you when your access is ready." })] })) : (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h2", { id: "beta-signup-title", className: "text-2xl font-bold text-white mb-2", children: "Join the Beta" }), _jsx("p", { className: "text-white/60 text-sm", children: "Fill in your details below" })] }), error && (_jsx("div", { className: "rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-sm", children: error })), _jsxs("div", { children: [_jsxs("label", { htmlFor: "beta-name", className: "block text-sm font-medium text-white/90 mb-1.5", children: ["Full Name ", _jsx("span", { className: "text-red-400", children: "*" })] }), _jsx("input", { ref: firstInputRef, type: "text", id: "beta-name", value: name, onChange: (e) => setName(e.target.value), required: true, disabled: loading, maxLength: 200, className: "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm", placeholder: "John Doe", "aria-required": "true" })] }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "beta-email", className: "block text-sm font-medium text-white/90 mb-1.5", children: ["Email ", _jsx("span", { className: "text-red-400", children: "*" })] }), _jsx("input", { type: "email", id: "beta-email", value: email, onChange: (e) => setEmail(e.target.value), required: true, disabled: loading, className: "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm", placeholder: "your.email@example.com" })] }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "beta-handle", className: "block text-sm font-medium text-white/90 mb-1.5", children: ["Preferred Username ", _jsx("span", { className: "text-white/50 text-xs font-normal", children: "(Optional)" })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-white/60 text-sm", children: "@" }), _jsx("input", { type: "text", id: "beta-handle", value: expectedHandle, onChange: (e) => setExpectedHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')), disabled: loading, maxLength: 30, pattern: "[a-zA-Z0-9_]+", className: "flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm", placeholder: "username" })] })] }), _jsxs("div", { className: "flex gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: handleClose, disabled: loading, className: "flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed", children: "Cancel" }), _jsx("button", { type: "submit", disabled: loading, className: "flex-1 rounded-lg bg-gradient-to-r from-accent to-accentLight px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-accentHover hover:to-accent shadow-button hover:shadow-buttonHover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Submitting...' : 'Join Beta' })] })] })) })] }) }));
};
export default BetaSignupModal;
