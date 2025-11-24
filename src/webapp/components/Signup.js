import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { authService } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
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
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background px-4", children: _jsx("div", { className: "w-full max-w-md", children: _jsxs("div", { className: "bg-background/50 border border-border rounded-3xl p-8 shadow-lg", children: [_jsx("h1", { className: "text-2xl font-bold text-textPrimary mb-2", children: "Create account" }), _jsx("p", { className: "text-textMuted mb-6", children: "Sign up to get started" }), error && (_jsx("div", { className: "mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-sm", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "name", className: "block text-sm text-textLabel mb-2", children: "Name" }), _jsx("input", { id: "name", type: "text", value: name, onChange: (e) => setName(e.target.value), required: true, className: "w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "Your name" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "handle", className: "block text-sm text-textLabel mb-2", children: "Handle" }), _jsx("input", { id: "handle", type: "text", value: handle, onChange: (e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')), required: true, pattern: "[a-zA-Z0-9_]+", className: "w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "username" }), _jsx("p", { className: "mt-1 text-xs text-textMuted", children: "Only letters, numbers, and underscores" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "email", className: "block text-sm text-textLabel mb-2", children: "Email" }), _jsx("input", { id: "email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), required: true, className: "w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "your@email.com" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-sm text-textLabel mb-2", children: "Password" }), _jsx("input", { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), required: true, minLength: 6, className: "w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "confirmPassword", className: "block text-sm text-textLabel mb-2", children: "Confirm Password" }), _jsx("input", { id: "confirmPassword", type: "password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), required: true, className: "w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-textPrimary placeholder-textMuted focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsx("button", { type: "submit", disabled: loading, className: "w-full py-2 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed", children: loading ? 'Creating account...' : 'Sign up' })] }), _jsxs("div", { className: "mt-6", children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("div", { className: "w-full border-t border-border" }) }), _jsx("div", { className: "relative flex justify-center text-sm", children: _jsx("span", { className: "px-2 bg-background/50 text-textMuted", children: "Or" }) })] }), _jsxs("button", { onClick: handleGoogleSignIn, disabled: loading, className: "mt-4 w-full py-2 px-4 bg-background/50 border border-border text-textPrimary rounded-lg font-medium hover:bg-background/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2", children: [_jsxs("svg", { className: "w-5 h-5", viewBox: "0 0 24 24", children: [_jsx("path", { fill: "currentColor", d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" }), _jsx("path", { fill: "currentColor", d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" }), _jsx("path", { fill: "currentColor", d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" }), _jsx("path", { fill: "currentColor", d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" })] }), "Sign up with Google"] })] }), _jsxs("p", { className: "mt-6 text-center text-sm text-textMuted", children: ["Already have an account?", ' ', _jsx("button", { onClick: () => navigate('/login'), className: "text-primary hover:underline", children: "Sign in" })] })] }) }) }));
};
export default Signup;
