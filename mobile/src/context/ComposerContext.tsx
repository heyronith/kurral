import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Chirp } from '../types';

type ComposerContextValue = {
  isOpen: boolean;
  quotedChirp: Chirp | null;
  open: () => void;
  close: () => void;
  openWithQuote: (chirp: Chirp) => void;
};

const ComposerContext = createContext<ComposerContextValue | undefined>(undefined);

export const ComposerProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [quotedChirp, setQuotedChirp] = useState<Chirp | null>(null);

  const open = () => {
    setQuotedChirp(null);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setTimeout(() => setQuotedChirp(null), 300);
  };

  const openWithQuote = (chirp: Chirp) => {
    setQuotedChirp(chirp);
    setIsOpen(true);
  };

  return (
    <ComposerContext.Provider
      value={{
        isOpen,
        quotedChirp,
        open,
        close,
        openWithQuote,
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


