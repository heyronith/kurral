import { useThemeStore } from '../store/useThemeStore';
import type { User } from '../types';

interface ProfileSummaryModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
}

const ProfileSummaryModal = ({ open, onClose, user }: ProfileSummaryModalProps) => {
  const { theme } = useThemeStore();

  if (!open) return null;

  const formatDate = (date: Date | undefined): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const hasSummary = user.profileSummary && user.profileSummary.trim().length > 0;
  const summaryText = user.profileSummary || '';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-4"
      onClick={onClose}
    >
      <div 
        className={`relative w-full max-w-lg rounded-2xl border shadow-2xl transition-all duration-300 ${
          theme === 'dark' 
            ? 'border-white/10 bg-black/95' 
            : 'border-border/40 bg-white/95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Minimal */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-transparent">
          <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Summary
          </h3>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'hover:bg-white/10 text-white/70 hover:text-white' 
                : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
            }`}
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {hasSummary ? (
            <div className="space-y-4">
              {/* Summary Text - Full visibility */}
              <div className={`rounded-xl p-5 ${
                theme === 'dark' 
                  ? 'bg-white/5' 
                  : 'bg-gray-50'
              }`}>
                <p className={`text-[15px] leading-relaxed whitespace-pre-wrap ${
                  theme === 'dark' ? 'text-white/90' : 'text-gray-800'
                }`}>
                  {summaryText}
                </p>
              </div>

              {/* Metadata - Minimal */}
              <div className={`flex items-center gap-4 text-xs ${
                theme === 'dark' ? 'text-white/50' : 'text-gray-500'
              }`}>
                <span>{formatDate(user.profileSummaryUpdatedAt)}</span>
              </div>
            </div>
          ) : (
            <div className={`text-center py-12 rounded-xl ${
              theme === 'dark' 
                ? 'bg-white/5' 
                : 'bg-gray-50'
            }`}>
              <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                No summary available
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSummaryModal;

