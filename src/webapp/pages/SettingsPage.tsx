import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import ForYouControls from '../components/ForYouControls';
import NotificationPreferences from '../components/NotificationPreferences';

const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'feed';

  return (
    <AppLayout pageTitle="Settings">
      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-border/60">
          <button
            onClick={() => setSearchParams({ tab: 'feed' })}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === 'feed'
                ? 'border-accent text-accent'
                : 'border-transparent text-textMuted hover:text-textPrimary'
            }`}
          >
            For You Feed
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'notifications' })}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === 'notifications'
                ? 'border-accent text-accent'
                : 'border-transparent text-textMuted hover:text-textPrimary'
            }`}
          >
            Notifications
          </button>
        </div>

        {/* Content */}
        {tab === 'feed' && (
          <>
            <h2 className="text-xl font-semibold text-textPrimary mb-6">For You Settings</h2>
            <ForYouControls />
          </>
        )}

        {tab === 'notifications' && (
          <>
            <h2 className="text-xl font-semibold text-textPrimary mb-6">Notification Preferences</h2>
            <NotificationPreferences />
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default SettingsPage;

