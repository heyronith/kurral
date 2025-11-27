const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./index.html', './src/**/*.{js,tsx,ts,jsx}'],
  darkMode: 'class', // Enable dark mode using class strategy
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Professional neutral background - Research-backed for trust & readability
        // Psychology: Light neutral backgrounds reduce eye strain, convey neutrality/balance,
        // and allow content to stand out without distraction (used by major news/social platforms)
        background: '#F0F4F8', // Cool blue-gray - professional, calm, trustworthy
        backgroundElevated: '#FFFFFF', // White for elevated surfaces (cards, modals)
        backgroundHover: '#E2E8F0', // Interactive state - slightly darker slate
        backgroundSubtle: '#F7FAFC', // Subtle variation - very light blue-gray
        
        // Refined card colors - white cards on blue-gray background
        card: '#FFFFFF',
        cardHover: '#FAFBFC',
        cardSubtle: '#F9FAFB',
        
        // Trust-focused accent - Cyan for better visibility on dark backgrounds
        // Psychology: Cyan provides excellent contrast on dark backgrounds while maintaining trust
        // Research: Cyan is highly visible and accessible, works well for interactive elements
        // Updated for better dark mode visibility and accessibility
        accent: '#06B6D4', // Cyan-500 - bright cyan for excellent visibility on dark backgrounds
        accentHover: '#0891B2', // Cyan-600 - slightly deeper for hover (maintains visibility)
        accentLight: '#22D3EE', // Cyan-400 - lighter variant for subtle highlights
        accentDark: '#0891B2', // Cyan-600 - darker variant for emphasis
        accentSecondary: '#0891B2', // Cyan-600 - blue-teal for verification/fact-checking
        accentSecondaryHover: '#0E7490', // Cyan-700 - deeper teal
        
        // Primary color (synced with accent for consistency)
        primary: '#2563EB', // Deep blue - maximum trust & credibility
        primaryHover: '#1D4ED8',
        primaryLight: '#3B82F6',
        
        // Enhanced border colors - visible on white background
        border: '#E5E7EB', // Visible border on white
        borderMuted: '#D1D5DB', // Subtle separation
        borderLight: '#F3F4F6', // Lighter borders
        borderSubtle: '#F9FAFB', // Most subtle
        
        // Refined text colors - dark text for white background
        textPrimary: '#111827', // Dark text for white background
        textSecondary: '#374151', // Secondary text
        textMuted: '#6B7280', // Muted but readable
        textLabel: '#9CA3AF', // Labels and metadata
        textSubtle: '#D1D5DB', // Most subtle text
        
        // Status colors - muted but clear (minimalist approach)
        success: '#10B981', // Emerald - growth, positive (kept clear for feedback)
        successHover: '#059669',
        warning: '#F59E0B', // Amber - caution (kept for visibility)
        warningHover: '#D97706',
        error: '#EF4444', // Red - alert (kept clear for errors)
        errorHover: '#DC2626',
      },
      boxShadow: {
        // Modern minimalist shadow system - softer, more refined for light background
        // Updated to use deep blue accent color (trust-focused)
        glow: '0 0 40px rgba(37, 99, 235, 0.15), 0 0 80px rgba(37, 99, 235, 0.05)',
        glowStrong: '0 0 60px rgba(37, 99, 235, 0.2), 0 0 120px rgba(37, 99, 235, 0.08)',
        card: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        cardHover: '0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06)',
        elevated: '0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)',
        elevatedStrong: '0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.08)',
        inner: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
        button: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
        buttonHover: '0 4px 12px rgba(37, 99, 235, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)',
        subtle: '0 1px 2px rgba(0, 0, 0, 0.05)',
      },
      borderRadius: {
        xl2: '1.25rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
        slideUp: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        slideDown: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        scaleIn: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 2s linear infinite',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [],
};
