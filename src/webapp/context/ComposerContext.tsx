import { createContext, useContext, useState, ReactNode } from 'react';
import type { Chirp } from '../types';

interface ComposerContextType {
  isComposerVisible: boolean;
  quotedChirp: Chirp | null;
  showComposer: () => void;
  hideComposer: () => void;
  toggleComposer: () => void;
  openComposerWithQuote: (chirp: Chirp) => void;
}

const ComposerContext = createContext<ComposerContextType | undefined>(undefined);

export const ComposerProvider = ({ children }: { children: ReactNode }) => {
  const [isComposerVisible, setIsComposerVisible] = useState(false);
  const [quotedChirp, setQuotedChirp] = useState<Chirp | null>(null);

  const showComposer = () => {
    setQuotedChirp(null);
    setIsComposerVisible(true);
  };

  const hideComposer = () => {
    setIsComposerVisible(false);
    // Delay clearing quote so it doesn't disappear during exit animation if any
    setTimeout(() => setQuotedChirp(null), 300);
  };

  const toggleComposer = () => {
    if (isComposerVisible) {
      hideComposer();
    } else {
      showComposer();
    }
  };

  const openComposerWithQuote = (chirp: Chirp) => {
    setQuotedChirp(chirp);
    setIsComposerVisible(true);
  };

  return (
    <ComposerContext.Provider value={{ 
      isComposerVisible, 
      quotedChirp,
      showComposer, 
      hideComposer, 
      toggleComposer,
      openComposerWithQuote
    }}>
      {children}
    </ComposerContext.Provider>
  );
};

export const useComposer = () => {
  const context = useContext(ComposerContext);
  if (context === undefined) {
    throw new Error('useComposer must be used within a ComposerProvider');
  }
  return context;
};
