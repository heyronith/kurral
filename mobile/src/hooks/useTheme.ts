import { useThemeStore } from '../stores/useThemeStore';
import { getColors, type ThemeMode } from '../theme/colors';

/**
 * Hook to get current theme mode and colors
 */
export const useTheme = () => {
  const theme = useThemeStore((state) => state.theme);
  const colors = getColors(theme);
  
  return {
    theme,
    colors,
    isDark: theme === 'dark',
  };
};

