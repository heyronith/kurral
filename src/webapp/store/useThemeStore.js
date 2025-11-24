import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useThemeStore = create()(persist((set) => ({
    theme: 'light',
    setTheme: (theme) => {
        set({ theme });
        // Apply theme class to document root
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        }
        else {
            document.documentElement.classList.remove('dark');
        }
    },
    toggleTheme: () => {
        set((state) => {
            const newTheme = state.theme === 'light' ? 'dark' : 'light';
            // Apply theme class to document root
            if (newTheme === 'dark') {
                document.documentElement.classList.add('dark');
            }
            else {
                document.documentElement.classList.remove('dark');
            }
            return { theme: newTheme };
        });
    },
}), {
    name: 'chirp-theme-storage',
    onRehydrateStorage: () => (state) => {
        // Apply theme on hydration
        if (state?.theme === 'dark') {
            document.documentElement.classList.add('dark');
        }
        else {
            document.documentElement.classList.remove('dark');
        }
    },
}));
