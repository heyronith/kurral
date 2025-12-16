import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useThemeStore } from '../store/useThemeStore';
import { NewspaperIcon, SettingsIcon, BellIcon, ShieldCheckIcon, ComposeIcon, BookmarkIcon, DashboardIcon } from './Icon';
import IntegrityPrincipleModal from './IntegrityPrincipleModal';
import { useComposer } from '../context/ComposerContext';
import { feedbackService } from '../lib/services/feedbackService';
const LeftSidebar = () => {
    const { currentUser } = useUserStore();
    const { unreadCount } = useNotificationStore();
    const location = useLocation();
    const [showIntegrityModal, setShowIntegrityModal] = useState(false);
    const { showComposer, hideComposer, isComposerVisible } = useComposer();
    const { theme } = useThemeStore();
    const [feedbackText, setFeedbackText] = useState('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState(null);
    const isActive = (path) => {
        if (path === '/app') {
            return location.pathname === '/app';
        }
        return location.pathname.startsWith(path);
    };
    const menuItems = [
        { path: '/app', label: 'Kurals', icon: NewspaperIcon, notificationCount: null, onClick: null },
        { path: '/app/dashboard', label: 'Dashboard', icon: DashboardIcon, notificationCount: null, onClick: null },
        { path: '/app/notifications', label: 'Notifications', icon: BellIcon, notificationCount: unreadCount > 0 ? unreadCount : null, onClick: null },
        { path: '/app/bookmarks', label: 'Bookmarks', icon: BookmarkIcon, notificationCount: null, onClick: null },
        { path: '/app/settings', label: 'Settings', icon: SettingsIcon, notificationCount: null, onClick: null },
        { path: '', label: 'Our Approach', icon: ShieldCheckIcon, notificationCount: null, onClick: () => setShowIntegrityModal(true) },
    ];
    const userInitials = currentUser?.name
        ?.split(' ')
        .map((part) => part[0]?.toUpperCase())
        .join('')
        .slice(0, 2) || 'U';
    const handleComposeClick = () => {
        if (isComposerVisible) {
            // Hide the composer
            hideComposer();
        }
        else {
            // Show the composer
            showComposer();
            // Focus the input after a short delay to ensure it's rendered
            setTimeout(() => {
                document.getElementById('composer-input')?.focus();
            }, 100);
        }
    };
    const handleSubmitFeedback = async () => {
        if (!feedbackText.trim() || !currentUser?.id) {
            return;
        }
        setIsSubmittingFeedback(true);
        setFeedbackMessage(null);
        try {
            await feedbackService.submitFeedback(currentUser.id, feedbackText);
            setFeedbackText('');
            setFeedbackMessage({ type: 'success', text: 'Thank you for your feedback!' });
            // Clear success message after 3 seconds
            setTimeout(() => {
                setFeedbackMessage(null);
            }, 3000);
        }
        catch (error) {
            console.error('Error submitting feedback:', error);
            setFeedbackMessage({ type: 'error', text: 'Failed to submit feedback. Please try again.' });
            // Clear error message after 5 seconds
            setTimeout(() => {
                setFeedbackMessage(null);
            }, 5000);
        }
        finally {
            setIsSubmittingFeedback(false);
        }
    };
    return (_jsxs(_Fragment, { children: [_jsxs("aside", { className: `fixed left-0 top-[68px] h-[calc(100vh-68px)] w-64 ${theme === 'dark' ? 'bg-darkBg border-r border-darkBorder' : 'bg-backgroundElevated'} flex flex-col z-30 hidden lg:flex`, children: [_jsx("div", { className: "px-4 pt-[48px] pb-4", children: _jsxs(Link, { to: `/app/profile/${currentUser?.id || ''}`, className: "flex items-center gap-3 group", children: [_jsx("div", { className: "relative flex-shrink-0", children: currentUser?.profilePictureUrl ? (_jsx("img", { src: currentUser.profilePictureUrl, alt: currentUser.name, className: `w-12 h-12 rounded-full object-cover ${theme === 'dark' ? '' : 'border-2 border-border/50 group-hover:border-accent/50'} transition-colors` })) : (_jsx("div", { className: `w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ${theme === 'dark' ? '' : 'border-2 border-border/50 group-hover:border-accent/50'} transition-colors`, children: _jsx("span", { className: "text-white font-semibold text-sm", children: userInitials }) })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: `font-semibold text-sm truncate group-hover:text-accent transition-colors ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`, children: currentUser?.name || 'User' }), _jsxs("div", { className: `text-xs truncate ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`, children: ["@", currentUser?.handle || 'username'] })] })] }) }), _jsxs("nav", { className: "flex-1 px-2 overflow-y-auto", children: [_jsx("ul", { className: "space-y-1", children: menuItems.map((item) => {
                                    const Icon = item.icon;
                                    const active = item.path ? isActive(item.path) : false;
                                    const showBadge = item.notificationCount !== null && item.notificationCount > 0;
                                    const content = (_jsxs(_Fragment, { children: [_jsx(Icon, { size: 20, className: active ? 'text-white' : theme === 'dark' ? 'text-darkTextMuted group-hover:text-darkTextPrimary' : 'text-textMuted group-hover:text-textPrimary' }), _jsx("span", { className: `flex-1 text-sm ${theme === 'dark' ? 'text-darkTextPrimary' : 'text-textPrimary'}`, children: item.label }), showBadge && (_jsx("span", { className: `px-2 py-0.5 rounded-full text-xs font-semibold min-w-[20px] text-center ${active
                                                    ? 'bg-white/20 text-white'
                                                    : theme === 'dark' ? 'bg-accent text-white' : 'bg-accent text-white'}`, children: item.notificationCount }))] }));
                                    return (_jsx("li", { children: item.onClick ? (_jsx("button", { onClick: item.onClick, className: `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative w-full text-left ${active
                                                ? 'bg-accent text-white font-semibold shadow-subtle'
                                                : theme === 'dark' ? 'text-darkTextMuted hover:text-darkTextPrimary hover:bg-white/10' : 'text-textMuted hover:text-textPrimary hover:bg-backgroundHover'}`, children: content })) : (_jsx(Link, { to: item.path, className: `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${active
                                                ? 'bg-accent text-white font-semibold shadow-subtle'
                                                : theme === 'dark' ? 'text-darkTextMuted hover:text-darkTextPrimary hover:bg-white/10' : 'text-textMuted hover:text-textPrimary hover:bg-backgroundHover'}`, children: content })) }, item.label));
                                }) }), _jsxs("div", { className: `px-2 pt-4 mt-2 ${theme === 'dark' ? 'border-t border-darkBorder' : ''}`, children: [_jsxs("div", { className: "mb-2", children: [_jsx("label", { className: `block text-xs font-medium mb-2 ${theme === 'dark' ? 'text-darkTextMuted' : 'text-textMuted'}`, children: "Help us improve" }), _jsx("textarea", { value: feedbackText, onChange: (e) => setFeedbackText(e.target.value), placeholder: "Share your thoughts, suggestions, or report issues...", className: `w-full min-h-[80px] px-3 py-2 rounded-lg text-sm resize-none border-2 outline-none focus:ring-2 transition-all duration-200 ${theme === 'dark'
                                                    ? 'bg-white/10 border-darkBorder text-darkTextPrimary placeholder:text-darkTextMuted focus:border-accent/60 focus:ring-accent/20'
                                                    : 'bg-backgroundSubtle border-border text-textPrimary placeholder:text-textMuted focus:border-accent/60 focus:ring-accent/20'}`, disabled: isSubmittingFeedback })] }), feedbackMessage && (_jsx("div", { className: `mb-2 px-3 py-2 rounded-lg text-xs font-medium ${feedbackMessage.type === 'success'
                                            ? theme === 'dark'
                                                ? 'bg-success/20 text-success border border-success/30'
                                                : 'bg-success/10 text-success border border-success/30'
                                            : theme === 'dark'
                                                ? 'bg-error/20 text-error border border-error/30'
                                                : 'bg-error/10 text-error border border-error/30'}`, children: feedbackMessage.text })), _jsx("button", { onClick: handleSubmitFeedback, disabled: !feedbackText.trim() || isSubmittingFeedback, className: `w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 ${feedbackText.trim() && !isSubmittingFeedback
                                            ? 'bg-accent text-white hover:bg-accentHover active:scale-95'
                                            : theme === 'dark'
                                                ? 'bg-white/10 text-darkTextMuted cursor-not-allowed'
                                                : 'bg-backgroundHover text-textMuted cursor-not-allowed'}`, children: isSubmittingFeedback ? (_jsxs("span", { className: "flex items-center justify-center gap-2", children: [_jsxs("svg", { className: "animate-spin h-4 w-4", xmlns: "http://www.w3.org/2000/svg", fill: "none", viewBox: "0 0 24 24", children: [_jsx("circle", { className: "opacity-25", cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "4" }), _jsx("path", { className: "opacity-75", fill: "currentColor", d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" })] }), "Sending..."] })) : ('Send Feedback') })] })] }), _jsx("div", { className: "px-4 pb-4", children: _jsxs("button", { onClick: handleComposeClick, className: "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-primary to-accent text-white font-semibold text-sm transition-all duration-200 hover:from-primaryHover hover:to-accentHover hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-button hover:shadow-buttonHover", "aria-label": isComposerVisible ? "Close composer" : "Compose", children: [_jsx(ComposeIcon, { size: 18 }), _jsx("span", { children: isComposerVisible ? 'Close composer' : 'Compose' })] }) })] }), _jsx(IntegrityPrincipleModal, { isOpen: showIntegrityModal, onClose: () => setShowIntegrityModal(false) })] }));
};
export default LeftSidebar;
