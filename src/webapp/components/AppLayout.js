import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../lib/auth';
import LeftSidebar from './LeftSidebar';
import RightPanel from './RightPanel';
import Composer from './Composer';
import { useComposer } from '../context/ComposerContext';
const AppLayout = ({ children, pageTitle, pageTitleRight, wrapContent = true }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isComposerVisible, hideComposer } = useComposer();
    const showComposer = location.pathname === '/app' && isComposerVisible;
    // Hide composer when navigating away from /app
    useEffect(() => {
        if (location.pathname !== '/app') {
            hideComposer();
        }
    }, [location.pathname, hideComposer]);
    const handleSignOut = async () => {
        try {
            await authService.signOut();
            navigate('/');
        }
        catch (error) {
            console.error('Error signing out:', error);
        }
    };
    return (_jsxs("div", { className: "min-h-screen bg-background text-textPrimary flex flex-col", children: [_jsx("header", { className: "sticky top-0 z-40 border-b-2 border-border/60 bg-background/95 backdrop-blur-lg py-4 px-6 shadow-elevated w-full", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h1", { className: "text-xl md:text-2xl font-bold text-textPrimary tracking-tight", children: "Kurral" }), _jsx("img", { src: "/quotation-marks.png", alt: "Kurral", className: "h-6 w-auto md:h-7" })] }), _jsx("div", { className: "flex items-center gap-3", children: _jsx("button", { onClick: handleSignOut, className: "hidden sm:block text-sm font-medium text-textMuted hover:text-accent transition-all duration-200 px-3 py-1.5 rounded-lg hover:bg-backgroundElevated/60 active:scale-95", children: "Sign out" }) })] }) }), _jsxs("div", { className: "flex flex-1 relative", children: [_jsx(LeftSidebar, {}), _jsx("div", { className: "flex-1 flex flex-col lg:ml-64", children: _jsxs("main", { className: "flex-1 flex gap-6 px-4 py-6 max-w-[1600px] mx-auto w-full", children: [wrapContent ? (_jsxs("section", { className: "flex-1 min-w-0 rounded-2xl border-2 border-border/60 bg-card/50 shadow-card backdrop-blur-md overflow-hidden transition-all duration-300 hover:shadow-cardHover", children: [pageTitle && (_jsxs("div", { className: "px-6 pt-6 pb-4 border-b-2 border-border/60 flex items-center justify-between", children: [_jsx("h2", { className: "text-2xl font-bold text-textPrimary", children: pageTitle }), pageTitleRight && (_jsx("div", { className: "flex items-center", children: pageTitleRight }))] })), children] })) : (_jsxs("div", { className: "flex-1 min-w-0", children: [pageTitle && (_jsxs("div", { className: "mb-6 flex items-center justify-between", children: [_jsx("h2", { className: "text-2xl font-bold text-textPrimary", children: pageTitle }), pageTitleRight && (_jsx("div", { className: "flex items-center", children: pageTitleRight }))] })), children] })), _jsx(RightPanel, {})] }) })] }), showComposer && _jsx(Composer, {})] }));
};
export default AppLayout;
