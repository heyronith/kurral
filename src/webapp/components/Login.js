import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { authService } from '../lib/auth';
import { useNavigate, Link } from 'react-router-dom';
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await authService.signInWithEmail(email, password);
            // Check if onboarding is completed
            if (user.onboardingCompleted) {
                navigate('/app');
            }
            else {
                navigate('/onboarding');
            }
        }
        catch (err) {
            setError(err.message || 'Failed to sign in');
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
                navigate('/app');
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
    return (_jsxs("div", { className: "min-h-screen flex bg-background", children: [_jsxs("div", { className: "hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-accent/5 to-backgroundSubtle p-12 flex-col justify-between relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" }), _jsx("div", { className: "absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" }), _jsxs("div", { className: "relative z-10", children: [_jsxs(Link, { to: "/", className: "inline-flex items-center gap-2 mb-12 group", children: [_jsx("span", { className: "text-xl font-bold text-textPrimary", children: "Kurral" }), _jsx("img", { src: "/quotation-marks.png", alt: "Kurral", className: "h-6 w-auto opacity-80 group-hover:opacity-100 transition-opacity" })] }), _jsxs("div", { className: "max-w-md space-y-8", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-4xl font-bold text-textPrimary mb-4 leading-tight", children: ["Your algorithm.", _jsx("br", {}), _jsx("span", { className: "text-primary", children: "Your rules." })] }), _jsx("p", { className: "text-lg text-textSecondary leading-relaxed", children: "Control every signal. Personalize your audience. Earn from value, not vanity metrics. All backed by real-time fact-checking." })] }), _jsxs("div", { className: "space-y-5 pt-4", children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center", children: _jsx("svg", { className: "w-5 h-5 text-primary", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" }) }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-textPrimary mb-1", children: "100% Algorithm Control" }), _jsx("p", { className: "text-sm text-textMuted", children: "Tune every signal. Personalize your audience. Your feed, your rules." })] })] }), _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "flex-shrink-0 w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center", children: _jsx("svg", { className: "w-5 h-5 text-accent", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-textPrimary mb-1", children: "Value-Based Monetization" }), _jsx("p", { className: "text-sm text-textMuted", children: "Creators earn from value created, not views. Transparent. Fair. Future-proof." })] })] }), _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "flex-shrink-0 w-10 h-10 rounded-xl bg-accentSecondary/10 flex items-center justify-center", children: _jsx("svg", { className: "w-5 h-5 text-accentSecondary", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" }) }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-textPrimary mb-1", children: "AI Fact-Checking" }), _jsx("p", { className: "text-sm text-textMuted", children: "Real-time verification. Authentic content only. Stay ahead of misinformation." })] })] })] })] })] }), _jsx("div", { className: "relative z-10", children: _jsx("p", { className: "text-sm text-textMuted", children: "Where authentic content meets intelligent algorithms" }) })] }), _jsx("div", { className: "w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsx("div", { className: "lg:hidden mb-8", children: _jsxs(Link, { to: "/", className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "text-xl font-bold text-textPrimary", children: "Kurral" }), _jsx("img", { src: "/quotation-marks.png", alt: "Kurral", className: "h-6 w-auto" })] }) }), _jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-3xl font-bold text-textPrimary mb-2", children: "Welcome back" }), _jsx("p", { className: "text-textMuted", children: "Sign in to continue to Kurral" })] }), error && (_jsx("div", { className: "mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5 mb-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-textLabel mb-2", children: "Email" }), _jsx("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, className: "w-full px-4 py-3 bg-backgroundElevated border-2 border-border rounded-xl text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all", placeholder: "your@email.com" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-sm font-medium text-textLabel mb-2", children: "Password" }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, className: "w-full px-4 py-3 bg-backgroundElevated border-2 border-border rounded-xl text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full py-3 px-4 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold hover:from-primaryHover hover:to-accentHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-button hover:shadow-buttonHover active:scale-[0.98]", children: loading ? 'Signing in...' : 'Sign in' })] }), _jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("div", { className: "w-full border-t-2 border-border" }) }), _jsx("div", { className: "relative flex justify-center text-sm", children: _jsx("span", { className: "px-3 bg-background text-textMuted", children: "Or continue with" }) })] }), _jsxs("button", { onClick: handleGoogleSignIn, disabled: loading, className: "mt-4 w-full py-3 px-4 bg-backgroundElevated border-2 border-border text-textPrimary rounded-xl font-medium hover:bg-backgroundHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.98]", children: [_jsxs("svg", { className: "w-5 h-5", viewBox: "0 0 24 24", children: [_jsx("path", { fill: "currentColor", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), _jsx("path", { fill: "currentColor", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), _jsx("path", { fill: "currentColor", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), _jsx("path", { fill: "currentColor", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" })] }), "Google"] })] }), _jsxs("p", { className: "text-center text-sm text-textMuted", children: ["Don't have an account?", ' ', _jsx("button", { onClick: () => navigate('/signup'), className: "text-primary font-semibold hover:text-primaryHover transition-colors", children: "Sign up" })] })] }) })] }));
};
export default Login;
