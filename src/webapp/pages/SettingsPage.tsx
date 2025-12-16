import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import ForYouControls from '../components/ForYouControls';
import NotificationPreferences from '../components/NotificationPreferences';
import { useThemeStore } from '../store/useThemeStore';
import { useUserStore } from '../store/useUserStore';
import { userService } from '../lib/firestore';
import { authService } from '../lib/auth';

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'feed';
  const { theme } = useThemeStore();
  const { currentUser, setCurrentUser } = useUserStore();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    if (!currentUser) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      // Delete all user data
      const result = await userService.deleteAccount(currentUser.id);
      
      console.log('Account deletion result:', result);

      // Sign out the user
      await authService.signOut();
      setCurrentUser(null);

      // Redirect to landing page
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setDeleteError(error.message || 'Failed to delete account. Please try again or contact support.');
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout pageTitle="Settings">
      <div className="p-6">
        {/* Tabs */}
        <div className={`flex gap-4 mb-6 border-b ${theme === 'dark' ? 'border-white/10' : 'border-border/60'}`}>
          <button
            onClick={() => setSearchParams({ tab: 'feed' })}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === 'feed'
                ? 'border-accent text-accent'
                : theme === 'dark' ? 'border-transparent text-white/70 hover:text-white' : 'border-transparent text-textMuted hover:text-textPrimary'
            }`}
          >
            For You Feed
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'notifications' })}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === 'notifications'
                ? 'border-accent text-accent'
                : theme === 'dark' ? 'border-transparent text-white/70 hover:text-white' : 'border-transparent text-textMuted hover:text-textPrimary'
            }`}
          >
            Notifications
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'account' })}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === 'account'
                ? 'border-accent text-accent'
                : theme === 'dark' ? 'border-transparent text-white/70 hover:text-white' : 'border-transparent text-textMuted hover:text-textPrimary'
            }`}
          >
            Account
          </button>
        </div>

        {/* Content */}
        {tab === 'feed' && (
          <>
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`}>For You Settings</h2>
            <ForYouControls />
          </>
        )}

        {tab === 'notifications' && (
          <>
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`}>Notification Preferences</h2>
            <NotificationPreferences />
          </>
        )}

        {tab === 'account' && (
          <>
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-6`}>Account Settings</h2>
            
            <div className={`p-6 rounded-lg border-2 ${theme === 'dark' ? 'border-red-500/30 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
              <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-red-900'}`}>
                Delete Account
              </h3>
              <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-white/80' : 'text-red-800'}`}>
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-red-700'}`}>
                This will delete all your posts, comments, bookmarks, and profile data immediately. Your Firebase Auth account will be scheduled for deletion separately (this may take up to 24 hours to process via our backend systems).
              </p>

              {deleteError && (
                <div className={`mb-4 p-3 rounded-lg ${theme === 'dark' ? 'bg-red-500/20 border border-red-500/50 text-red-300' : 'bg-red-100 border border-red-300 text-red-700'} text-sm`}>
                  {deleteError}
                </div>
              )}

              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isDeleting ? 'Deleting Account...' : 'Delete My Account'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`max-w-md w-full mx-4 p-6 rounded-lg ${theme === 'dark' ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'} shadow-xl`}>
            <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Delete Account
            </h3>
            <p className={`mb-6 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
              Are you sure you want to delete your account? This will permanently delete:
            </p>
            <ul className={`list-disc list-inside mb-6 space-y-1 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'} text-sm`}>
              <li>All your posts and comments</li>
              <li>Your profile and account data</li>
              <li>Your bookmarks and following list</li>
              <li>All images you've uploaded</li>
            </ul>
            <p className={`mb-6 text-sm ${theme === 'dark' ? 'text-red-400' : 'text-red-600'} font-medium`}>
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900 disabled:opacity-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default SettingsPage;

