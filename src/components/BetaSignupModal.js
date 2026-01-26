import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { betaSignupService } from '../webapp/lib/services/betaSignupService';
const BetaSignupModal = ({ open, onClose }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const modalRef = useRef(null);
    const emailInputRef = useRef(null);
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
    // Focus email input when modal opens
    useEffect(() => {
        if (open && emailInputRef.current && !success) {
            setTimeout(() => {
                emailInputRef.current?.focus();
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
        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }
        setLoading(true);
        try {
            await betaSignupService.submitBetaSignup(email);
            setSuccess(true);
            setEmail('');
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
            setEmail('');
            setError('');
            setSuccess(false);
            onClose();
        }
    };
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-4", onClick: (e) => {
            if (e.target === e.currentTarget && !loading) {
                onClose();
            }
        }, role: "dialog", "aria-modal": "true", "aria-labelledby": "beta-signup-title", children: _jsxs("div", { ref: modalRef, className: "relative w-full max-w-xl max-h-[95vh] flex flex-col bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { "aria-label": "Close beta signup", onClick: handleClose, disabled: loading, className: "absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm w-8 h-8 flex items-center justify-center text-white transition hover:border-white/30 hover:bg-white/20 disabled:opacity-50", children: _jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }), _jsx("div", { className: "p-6 sm:p-8 md:p-10 overflow-y-auto", children: success ? (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "text-center space-y-4", children: [_jsx("div", { className: "inline-flex items-center justify-center rounded-full bg-green-500/20 border border-green-500/30 w-16 h-16 mb-2", children: _jsx("svg", { className: "w-8 h-8 text-green-400", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }) }), _jsx("h2", { className: "text-3xl font-bold text-white", children: "Welcome to Kural!" }), _jsx("p", { className: "text-white/70 text-lg", children: "You've been added to our early access list." })] }), _jsxs("div", { className: "space-y-6 bg-white/5 rounded-xl p-6 border border-white/10", children: [_jsx("h3", { className: "text-lg font-semibold text-white", children: "What happens next?" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "rounded-full bg-accent/20 border border-accent/30 w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5", children: _jsx("span", { className: "text-sm font-bold text-accent", children: "1" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-white", children: "Confirmation email" }), _jsx("p", { className: "text-sm text-white/60", children: "We've reserved your spot. Watch your inbox for a confirmation!" })] })] }), _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "rounded-full bg-accent/20 border border-accent/30 w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5", children: _jsx("span", { className: "text-sm font-bold text-accent", children: "2" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-white", children: "Early Access Launch" }), _jsxs("p", { className: "text-sm text-white/60", children: ["You'll get an invite when we open on ", _jsx("span", { className: "text-accentLight font-semibold", children: "Jan 5, 2026" }), "."] })] })] }), _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "rounded-full bg-accent/20 border border-accent/30 w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5", children: _jsx("span", { className: "text-sm font-bold text-accent", children: "3" }) }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-white", children: "Lifetime Premium" }), _jsxs("p", { className: "text-sm text-white/60", children: ["As a beta member, your account will be upgraded to ", _jsx("span", { className: "text-accentSecondary font-semibold", children: "lifetime premium" }), " for free."] })] })] })] })] }), _jsxs("div", { className: "text-center pt-2", children: [_jsx("button", { onClick: handleClose, className: "px-8 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium hover:bg-white/20 transition-all", children: "Close" }), _jsxs("p", { className: "mt-6 text-sm text-white/40", children: ["Questions? Contact ", _jsx("span", { className: "text-white/60", children: "support@kurral.app" })] })] })] })) : (_jsxs("div", { className: "space-y-8", children: [_jsxs("div", { className: "text-center", children: [_jsx("h2", { id: "beta-signup-title", className: "text-3xl md:text-4xl font-bold text-white mb-3", children: "Join the Beta" }), _jsx("p", { className: "text-white/60 text-lg max-w-sm mx-auto", children: "Be among the first to experience social media focused on value, not virality." })] }), error && (_jsx("div", { className: "rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm animate-shake", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "beta-email", className: "block text-sm font-medium text-white/90 mb-2 ml-1", children: "Email Address" }), _jsx("input", { ref: emailInputRef, type: "email", id: "beta-email", value: email, onChange: (e) => setEmail(e.target.value), required: true, disabled: loading, className: "w-full rounded-xl border border-white/20 bg-white/5 px-4 py-4 text-white placeholder-white/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg", placeholder: "your.email@example.com", "aria-required": "true" })] }), _jsxs("div", { className: "flex flex-col gap-4 pt-2", children: [_jsx("button", { type: "submit", disabled: loading, className: "w-full rounded-xl bg-gradient-to-r from-accent to-accentLight py-4 text-lg font-bold text-white transition-all duration-200 hover:from-accentHover hover:to-accent shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Joining...' : 'Get Early Access' }), _jsxs("p", { className: "text-center text-xs text-white/40", children: ["By joining, you agree to our ", _jsx("span", { className: "text-white/60 hover:underline cursor-pointer", children: "Terms of Service" }), " and ", _jsx("span", { className: "text-white/60 hover:underline cursor-pointer", children: "Privacy Policy" }), "."] })] })] })] })) })] }) }));
};
export default BetaSignupModal;
