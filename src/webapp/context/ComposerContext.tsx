import { createContext, useContext, useState, ReactNode } from 'react';

interface ComposerContextType {
  isComposerVisible: boolean;
  showComposer: () => void;
  hideComposer: () => void;
  toggleComposer: () => void;
}

const ComposerContext = createContext<ComposerContextType | undefined>(undefined);

export const ComposerProvider = ({ children }: { children: ReactNode }) => {
  const [isComposerVisible, setIsComposerVisible] = useState(false);

  const showComposer = () => setIsComposerVisible(true);
  const hideComposer = () => setIsComposerVisible(false);
  const toggleComposer = () => setIsComposerVisible(prev => !prev);

  return (
    <ComposerContext.Provider value={{ isComposerVisible, showComposer, hideComposer, toggleComposer }}>
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

