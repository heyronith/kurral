import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState } from 'react';
const ComposerContext = createContext(undefined);
export const ComposerProvider = ({ children }) => {
    const [isComposerVisible, setIsComposerVisible] = useState(false);
    const showComposer = () => setIsComposerVisible(true);
    const hideComposer = () => setIsComposerVisible(false);
    const toggleComposer = () => setIsComposerVisible(prev => !prev);
    return (_jsx(ComposerContext.Provider, { value: { isComposerVisible, showComposer, hideComposer, toggleComposer }, children: children }));
};
export const useComposer = () => {
    const context = useContext(ComposerContext);
    if (context === undefined) {
        throw new Error('useComposer must be used within a ComposerProvider');
    }
    return context;
};
