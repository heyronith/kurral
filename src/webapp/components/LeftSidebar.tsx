import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { NewspaperIcon, SettingsIcon, BellIcon, ShieldCheckIcon, ComposeIcon, BookmarkIcon } from './Icon';
import IntegrityPrincipleModal from './IntegrityPrincipleModal';
import { useComposer } from '../context/ComposerContext';

const LeftSidebar = () => {
  const { currentUser } = useUserStore();
  const { unreadCount } = useNotificationStore();
  const location = useLocation();
  const [showIntegrityModal, setShowIntegrityModal] = useState(false);
  const { showComposer, hideComposer, isComposerVisible } = useComposer();

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    { path: '/app', label: 'Feed', icon: NewspaperIcon, notificationCount: null, onClick: null },
    { path: '/notifications', label: 'Notifications', icon: BellIcon, notificationCount: unreadCount > 0 ? unreadCount : null, onClick: null },
    { path: '/bookmarks', label: 'Bookmarks', icon: BookmarkIcon, notificationCount: null, onClick: null },
    { path: '/settings', label: 'Settings', icon: SettingsIcon, notificationCount: null, onClick: null },
    { path: '', label: 'Our Integrity Principle', icon: ShieldCheckIcon, notificationCount: null, onClick: () => setShowIntegrityModal(true) },
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

  return (
    <>
      <aside className="fixed left-0 top-[68px] h-[calc(100vh-68px)] w-64 bg-background border-r-2 border-border/60 flex flex-col z-30 hidden lg:flex">
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
                  className="w-12 h-12 rounded-full object-cover border-2 border-border/50 group-hover:border-accent/50 transition-colors"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center border-2 border-border/50 group-hover:border-accent/50 transition-colors">
                  <span className="text-white font-semibold text-sm">{userInitials}</span>
                </div>
              )}
              {/* Decorative gradient circle behind profile picture */}
              <div className="absolute -left-2 -top-1 w-6 h-6 rounded-full bg-gradient-to-br from-accent via-primary to-accentSecondary opacity-80 border-2 border-background" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-textPrimary truncate group-hover:text-accent transition-colors">
                {currentUser?.name || 'User'}
              </div>
              <div className="text-xs text-textMuted truncate">
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
                    className={active ? 'text-white' : 'text-textMuted group-hover:text-textPrimary'}
                  />
                  <span className="flex-1 text-sm">{item.label}</span>
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
                          ? 'bg-black text-white font-semibold shadow-subtle'
                          : 'text-textMuted hover:text-textPrimary hover:bg-backgroundElevated/60'
                      }`}
                    >
                      {content}
                    </button>
                  ) : (
                    <Link
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                        active
                          ? 'bg-black text-white font-semibold shadow-subtle'
                          : 'text-textMuted hover:text-textPrimary hover:bg-backgroundElevated/60'
                      }`}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Compose Button - At the bottom */}
        <div className="px-4 pb-4 mt-auto">
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

