import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { betaSignupService } from '../webapp/lib/services/betaSignupService';
const BetaSignupModal = ({ open, onClose }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [greeting, setGreeting] = useState('Hey Friend,');
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const modalRef = useRef(null);
    const emailInputRef = useRef(null);
    // Detect mobile device
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768); // md breakpoint
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    // Get time-based greeting
    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) {
            return { base: 'Good morning,', friend: 'Friend,' };
        }
        else if (hour >= 12 && hour < 17) {
            return { base: 'Good afternoon,', friend: 'Friend,' };
        }
        else if (hour >= 17 && hour < 22) {
            return { base: 'Good evening,', friend: 'Friend,' };
        }
        else {
            return { base: 'Hey', friend: 'Friend,' };
        }
    };
    // Full message content
    const fullMessage = `We're tired of algorithms that optimize for engagement instead of value. Tired of black boxes. Tired of misinformation spreading. So we built Kural - social media that rewards quality, not clickbait.

Every post gets a Kural Score. Quality content? Your score rises. Misinformation? You get penalized. Future monetization is based on value, not clicks.

You control your feed in plain English. No black boxes. Just social media that works for you.

Early access opens Jan 5, 2026. You'll be one of a few thousand shaping value-driven social media. Join the beta and get lifetime premium access, forever free.

With Love,
Kural Team`;
    // Render text with highlights
    const renderTextWithHighlights = (text) => {
        // Split by highlights and signature
        const parts = text.split(/(Jan 5, 2026|lifetime premium access, forever free|With Love,|Kural Team)/);
        return parts.map((part, index) => {
            if (part === 'Jan 5, 2026') {
                return _jsx("span", { className: "font-semibold text-accentLight", children: part }, index);
            }
            else if (part === 'lifetime premium access, forever free') {
                return _jsx("span", { className: "font-semibold text-accentSecondary", children: part }, index);
            }
            else if (part === 'With Love,' || part === 'Kural Team') {
                return _jsx("span", { className: "italic text-white/85", children: part }, index);
            }
            return _jsx("span", { children: part }, index);
        });
    };
    // Update greeting and start typewriter when modal opens (desktop only)
    useEffect(() => {
        if (open && !success) {
            setGreeting(getTimeBasedGreeting().base);
            // On mobile, show full message immediately
            if (isMobile) {
                setDisplayedText(fullMessage);
                setIsTyping(false);
            }
            else {
                // On desktop, use typewriter animation
                setDisplayedText('');
                setIsTyping(true);
                let currentIndex = 0;
                const typeInterval = setInterval(() => {
                    if (currentIndex < fullMessage.length) {
                        setDisplayedText(fullMessage.slice(0, currentIndex + 1));
                        currentIndex++;
                    }
                    else {
                        setIsTyping(false);
                        clearInterval(typeInterval);
                    }
                }, 20); // Adjust speed here (lower = faster)
                return () => clearInterval(typeInterval);
            }
        }
        else if (!open) {
            setDisplayedText('');
            setIsTyping(false);
        }
    }, [open, success, isMobile]);
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
        }, role: "dialog", "aria-modal": "true", "aria-labelledby": "beta-signup-title", children: _jsxs("div", { ref: modalRef, className: "relative w-full max-w-5xl max-h-[95vh] flex flex-col md:flex-row bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden", onClick: (e) => e.stopPropagation(), children: [_jsx("button", { "aria-label": "Close beta signup", onClick: handleClose, disabled: loading, className: "absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm w-8 h-8 flex items-center justify-center text-white transition hover:border-white/30 hover:bg-white/20 disabled:opacity-50", children: _jsx("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) }), _jsx("div", { className: "flex-1 p-4 sm:p-6 md:p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10 bg-[#030712]", children: success ? (_jsxs("div", { className: "space-y-6 text-white", children: [_jsxs("div", { className: "flex items-center gap-3 mb-4", children: [_jsx("div", { className: "rounded-full bg-green-500/20 border border-green-500/30 w-12 h-12 flex items-center justify-center flex-shrink-0", children: _jsx("svg", { className: "w-6 h-6 text-green-400", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }) }), _jsx("h2", { className: "text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 to-accent bg-clip-text text-transparent", children: "You're on the list!" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-white mb-3", children: "What happens next?" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "rounded-full bg-accent/20 border border-accent/30 w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5", children: _jsx("span", { className: "text-xs font-bold text-accent", children: "1" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-white mb-1", children: "You're on the list" }), _jsx("p", { className: "text-sm text-white/70", children: "We've added you to the beta waitlist. You're all set!" })] })] }), _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "rounded-full bg-accent/20 border border-accent/30 w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5", children: _jsx("span", { className: "text-xs font-bold text-accent", children: "2" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-white mb-1", children: "Wait for launch" }), _jsxs("p", { className: "text-sm text-white/70", children: ["We'll send you an invite when early access opens on ", _jsx("span", { className: "font-semibold text-accentLight", children: "Jan 5, 2026" }), "."] })] })] }), _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "rounded-full bg-accent/20 border border-accent/30 w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5", children: _jsx("span", { className: "text-xs font-bold text-accent", children: "3" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-white mb-1", children: "Get lifetime premium" }), _jsxs("p", { className: "text-sm text-white/70", children: ["As a beta member, you'll receive ", _jsx("span", { className: "font-semibold text-accentSecondary", children: "lifetime premium access" }), " at no cost."] })] })] })] })] }), _jsx("div", { className: "pt-4 border-t border-white/10", children: _jsxs("p", { className: "text-sm text-white/80", children: ["Questions? Reach out to us at ", _jsx("span", { className: "font-semibold text-accentLight", children: "support@kurral.app" })] }) })] })] })) : (_jsxs("div", { className: "space-y-3 sm:space-y-4 text-white leading-relaxed flex flex-col", children: [_jsxs("p", { className: "text-sm sm:text-base md:text-lg mb-2 sm:mb-3", children: [greeting, " ", _jsx("span", { className: "bg-gradient-to-r from-accent to-accentSecondary bg-clip-text text-transparent font-semibold", children: getTimeBasedGreeting().friend })] }), _jsxs("div", { className: "text-xs sm:text-sm md:text-base text-white/95 whitespace-pre-wrap flex-1", children: [renderTextWithHighlights(displayedText), isTyping && !isMobile && (_jsx("span", { className: "inline-block w-0.5 h-4 bg-accent ml-1 animate-pulse" }))] })] })) }), _jsx("div", { className: "flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-h-[95vh] flex flex-col justify-center", children: success ? (_jsxs("div", { className: "flex flex-col items-center justify-center text-center", children: [_jsx("div", { className: "rounded-full bg-green-500/20 border border-green-500/30 w-20 h-20 flex items-center justify-center mb-6", children: _jsx("svg", { className: "w-10 h-10 text-green-400", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }) }), _jsx("h3", { className: "text-2xl font-bold text-white mb-3", children: "Welcome to Kural!" }), _jsx("p", { className: "text-white/80 text-base leading-relaxed max-w-sm", children: "Your email has been confirmed. Check the left side to see what happens next." })] })) : (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { id: "beta-signup-title", className: "text-2xl md:text-3xl font-bold text-white mb-2", children: "Join the Beta" }), _jsx("p", { className: "text-white/60 text-sm", children: "Enter your email to get early access" })] }), error && (_jsx("div", { className: "rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-400 text-sm", children: error })), _jsxs("div", { children: [_jsx("label", { htmlFor: "beta-email", className: "block text-sm font-medium text-white/90 mb-2", children: "Email Address" }), _jsx("input", { ref: emailInputRef, type: "email", id: "beta-email", value: email, onChange: (e) => setEmail(e.target.value), required: true, disabled: loading, className: "w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base", placeholder: "your.email@example.com", "aria-required": "true" })] }), _jsxs("div", { className: "flex gap-3 pt-2", children: [_jsx("button", { type: "button", onClick: handleClose, disabled: loading, className: "flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed", children: "Cancel" }), _jsx("button", { type: "submit", disabled: loading, className: "flex-1 rounded-lg bg-gradient-to-r from-accent to-accentLight px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:from-accentHover hover:to-accent shadow-button hover:shadow-buttonHover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Submitting...' : 'Join Beta' })] })] })) })] }) }));
};
export default BetaSignupModal;
