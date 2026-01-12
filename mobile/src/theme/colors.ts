export const colors = {
  light: {
    background: '#FAFAFA',
    backgroundElevated: '#FFFFFF',
    border: 'rgba(0, 0, 0, 0.1)',
    textPrimary: '#1A1A1A',
    textSecondary: '#333333',
    textMuted: '#666666',
    accent: '#7C3AED',
    accentHover: '#6D28D9',
    error: '#EF4444',
    success: '#10B981',
  },
  dark: {
    background: '#000000',
    backgroundElevated: '#0A0A0A',
    border: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#F5F7FA',
    textSecondary: 'rgba(255, 255, 255, 0.85)',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    accent: '#8B5CF6',
    accentHover: '#7C3AED',
    error: '#F87171',
    success: '#34D399',
  },
};

export type ThemeMode = 'light' | 'dark';

/**
 * Get colors for a specific theme mode
 */
export const getColors = (theme: ThemeMode) => colors[theme];

/**
 * Hook to get current theme colors
 * This will be used by components that need theme-aware colors
 */
export const useColors = () => {
  // This will be implemented with the theme store
  // For now, return light as default
  return colors.light;
};

