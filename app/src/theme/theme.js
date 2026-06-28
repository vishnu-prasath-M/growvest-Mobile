import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#085428',        // Website Primary (Forest Green)
    secondary: '#25b053',      // Website Secondary (Grass Green)
    accent: '#eaf5ef',         // Website Accent (Mint Background)
    error: '#dc2626',          // Destructive/Error Red
    background: '#f4f6f9',     // Light Gray Background (more modern)
    surface: '#ffffff',        // Card Background (White)
    text: '#0a1628',           // Dark Navy Text
    onSurface: '#1f2937',      // Primary Text on Cards
    disabled: '#9ca3af',
    placeholder: '#9ca3af',
    backdrop: 'rgba(0,0,0,0.5)',
  },
  fonts: {
    ...MD3LightTheme.fonts,
  },
  roundness: 16,
};

export const colors = {
  primary: '#085428',
  primaryLight: '#eaf5ef',
  primaryDark: '#053d1d',
  secondary: '#25b053',
  accent: '#eaf5ef',
  error: '#dc2626',
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#ca8a04',
  warningLight: '#fef9c3',
  info: '#2563eb',
  infoLight: '#dbeafe',
  background: '#f4f6f9',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#0a1628',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  saving: '#16a34a',
  savingLight: '#dcfce7',
  fixed: '#085428',
  fixedLight: '#eaf5ef',
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  
  // Shadows
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
    tab: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 16,
    },
    button: {
      shadowColor: '#085428',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
  },
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textTertiary,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  amountLarge: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -1,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};