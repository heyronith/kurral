import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState } from 'react';
const ComposerContext = createContext(undefined);
export const ComposerProvider = ({ children }) => {
    const [isComposerVisible, setIsComposerVisible] = useState(false);
    const [quotedChirp, setQuotedChirp] = useState(null);
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
        }
        else {
            showComposer();
        }
    };
    const openComposerWithQuote = (chirp) => {
        setQuotedChirp(chirp);
        setIsComposerVisible(true);
    };
    return (_jsx(ComposerContext.Provider, { value: {
            isComposerVisible,
            quotedChirp,
            showComposer,
            hideComposer,
            toggleComposer,
            openComposerWithQuote
        }, children: children }));
};
export const useComposer = () => {
    const context = useContext(ComposerContext);
    if (context === undefined) {
        throw new Error('useComposer must be used within a ComposerProvider');
    }
    return context;
};
