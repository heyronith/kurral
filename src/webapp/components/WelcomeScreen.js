import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useUserStore } from '../store/useUserStore';
import { userService } from '../lib/firestore';
const WelcomeScreen = ({ onComplete }) => {
    const { currentUser, setCurrentUser } = useUserStore();
    const message = useMemo(() => {
        if (!currentUser)
            return '';
        return `Welcome back, ${currentUser.displayName || currentUser.name || 'friend'}!`;
    }, [currentUser]);
    const handleProceed = async () => {
        if (!currentUser) {
            onComplete();
            return;
        }
        try {
            await userService.updateUser(currentUser.id, { firstTimeUser: false });
            const refreshed = await userService.getUser(currentUser.id);
            if (refreshed) {
                setCurrentUser(refreshed);
            }
        }
        catch (error) {
            console.error('[WelcomeScreen] Error clearing first-time flag:', error);
        }
        finally {
            onComplete();
        }
    };
    if (!currentUser)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4", children: _jsxs("div", { className: "w-full max-w-md rounded-3xl border border-border bg-backgroundElevated p-6 text-center", children: [_jsx("p", { className: "text-xl font-semibold text-textPrimary mb-3", children: message }), _jsx("p", { className: "text-sm text-textMuted mb-4", children: "Your feed is tuned and ready. This is where transparency, fact-checking, and the Kurral Score meet." }), _jsx("button", { onClick: handleProceed, className: "w-full rounded-2xl bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-white transition-all hover:from-primaryHover hover:to-accentHover", children: "Explore the feed" })] }) }));
};
export default WelcomeScreen;
