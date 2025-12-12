import { useState, useEffect } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { useUserStore } from '../store/useUserStore';
import { useThemeStore } from '../store/useThemeStore';
import type { NotificationPreferences as NotificationPreferencesType } from '../types';
import { pushNotificationService } from '../lib/services/pushNotificationService';

const NotificationPreferences = () => {
  const { currentUser } = useUserStore();
  const { preferences, loadPreferences, updatePreferences } = useNotificationStore();
  const { theme } = useThemeStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferencesType | null>(null);
  const [pushStatus, setPushStatus] = useState<NotificationPermission>(() => Notification.permission);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

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

  const handleEnablePush = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setPushMessage(null);
    try {
      const token = await pushNotificationService.registerPush(currentUser.id);
      setPushStatus(Notification.permission);
      setPushMessage('Push notifications enabled.');
      console.log('Push token registered', token);
    } catch (error: any) {
      console.error('Error enabling push notifications:', error);
      setPushMessage(error?.message || 'Failed to enable push notifications.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisablePush = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    setPushMessage(null);
    try {
      await pushNotificationService.unregisterPush(currentUser.id);
      setPushMessage('Push notifications disabled for this device.');
    } catch (error: any) {
      console.error('Error disabling push notifications:', error);
      setPushMessage(error?.message || 'Failed to disable push notifications.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (field: keyof NotificationPreferencesType, value: boolean | string) => {
    if (!currentUser || !localPreferences) return;
    
    setLocalPreferences({
      ...localPreferences,
      [field]: value,
    });
    
    setIsSaving(true);
    try {
      await updatePreferences(currentUser.id, { [field]: value });
    } catch (error) {
      console.error('Error updating preferences:', error);
      // Revert on error
      if (preferences) {
        setLocalPreferences(preferences);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleArrayToggle = async (
    field: 'mutedUserIds' | 'mutedChirpIds' | 'mutedThreadIds',
    value: string,
    add: boolean
  ) => {
    if (!currentUser || !localPreferences) return;
    
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
    } catch (error) {
      console.error('Error updating preferences:', error);
      // Revert on error
      if (preferences) {
        setLocalPreferences(preferences);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimeChange = async (field: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    await handleToggle(field, value);
  };

  if (!currentUser) {
    return (
      <div className={`p-4 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} text-sm`}>
        Please sign in to manage notification preferences.
      </div>
    );
  }

  if (!localPreferences) {
    return (
      <div className={`p-4 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'} text-sm`}>
        Loading notification preferences...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-4`}>Browser Push Notifications</h3>
        <p className={`text-sm mb-3 ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
          Receive notifications even when the website is closed (uses your browser&apos;s notification permission).
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className={`text-sm ${theme === 'dark' ? 'text-white/80' : 'text-textPrimary'}`}>
              Status: {pushStatus === 'granted' ? 'Enabled' : pushStatus === 'denied' ? 'Denied' : 'Not granted'}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleEnablePush}
              disabled={isSaving}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-accent text-white hover:bg-accent/90 disabled:bg-white/10'
                  : 'bg-accent text-white hover:bg-accent/90 disabled:bg-backgroundElevated'
              }`}
            >
              Enable push
            </button>
            <button
              onClick={handleDisablePush}
              disabled={isSaving}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                theme === 'dark'
                  ? 'border-white/30 text-white hover:bg-white/10 disabled:border-white/10'
                  : 'border-border text-textPrimary hover:bg-backgroundElevated/60 disabled:border-border/40'
              }`}
            >
              Disable on this device
            </button>
          </div>
          {pushMessage && (
            <p className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>{pushMessage}</p>
          )}
        </div>
      </div>

      <div>
        <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-4`}>Notification Types</h3>
        <div className="space-y-4">
          <NotificationToggle
            label="Comments"
            description="Get notified when someone comments on your posts"
            enabled={localPreferences.commentNotifications}
            onChange={(value) => handleToggle('commentNotifications', value)}
            theme={theme}
          />
          <NotificationToggle
            label="Replies"
            description="Get notified when someone replies to your comments"
            enabled={localPreferences.replyNotifications}
            onChange={(value) => handleToggle('replyNotifications', value)}
            theme={theme}
          />
          <NotificationToggle
            label="Reposts"
            description="Get notified when someone reposts your posts"
            enabled={localPreferences.rechirpNotifications}
            onChange={(value) => handleToggle('rechirpNotifications', value)}
            theme={theme}
          />
          <NotificationToggle
            label="Follows"
            description="Get notified when someone follows you"
            enabled={localPreferences.followNotifications}
            onChange={(value) => handleToggle('followNotifications', value)}
            theme={theme}
          />
          <NotificationToggle
            label="Mentions"
            description="Get notified when someone mentions you"
            enabled={localPreferences.mentionNotifications}
            onChange={(value) => handleToggle('mentionNotifications', value)}
            theme={theme}
          />
        </div>
      </div>

      <div>
        <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-4`}>Quiet Hours</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>Start time:</label>
            <input
              type="time"
              value={localPreferences.quietHoursStart || '22:00'}
              onChange={(e) => handleTimeChange('quietHoursStart', e.target.value)}
              className={`px-3 py-2 ${theme === 'dark' ? 'bg-white/5 border-white/20 text-white' : 'bg-background/50 border-border text-textPrimary'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30`}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className={`text-sm ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>End time:</label>
            <input
              type="time"
              value={localPreferences.quietHoursEnd || '08:00'}
              onChange={(e) => handleTimeChange('quietHoursEnd', e.target.value)}
              className={`px-3 py-2 ${theme === 'dark' ? 'bg-white/5 border-white/20 text-white' : 'bg-background/50 border-border text-textPrimary'} border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30`}
            />
          </div>
          <p className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
            During quiet hours, you won't receive push notifications, but notifications will still appear in your notification center.
          </p>
        </div>
      </div>


      {isSaving && (
        <div className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>
          Saving preferences...
        </div>
      )}
    </div>
  );
};

interface NotificationToggleProps {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  theme: 'light' | 'dark';
}

const NotificationToggle = ({ label, description, enabled, onChange, theme }: NotificationToggleProps) => {
  return (
    <div className={`flex items-start justify-between gap-4 p-3 rounded-lg border ${theme === 'dark' ? 'border-white/20 bg-transparent hover:bg-white/10' : 'border-border/40 bg-background/30 hover:bg-background/50'} transition-colors`}>
      <div className="flex-1 min-w-0">
        <label className={`block text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-textPrimary'} mb-1`}>{label}</label>
        <p className={`text-xs ${theme === 'dark' ? 'text-white/70' : 'text-textMuted'}`}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2 ${
          enabled ? 'bg-accent' : theme === 'dark' ? 'bg-white/20' : 'bg-backgroundElevated'
        }`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

export default NotificationPreferences;

