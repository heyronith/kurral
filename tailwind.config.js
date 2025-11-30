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
        // ===========================================
        // LIGHT MODE (Default) - Clean, Professional
        // ===========================================
        background: '#FAFAFA',           // Light gray-white background
        backgroundElevated: '#FFFFFF',   // Pure white for elevated surfaces
        backgroundHover: '#F0F0F0',      // Subtle hover state
        backgroundSubtle: '#F5F5F5',     // Very subtle background
        
        // Card colors - subtle shadows on light
        card: 'rgba(255, 255, 255, 0.9)',
        cardHover: 'rgba(255, 255, 255, 1)',
        cardSubtle: 'rgba(255, 255, 255, 0.7)',
        
        // Border colors for light theme - dark borders
        border: 'rgba(0, 0, 0, 0.1)',
        borderMuted: 'rgba(0, 0, 0, 0.06)',
        borderLight: 'rgba(0, 0, 0, 0.08)',
        borderSubtle: 'rgba(0, 0, 0, 0.04)',
        
        // Text colors for light theme - dark text
        textPrimary: '#1A1A1A',
        textSecondary: '#333333',
        textMuted: '#666666',
        textLabel: '#888888',
        textSubtle: '#AAAAAA',
        
        // ===========================================
        // DARK MODE COLORS (used via dark: prefix or JS)
        // ===========================================
        // Dark backgrounds
        darkBg: '#000000',
        darkBgElevated: '#0A0A0A',
        darkBgHover: '#111111',
        darkBgSubtle: '#050505',
        
        // Dark card colors
        darkCard: 'rgba(255, 255, 255, 0.03)',
        darkCardHover: 'rgba(255, 255, 255, 0.05)',
        
        // Dark border colors
        darkBorder: 'rgba(255, 255, 255, 0.1)',
        darkBorderMuted: 'rgba(255, 255, 255, 0.06)',
        darkBorderLight: 'rgba(255, 255, 255, 0.15)',
        
        // Dark text colors
        darkTextPrimary: '#F5F7FA',
        darkTextSecondary: 'rgba(255, 255, 255, 0.85)',
        darkTextMuted: 'rgba(255, 255, 255, 0.6)',
        darkTextLabel: 'rgba(255, 255, 255, 0.4)',
        
        // ===========================================
        // Neural Violet System - Creative, Intelligent, Premium
        // Psychology: Violet signals wisdom, creativity, and intelligence
        // Differentiation: Underutilized in social media, creates unique brand identity
        // ===========================================
        accent: '#8B5CF6', // Violet-500 - Main action color
        accentHover: '#7C3AED', // Violet-600 - Hover state
        accentLight: '#A78BFA', // Violet-400 - Lighter variant for highlights/glows
        accentDark: '#6D28D9', // Violet-700 - Darker variant for emphasis
        accentSecondary: '#34D399', // Emerald-400 - Electric mint for contrast
        accentSecondaryHover: '#10B981', // Emerald-500 - Deeper emerald
        
        // Primary color (synced with accent for consistency)
        primary: '#7C3AED', // Violet-600 - Deep, trustworthy base
        primaryHover: '#6D28D9', // Violet-700
        primaryLight: '#8B5CF6', // Violet-500
        
        // Status colors - work in both themes
        success: '#10B981', // Emerald - growth, positive
        successHover: '#059669',
        warning: '#F59E0B', // Amber - caution
        warningHover: '#D97706',
        error: '#EF4444', // Red - alert
        errorHover: '#DC2626',
      },
      boxShadow: {
        // Modern minimalist shadow system - Neural Violet glow
        // Updated to use violet accent color (creative, intelligent, premium)
        glow: '0 0 40px rgba(124, 58, 237, 0.15), 0 0 80px rgba(124, 58, 237, 0.05)',
        glowStrong: '0 0 60px rgba(124, 58, 237, 0.2), 0 0 120px rgba(124, 58, 237, 0.08)',
        card: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
        cardHover: '0 4px 12px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06)',
        elevated: '0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)',
        elevatedStrong: '0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.08)',
        inner: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
        button: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
        buttonHover: '0 4px 12px rgba(124, 58, 237, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)',
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
