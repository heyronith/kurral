import { useState, useRef, useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import type { Topic, FollowingWeight } from '../types';

interface TuneMenuProps {
  chirpId: string;
  authorId: string;
  topic: Topic;
  onClose: () => void;
}

const TuneMenu = ({ authorId, topic, onClose }: TuneMenuProps) => {
  const {
    forYouConfig,
    setFollowingWeight,
    addLikedTopic,
    addMutedTopic,
  } = useConfigStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleMoreFromPerson = () => {
    // Increase following weight
    const weights: FollowingWeight[] = ['none', 'light', 'medium', 'heavy'];
    const currentIndex = weights.indexOf(forYouConfig.followingWeight);
    if (currentIndex < weights.length - 1) {
      setFollowingWeight(weights[currentIndex + 1]);
    } else {
      setFollowingWeight('heavy');
    }
    onClose();
  };

  const handleMoreAboutTopic = () => {
    addLikedTopic(topic);
    onClose();
  };

  const handleLessLikeThis = () => {
    addMutedTopic(topic);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute right-0 top-8 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[200px]"
    >
      <div className="py-1">
        <button
          onClick={handleMoreFromPerson}
          className="w-full text-left px-4 py-2 text-sm text-textPrimary hover:bg-background/50 transition-colors"
        >
          More from this person
        </button>
        <button
          onClick={handleMoreAboutTopic}
          className="w-full text-left px-4 py-2 text-sm text-textPrimary hover:bg-background/50 transition-colors"
        >
          More about #{topic}
        </button>
        <button
          onClick={handleLessLikeThis}
          className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-background/50 transition-colors"
        >
          Less like this
        </button>
      </div>
    </div>
  );
};

export default TuneMenu;

