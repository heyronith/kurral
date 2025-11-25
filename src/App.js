import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ChirpApp from './webapp/pages/ChirpApp';
import ProfilePage from './webapp/pages/ProfilePage';
import SettingsPage from './webapp/pages/SettingsPage';
import Login from './webapp/components/Login';
import Signup from './webapp/components/Signup';
import Onboarding from './webapp/components/Onboarding';
import ProtectedRoute from './webapp/components/ProtectedRoute';
import PostDetailView from './webapp/components/PostDetailView';
import BookmarksPage from './webapp/pages/BookmarksPage';
import NotificationsPage from './webapp/pages/NotificationsPage';
import { ComposerProvider } from './webapp/context/ComposerContext';
const App = () => {
    return (_jsx(BrowserRouter, { children: _jsx(ComposerProvider, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/lp", element: _jsx(LandingPage, {}) }), _jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/app", replace: true }) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/signup", element: _jsx(Signup, {}) }), _jsx(Route, { path: "/onboarding", element: _jsx(ProtectedRoute, { children: _jsx(Onboarding, {}) }) }), _jsx(Route, { path: "/app", element: _jsx(ProtectedRoute, { children: _jsx(ChirpApp, {}) }) }), _jsx(Route, { path: "/post/:postId", element: _jsx(ProtectedRoute, { children: _jsx(PostDetailView, {}) }) }), _jsx(Route, { path: "/profile/:userId", element: _jsx(ProtectedRoute, { children: _jsx(ProfilePage, {}) }) }), _jsx(Route, { path: "/bookmarks", element: _jsx(ProtectedRoute, { children: _jsx(BookmarksPage, {}) }) }), _jsx(Route, { path: "/settings", element: _jsx(ProtectedRoute, { children: _jsx(SettingsPage, {}) }) }), _jsx(Route, { path: "/notifications", element: _jsx(ProtectedRoute, { children: _jsx(NotificationsPage, {}) }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) }));
};
export default App;
