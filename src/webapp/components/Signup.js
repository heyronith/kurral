import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { authService } from '../lib/auth';
import { useNavigate, Link } from 'react-router-dom';
const Signup = () => {
    const [name, setName] = useState('');
    const [handle, setHandle] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (!handle.match(/^[a-zA-Z0-9_]+$/)) {
            setError('Handle can only contain letters, numbers, and underscores');
            return;
        }
        setLoading(true);
        try {
            await authService.signUpWithEmail(email, password, name, handle);
            navigate('/onboarding');
        }
        catch (err) {
            setError(err.message || 'Failed to create account');
        }
        finally {
            setLoading(false);
        }
    };
    const handleGoogleSignIn = async () => {
        setError('');
        setLoading(true);
        try {
            const user = await authService.signInWithGoogle();
            // Check if onboarding is completed
            if (user.onboardingCompleted) {
                navigate('/');
            }
            else {
                navigate('/onboarding');
            }
        }
        catch (err) {
            setError(err.message || 'Failed to sign in with Google');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "h-screen flex bg-background overflow-hidden", children: [_jsxs("div", { className: "hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-accent/5 to-backgroundSubtle p-8 flex-col justify-center relative overflow-hidden max-h-screen", children: [_jsx("div", { className: "absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" }), _jsx("div", { className: "absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" }), _jsxs("div", { className: "relative z-10 max-w-md", children: [_jsxs(Link, { to: "/", className: "inline-flex items-center gap-2 mb-8 group", children: [_jsx("span", { className: "text-lg font-bold text-textPrimary", children: "Kural" }), _jsx("img", { src: "/quotation-marks.png", alt: "Kural", className: "h-5 w-auto opacity-80 group-hover:opacity-100 transition-opacity" })] }), _jsxs("div", { children: [_jsxs("h1", { className: "text-5xl font-bold text-textPrimary mb-4 leading-tight", children: ["Stop fighting", _jsx("br", {}), _jsx("span", { className: "bg-gradient-to-r from-primary via-accent to-accentSecondary bg-clip-text text-transparent", children: "the feed." })] }), _jsx("p", { className: "text-lg text-textSecondary leading-snug mb-6", children: "Join the platform where you control what you see, who sees your content, and how value is measured." }), _jsxs("div", { className: "space-y-2.5 mb-6", children: [_jsxs("div", { className: "flex items-center gap-2.5 text-textPrimary", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" }), _jsx("span", { className: "text-base", children: "Talk to your feed in plain English" })] }), _jsxs("div", { className: "flex items-center gap-2.5 text-textPrimary", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" }), _jsx("span", { className: "text-base", children: "Truth intelligence verifies every post before you see it" })] }), _jsxs("div", { className: "flex items-center gap-2.5 text-textPrimary", children: [_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" }), _jsx("span", { className: "text-base", children: "Earn from value, not vanity metrics" })] })] }), _jsxs("div", { className: "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20", children: [_jsx("svg", { className: "w-3.5 h-3.5 text-accent", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }), _jsx("p", { className: "text-xs font-medium text-accent", children: "No data selling \u2022 Full transparency" })] })] })] })] }), _jsx("div", { className: "w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-8 overflow-y-auto max-h-screen", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsx("div", { className: "lg:hidden mb-6", children: _jsxs(Link, { to: "/", className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "text-lg font-bold text-textPrimary", children: "Kural" }), _jsx("img", { src: "/quotation-marks.png", alt: "Kural", className: "h-5 w-auto" })] }) }), _jsxs("div", { className: "mb-6", children: [_jsx("h2", { className: "text-3xl font-bold text-textPrimary mb-2", children: "Start your journey" }), _jsx("p", { className: "text-base text-textMuted", children: "Join thousands taking control of their social media experience" })] }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-3.5 mb-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "name", className: "block text-xs font-medium text-textLabel mb-1.5", children: "Full Name" }), _jsx("input", { id: "name", type: "text", value: name, onChange: (e) => setName(e.target.value), required: true, className: "w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all", placeholder: "John Doe" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "handle", className: "block text-xs font-medium text-textLabel mb-1.5", children: "Handle" }), _jsx("input", { id: "handle", type: "text", value: handle, onChange: (e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')), required: true, pattern: "[a-zA-Z0-9_]+", className: "w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all", placeholder: "username" }), _jsx("p", { className: "mt-1 text-xs text-textMuted", children: "Only letters, numbers, and underscores" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-xs font-medium text-textLabel mb-1.5", children: "Email" }), _jsx("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, className: "w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all", placeholder: "your@email.com" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-xs font-medium text-textLabel mb-1.5", children: "Password" }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 6, className: "w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" }), _jsx("p", { className: "mt-1 text-xs text-textMuted", children: "Min. 6 characters" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "confirmPassword", className: "block text-xs font-medium text-textLabel mb-1.5", children: "Confirm Password" }), _jsx("input", { id: "confirmPassword", type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), required: true, className: "w-full px-3 py-2 bg-backgroundElevated border-2 border-border rounded-lg text-sm text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full py-2.5 px-4 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-semibold hover:from-primaryHover hover:to-accentHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-button hover:shadow-buttonHover active:scale-[0.98] mt-1", children: loading ? 'Creating account...' : 'Create account' })] }), _jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("div", { className: "w-full border-t border-border" }) }), _jsx("div", { className: "relative flex justify-center text-xs", children: _jsx("span", { className: "px-2 bg-background text-textMuted", children: "Or continue with" }) })] }), _jsxs("button", { onClick: handleGoogleSignIn, disabled: loading, className: "mt-3 w-full py-2.5 px-4 bg-backgroundElevated border-2 border-border text-textPrimary rounded-lg text-sm font-medium hover:bg-backgroundHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]", children: [_jsxs("svg", { className: "w-4 h-4", viewBox: "0 0 24 24", children: [_jsx("path", { fill: "currentColor", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), _jsx("path", { fill: "currentColor", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), _jsx("path", { fill: "currentColor", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), _jsx("path", { fill: "currentColor", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" })] }), "Google"] })] }), _jsxs("p", { className: "text-center text-xs text-textMuted", children: ["Already have an account?", ' ', _jsx("button", { onClick: () => navigate('/login'), className: "text-primary font-semibold hover:text-primaryHover transition-colors", children: "Sign in" })] })] }) })] }));
};
export default Signup;
