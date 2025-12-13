import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { authService } from '../lib/auth';
const ProtectedRoute = ({ children }) => {
    const { currentUser, setCurrentUser } = useUserStore();
    const [isLoading, setIsLoading] = useState(true);
    const location = useLocation();
    useEffect(() => {
        // Set up auth state listener
        const unsubscribe = authService.onAuthStateChanged((user) => {
            setCurrentUser(user);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [setCurrentUser]);
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background", children: _jsx("div", { className: "text-textMuted", children: "Loading..." }) }));
    }
    if (!currentUser) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    // Check if onboarding is completed
    // Allow access to onboarding page itself
    if (!currentUser.onboardingCompleted && location.pathname !== '/onboarding') {
        return _jsx(Navigate, { to: "/onboarding", replace: true });
    }
    // Redirect away from onboarding if already completed
    if (currentUser.onboardingCompleted && location.pathname === '/onboarding') {
        return _jsx(Navigate, { to: "/app", replace: true });
    }
    return _jsx(_Fragment, { children: children });
};
export default ProtectedRoute;
