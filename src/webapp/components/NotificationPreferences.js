import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { useUserStore } from '../store/useUserStore';
const NotificationPreferences = () => {
    const { currentUser } = useUserStore();
    const { preferences, loadPreferences, updatePreferences } = useNotificationStore();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [localPreferences, setLocalPreferences] = useState(null);
    useEffect(() => {
        if (currentUser) {
            loadPreferences(currentUser.id).then(() => {
                // Load preferences will update the store
            });
        }
    }, [currentUser, loadPreferences]);
    useEffect(() => {
        if (preferences) {
            setLocalPreferences(preferences);
        }
    }, [preferences]);
    const handleToggle = async (field, value) => {
        if (!currentUser || !localPreferences)
            return;
        setLocalPreferences({
            ...localPreferences,
            [field]: value,
        });
        setIsSaving(true);
        try {
            await updatePreferences(currentUser.id, { [field]: value });
        }
        catch (error) {
            console.error('Error updating preferences:', error);
            // Revert on error
            if (preferences) {
                setLocalPreferences(preferences);
            }
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleArrayToggle = async (field, value, add) => {
        if (!currentUser || !localPreferences)
            return;
        const currentArray = localPreferences[field] || [];
        const newArray = add
            ? [...currentArray, value]
            : currentArray.filter((id) => id !== value);
        setLocalPreferences({
            ...localPreferences,
            [field]: newArray,
        });
        setIsSaving(true);
        try {
            await updatePreferences(currentUser.id, { [field]: newArray });
        }
        catch (error) {
            console.error('Error updating preferences:', error);
            // Revert on error
            if (preferences) {
                setLocalPreferences(preferences);
            }
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleTimeChange = async (field, value) => {
        await handleToggle(field, value);
    };
    if (!currentUser) {
        return (_jsx("div", { className: "p-4 text-textMuted text-sm", children: "Please sign in to manage notification preferences." }));
    }
    if (!localPreferences) {
        return (_jsx("div", { className: "p-4 text-textMuted text-sm", children: "Loading notification preferences..." }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-textPrimary mb-4", children: "Notification Types" }), _jsxs("div", { className: "space-y-4", children: [_jsx(NotificationToggle, { label: "Comments", description: "Get notified when someone comments on your posts", enabled: localPreferences.commentNotifications, onChange: (value) => handleToggle('commentNotifications', value) }), _jsx(NotificationToggle, { label: "Replies", description: "Get notified when someone replies to your comments", enabled: localPreferences.replyNotifications, onChange: (value) => handleToggle('replyNotifications', value) }), _jsx(NotificationToggle, { label: "Rechirps", description: "Get notified when someone rechirps your posts", enabled: localPreferences.rechirpNotifications, onChange: (value) => handleToggle('rechirpNotifications', value) }), _jsx(NotificationToggle, { label: "Follows", description: "Get notified when someone follows you", enabled: localPreferences.followNotifications, onChange: (value) => handleToggle('followNotifications', value) }), _jsx(NotificationToggle, { label: "Mentions", description: "Get notified when someone mentions you", enabled: localPreferences.mentionNotifications, onChange: (value) => handleToggle('mentionNotifications', value) })] })] }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-textPrimary mb-4", children: "Quiet Hours" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("label", { className: "text-sm text-textMuted", children: "Start time:" }), _jsx("input", { type: "time", value: localPreferences.quietHoursStart || '22:00', onChange: (e) => handleTimeChange('quietHoursStart', e.target.value), className: "px-3 py-2 bg-background/50 border border-border rounded-lg text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent/30" })] }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("label", { className: "text-sm text-textMuted", children: "End time:" }), _jsx("input", { type: "time", value: localPreferences.quietHoursEnd || '08:00', onChange: (e) => handleTimeChange('quietHoursEnd', e.target.value), className: "px-3 py-2 bg-background/50 border border-border rounded-lg text-textPrimary focus:outline-none focus:ring-2 focus:ring-accent/30" })] }), _jsx("p", { className: "text-xs text-textMuted", children: "During quiet hours, you won't receive push notifications, but notifications will still appear in your notification center." })] })] }), isSaving && (_jsx("div", { className: "text-xs text-textMuted", children: "Saving preferences..." }))] }));
};
const NotificationToggle = ({ label, description, enabled, onChange }) => {
    return (_jsxs("div", { className: "flex items-start justify-between gap-4 p-3 rounded-lg border border-border/40 bg-background/30 hover:bg-background/50 transition-colors", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("label", { className: "block text-sm font-medium text-textPrimary mb-1", children: label }), _jsx("p", { className: "text-xs text-textMuted", children: description })] }), _jsx("button", { onClick: () => onChange(!enabled), className: `relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 ${enabled ? 'bg-accent' : 'bg-backgroundElevated'}`, role: "switch", "aria-checked": enabled, children: _jsx("span", { className: `pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}` }) })] }));
};
export default NotificationPreferences;
