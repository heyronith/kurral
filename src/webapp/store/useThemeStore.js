import { create } from 'zustand';
import { persist } from 'zustand/middleware';
const applyThemeClass = (theme) => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    }
    else {
        document.documentElement.classList.remove('dark');
    }
};
export const useThemeStore = create()(persist((set) => ({
    theme: 'light',
    setTheme: (theme) => {
        set({ theme });
        applyThemeClass(theme);
    },
    toggleTheme: () => {
        set((state) => {
            const newTheme = state.theme === 'light' ? 'dark' : 'light';
            applyThemeClass(newTheme);
            return { theme: newTheme };
        });
    },
}), {
    name: 'chirp-theme-storage',
    onRehydrateStorage: () => (state) => {
        // Apply theme on hydration
        if (state?.theme) {
            applyThemeClass(state.theme);
        }
    },
}));
