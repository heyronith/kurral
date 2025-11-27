import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';
const ConfirmDialog = ({ isOpen, title, message, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel, confirmVariant = 'danger', }) => {
    const { theme } = useThemeStore();
    // Close on Escape key
    useEffect(() => {
        if (!isOpen)
            return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onCancel();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onCancel]);
    if (!isOpen)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", onClick: onCancel, children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm" }), _jsxs("div", { className: "relative bg-card border border-border/60 rounded-xl shadow-elevated max-w-sm w-full p-6 space-y-4", onClick: (e) => e.stopPropagation(), children: [_jsx("h3", { className: "text-lg font-semibold text-textPrimary", children: title }), _jsx("p", { className: "text-sm text-textMuted leading-relaxed", children: message }), _jsxs("div", { className: "flex items-center gap-3 pt-2", children: [_jsx("button", { onClick: onCancel, className: `flex-1 px-4 py-2 text-sm font-medium text-textPrimary rounded-lg transition-all duration-200 active:scale-95 ${theme === 'dark' ? 'bg-white/10 hover:bg-white/20' : 'bg-backgroundElevated/60 hover:bg-backgroundElevated/80'}`, children: cancelText }), _jsx("button", { onClick: onConfirm, className: `flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 active:scale-95 ${confirmVariant === 'danger'
                                    ? 'bg-red-600 hover:bg-red-700'
                                    : 'bg-primary hover:bg-primaryHover'}`, children: confirmText })] })] })] }));
};
export default ConfirmDialog;
