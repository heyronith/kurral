import { useEffect, useState } from 'react';
import { userService } from '../lib/firestore';
import { useUserStore } from '../store/useUserStore';
import type { User } from '../types';

interface FollowSuggestionsModalProps {
  open: boolean;
  onClose: () => void;
}

const FollowSuggestionsModal = ({ open, onClose }: FollowSuggestionsModalProps) => {
  const { currentUser, followUser, isFollowing } = useUserStore();
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSuggestions = async () => {
      if (!currentUser) return;
      setIsLoading(true);
      try {
        const similar = await userService.getUsersWithSimilarInterests(
          currentUser.interests || [],
          currentUser.id,
          6
        );
        if (!active) return;
        if (similar.length > 0) {
          setSuggestions(similar);
        } else {
          const popular = await userService.getPopularAccounts(6);
          if (!active) return;
          setSuggestions(popular.filter((user) => user.id !== currentUser.id));
        }
      } catch (error) {
        console.error('[FollowSuggestionsModal] Error loading suggestions:', error);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    if (open) {
      loadSuggestions();
    }

    return () => {
      active = false;
    };
  }, [open, currentUser]);

  if (!open || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-backgroundElevated p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-textPrimary">People to follow</h2>
          <button onClick={onClose} className="text-xs text-textMuted hover:text-textPrimary">
            Close
          </button>
        </div>
        {isLoading ? (
          <p className="text-sm text-textMuted">Loading suggestions...</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-textMuted">No suggestions right now. Try again later.</p>
        ) : (
          <div className="space-y-3">
            {suggestions.map((user) => {
              const following = isFollowing(user.id);
              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-textPrimary">{user.name}</p>
                    <p className="text-xs text-textMuted">@{user.handle}</p>
                    {user.bio && (
                      <p className="text-[11px] text-textMuted mt-1 line-clamp-2">{user.bio}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => followUser(user.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      following
                        ? 'border border-border text-textMuted'
                        : 'bg-gradient-to-r from-primary to-accent text-white hover:from-primaryHover hover:to-accentHover'
                    }`}
                  >
                    {following ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowSuggestionsModal;

