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
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    { path: '/app', label: 'Feed', icon: NewspaperIcon, notificationCount: null, onClick: null },
    { path: '/dashboard', label: 'Dashboard', icon: DashboardIcon, notificationCount: null, onClick: null },
    { path: '/notifications', label: 'Notifications', icon: BellIcon, notificationCount: unreadCount > 0 ? unreadCount : null, onClick: null },
    { path: '/bookmarks', label: 'Bookmarks', icon: BookmarkIcon, notificationCount: null, onClick: null },
    { path: '/settings', label: 'Settings', icon: SettingsIcon, notificationCount: null, onClick: null },
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
    } else {
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
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setFeedbackMessage({ type: 'error', text: 'Failed to submit feedback. Please try again.' });
      // Clear error message after 5 seconds
      setTimeout(() => {
        setFeedbackMessage(null);
      }, 5000);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <>
      <aside className={`fixed left-0 top-[68px] h-[calc(100vh-68px)] w-64 ${theme === 'dark' ? 'bg-transparent border-white/20' : 'bg-background border-border/60'} border-r-2 flex flex-col z-30 hidden lg:flex`}>
        {/* User Profile Section */}
        <div className="px-4 pt-[48px] pb-4">
          <Link
            to={`/profile/${currentUser?.id || ''}`}
            className="flex items-center gap-3 group"
          >
            <div className="relative flex-shrink-0">
              {currentUser?.profilePictureUrl ? (
                <img
                  src={currentUser.profilePictureUrl}
                  alt={currentUser.name}
                  className={`w-12 h-12 rounded-full object-cover ${theme === 'dark' ? '' : 'border-2 border-border/50 group-hover:border-accent/50'} transition-colors`}
                />
              ) : (
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center ${theme === 'dark' ? '' : 'border-2 border-border/50 group-hover:border-accent/50'} transition-colors`}>
                  <span className="text-white font-semibold text-sm">{userInitials}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} truncate group-hover:text-accent transition-colors`}>
                {currentUser?.name || 'User'}
              </div>
              <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} truncate`}>
                @{currentUser?.handle || 'username'}
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-2 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = item.path ? isActive(item.path) : false;
              const showBadge = item.notificationCount !== null && item.notificationCount > 0;
              
              const content = (
                <>
                  <Icon
                    size={20}
                    className={active ? 'text-white' : theme === 'dark' ? 'text-white/70 group-hover:text-white' : 'text-textMuted group-hover:text-textPrimary'}
                  />
                  <span className={`flex-1 text-sm ${theme === 'dark' ? 'text-white' : ''}`}>{item.label}</span>
                  {showBadge && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold min-w-[20px] text-center ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-black text-white'
                      }`}
                    >
                      {item.notificationCount}
                    </span>
                  )}
                </>
              );
              
              return (
                <li key={item.label}>
                  {item.onClick ? (
                    <button
                      onClick={item.onClick}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative w-full text-left ${
                        active
                          ? theme === 'dark' ? 'bg-white/20 text-white font-semibold' : 'bg-black text-white font-semibold shadow-subtle'
                          : theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-textMuted hover:text-textPrimary hover:bg-backgroundElevated/60'
                      }`}
                    >
                      {content}
                    </button>
                  ) : (
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                        active
                          ? theme === 'dark' ? 'bg-white/20 text-white font-semibold' : 'bg-black text-white font-semibold shadow-subtle'
                          : theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-textMuted hover:text-textPrimary hover:bg-backgroundElevated/60'
                      }`}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          
          {/* Feedback Section - Right below "Our Approach" */}
          <div className="px-2 pt-4 mt-2 border-t-2 border-border/60">
            <div className="mb-2">
              <label className={`block text-xs font-medium mb-2 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
                Help us improve
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Share your thoughts, suggestions, or report issues..."
                className={`w-full min-h-[80px] px-3 py-2 rounded-lg text-sm resize-none ${
                  theme === 'dark'
                    ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-accent/60 focus:ring-accent/20'
                    : 'bg-card/40 border-border/60 text-textPrimary placeholder:text-textMuted/60 focus:border-accent/60 focus:ring-accent/20'
                } border-2 outline-none focus:ring-2 transition-all duration-200`}
                disabled={isSubmittingFeedback}
              />
            </div>
            {feedbackMessage && (
              <div
                className={`mb-2 px-3 py-2 rounded-lg text-xs font-medium ${
                  feedbackMessage.type === 'success'
                    ? theme === 'dark'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-green-100 text-green-700 border border-green-300'
                    : theme === 'dark'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-red-100 text-red-700 border border-red-300'
                }`}
              >
                {feedbackMessage.text}
              </div>
            )}
            <button
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim() || isSubmittingFeedback}
              className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                feedbackText.trim() && !isSubmittingFeedback
                  ? theme === 'dark'
                    ? 'bg-black text-white hover:bg-black/80 active:scale-95'
                    : 'bg-black text-white hover:bg-black/80 active:scale-95'
                  : theme === 'dark'
                  ? 'bg-white/10 text-white/50 cursor-not-allowed'
                  : 'bg-backgroundElevated/50 text-textMuted cursor-not-allowed'
              } focus:outline-none focus:ring-2 focus:ring-black/40`}
            >
              {isSubmittingFeedback ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send Feedback'
              )}
            </button>
          </div>
        </nav>

        {/* Compose Button - At the bottom */}
        <div className="px-4 pb-4">
          <button
            onClick={handleComposeClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-primary to-accent text-white font-semibold text-sm transition-all duration-200 hover:from-primaryHover hover:to-accentHover hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-button hover:shadow-buttonHover"
            aria-label={isComposerVisible ? "Close composer" : "Compose"}
          >
            <ComposeIcon size={18} />
            <span>{isComposerVisible ? 'Close composer' : 'Compose'}</span>
          </button>
        </div>
      </aside>

      {/* Integrity Principle Modal */}
      <IntegrityPrincipleModal
        isOpen={showIntegrityModal}
        onClose={() => setShowIntegrityModal(false)}
      />
    </>
  );
};

export default LeftSidebar;

