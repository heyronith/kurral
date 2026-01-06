import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Chirp } from '../types';

type ComposerContextValue = {
  isOpen: boolean;
  quotedChirp: Chirp | null;
  commentingChirp: Chirp | null;
  open: () => void;
  close: () => void;
  openWithQuote: (chirp: Chirp) => void;
  openForComment: (chirp: Chirp) => void;
};

const ComposerContext = createContext<ComposerContextValue | undefined>(undefined);

export const ComposerProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [quotedChirp, setQuotedChirp] = useState<Chirp | null>(null);
  const [commentingChirp, setCommentingChirp] = useState<Chirp | null>(null);

  const open = () => {
    setQuotedChirp(null);
    setCommentingChirp(null);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setTimeout(() => {
      setQuotedChirp(null);
      setCommentingChirp(null);
    }, 300);
  };

  const openWithQuote = (chirp: Chirp) => {
    setQuotedChirp(chirp);
    setCommentingChirp(null);
    setIsOpen(true);
  };

  const openForComment = (chirp: Chirp) => {
    setCommentingChirp(chirp);
    setQuotedChirp(null);
    setIsOpen(true);
  };

  return (
    <ComposerContext.Provider
      value={{
        isOpen,
        quotedChirp,
        commentingChirp,
        open,
        close,
        openWithQuote,
        openForComment,
      }}
    >
      {children}
    </ComposerContext.Provider>
  );
};

export const useComposer = () => {
  const ctx = useContext(ComposerContext);
  if (!ctx) {
    throw new Error('useComposer must be used within ComposerProvider');
  }
  return ctx;
};


