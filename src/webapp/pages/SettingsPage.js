import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import ForYouControls from '../components/ForYouControls';
import NotificationPreferences from '../components/NotificationPreferences';
const SettingsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') || 'feed';
    return (_jsx(AppLayout, { pageTitle: "Settings", children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex gap-4 mb-6 border-b border-border/60", children: [_jsx("button", { onClick: () => setSearchParams({ tab: 'feed' }), className: `px-4 py-2 text-sm font-medium transition-colors border-b-2 ${tab === 'feed'
                                ? 'border-accent text-accent'
                                : 'border-transparent text-textMuted hover:text-textPrimary'}`, children: "For You Feed" }), _jsx("button", { onClick: () => setSearchParams({ tab: 'notifications' }), className: `px-4 py-2 text-sm font-medium transition-colors border-b-2 ${tab === 'notifications'
                                ? 'border-accent text-accent'
                                : 'border-transparent text-textMuted hover:text-textPrimary'}`, children: "Notifications" })] }), tab === 'feed' && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold text-textPrimary mb-6", children: "For You Settings" }), _jsx(ForYouControls, {})] })), tab === 'notifications' && (_jsxs(_Fragment, { children: [_jsx("h2", { className: "text-xl font-semibold text-textPrimary mb-6", children: "Notification Preferences" }), _jsx(NotificationPreferences, {})] }))] }) }));
};
export default SettingsPage;
