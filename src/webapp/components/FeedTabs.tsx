import type { FeedType } from '../types';
import { useFeedStore } from '../store/useFeedStore';

interface FeedTabsProps {
  activeFeed: FeedType;
  onFeedChange: (feed: FeedType) => void;
}

const FeedTabs = ({ activeFeed, onFeedChange }: FeedTabsProps) => {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onFeedChange('latest')}
        className={`px-3 py-2 text-sm font-medium transition-colors ${
          activeFeed === 'latest'
            ? 'text-accent font-semibold'
            : 'text-textMuted hover:text-textPrimary'
        }`}
      >
        Friends
      </button>
      <button
        onClick={() => onFeedChange('forYou')}
        className={`px-3 py-2 text-sm font-medium transition-colors ${
          activeFeed === 'forYou'
            ? 'text-accent font-semibold'
            : 'text-textMuted hover:text-textPrimary'
        }`}
      >
        Curated Kurals
      </button>
    </div>
  );
};

export default FeedTabs;

