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
    return (_jsxs("div", { className: "min-h-screen flex bg-background", children: [_jsxs("div", { className: "hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-accent/5 to-backgroundSubtle p-12 flex-col justify-between relative overflow-hidden", children: [_jsx("div", { className: "absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" }), _jsx("div", { className: "absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" }), _jsxs("div", { className: "relative z-10 flex flex-col h-full", children: [_jsxs(Link, { to: "/", className: "inline-flex items-center gap-2 mb-16 group hover:scale-105 transition-transform", children: [_jsx("span", { className: "text-xl font-bold text-textPrimary", children: "Kural" }), _jsx("img", { src: "/quotation-marks.png", alt: "Kural", className: "h-6 w-auto opacity-80 group-hover:opacity-100 transition-opacity" })] }), _jsxs("div", { className: "flex-1 flex flex-col justify-center max-w-md", children: [_jsxs("div", { className: "mb-8", children: [_jsxs("h1", { className: "text-5xl font-bold text-textPrimary mb-6 leading-[1.1]", children: ["Welcome", _jsx("br", {}), _jsx("span", { className: "bg-gradient-to-r from-primary via-accent to-accentSecondary bg-clip-text text-transparent", children: "back." })] }), _jsx("p", { className: "text-xl text-textSecondary leading-relaxed font-medium", children: "Your personalized feed is waiting. Every post explained. Every recommendation transparent." })] }), _jsxs("div", { className: "space-y-4 mt-10", children: [_jsxs("div", { className: "flex items-center gap-3 text-textPrimary", children: [_jsx("svg", { className: "w-5 h-5 text-accent flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" }) }), _jsx("span", { className: "text-base", children: "Your feed tuned to your preferences" })] }), _jsxs("div", { className: "flex items-center gap-3 text-textPrimary", children: [_jsx("svg", { className: "w-5 h-5 text-accent flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" }) }), _jsx("span", { className: "text-base", children: "Verified content only - no viral lies" })] }), _jsxs("div", { className: "flex items-center gap-3 text-textPrimary", children: [_jsx("svg", { className: "w-5 h-5 text-accent flex-shrink-0", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" }) }), _jsx("span", { className: "text-base", children: "Quality content gets recognized" })] })] })] })] })] }), _jsx("div", { className: "w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsx("div", { className: "lg:hidden mb-8", children: _jsxs(Link, { to: "/", className: "inline-flex items-center gap-2", children: [_jsx("span", { className: "text-xl font-bold text-textPrimary", children: "Kural" }), _jsx("img", { src: "/quotation-marks.png", alt: "Kural", className: "h-6 w-auto" })] }) }), _jsxs("div", { className: "lg:hidden mb-6 p-4 bg-gradient-to-br from-primary/10 via-accent/5 to-backgroundSubtle rounded-xl", children: [_jsx("h2", { className: "text-2xl font-bold text-textPrimary mb-2", children: "Welcome back" }), _jsx("p", { className: "text-sm text-textSecondary", children: "Your personalized feed is waiting" })] }), _jsxs("div", { className: "mb-8", children: [_jsx("h2", { className: "text-3xl font-bold text-textPrimary mb-3", children: "Sign in" }), _jsx("p", { className: "text-base text-textMuted", children: "Enter your credentials to continue" })] }), error && (_jsx("div", { className: "mb-6 p-4 bg-accent/10 border-2 border-accent/30 rounded-xl text-accent text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5 mb-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm font-medium text-textLabel mb-2", children: "Email" }), _jsx("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, className: "w-full px-4 py-3 bg-backgroundElevated border-2 border-border rounded-xl text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all", placeholder: "your@email.com" })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { htmlFor: "password", className: "block text-sm font-medium text-textLabel", children: "Password" }), _jsx("button", { type: "button", onClick: () => navigate('/forgot-password'), className: "text-sm text-primary font-medium hover:text-primaryHover transition-colors", children: "Forgot password?" })] }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, className: "w-full px-4 py-3 bg-backgroundElevated border-2 border-border rounded-xl text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full py-3 px-4 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-semibold hover:from-primaryHover hover:to-accentHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-button hover:shadow-buttonHover active:scale-[0.98]", children: loading ? 'Signing in...' : 'Sign in' })] }), _jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("div", { className: "w-full border-t border-border" }) }), _jsx("div", { className: "relative flex justify-center text-sm", children: _jsx("span", { className: "px-3 bg-background text-textMuted", children: "Or" }) })] }), _jsxs("button", { onClick: handleGoogleSignIn, disabled: loading, className: "mt-4 w-full py-3 px-4 bg-backgroundElevated border-2 border-border text-textPrimary rounded-xl font-medium hover:bg-backgroundHover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-[0.98]", children: [_jsxs("svg", { className: "w-5 h-5", viewBox: "0 0 24 24", children: [_jsx("path", { fill: "currentColor", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), _jsx("path", { fill: "currentColor", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), _jsx("path", { fill: "currentColor", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), _jsx("path", { fill: "currentColor", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" })] }), "Google"] })] }), _jsxs("p", { className: "text-center text-sm text-textMuted", children: ["Don't have an account?", ' ', _jsx("button", { onClick: () => navigate('/signup'), className: "text-primary font-semibold hover:text-primaryHover transition-colors", children: "Sign up" })] }), _jsxs("p", { className: "text-center text-sm text-textMuted mt-4", children: ["By signing in, you agree to our", ' ', _jsx(Link, { to: "/terms", className: "text-accent hover:text-accentHover underline font-medium", children: "Terms of Service" }), ' ', "and", ' ', _jsx(Link, { to: "/privacy", className: "text-accent hover:text-accentHover underline font-medium", children: "Privacy Policy" })] })] }) })] }));
};
export default Login;
