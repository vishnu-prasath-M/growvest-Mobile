import { MD3LightTheme } from 'react-native-paper';

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1A5C39',
    secondary: '#2E8B5A',
    accent: '#E8F5EE',
    error: '#D94F2B',
    background: '#F7F8FA',
    surface: '#FFFFFF',
    text: '#0F1C14',
    onSurface: '#1A2E1F',
    disabled: '#9BA8A0',
    placeholder: '#9BA8A0',
    backdrop: 'rgba(0,0,0,0.5)',
  },
  roundness: 20,
};

export const colors = {
  // Primary — Deep Emerald
  primary: '#1A5C39',
  primaryLight: '#E8F5EE',
  primaryDark: '#0E3D23',
  primaryFg: '#F8FAF9',

  // Secondary
  secondary: '#2E8B5A',
  secondaryDark: '#235E41',

  // Gold
  gold: '#D4A843',
  goldLight: '#F5E9C0',
  goldFg: '#5A3800',

  // Semantic
  success: '#2D9A5A',
  successLight: '#D6F0E2',
  warning: '#C68E0A',
  warningLight: '#FEF3C2',
  error: '#D94F2B',
  errorLight: '#FDEAE5',
  info: '#2563eb',
  infoLight: '#dbeafe',

  // Surfaces
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surface2: '#F3F5F7',
  card: '#FFFFFF',

  // Text
  text: '#0F1C14',
  textSecondary: '#4A5568',
  textMuted: '#7B8794',
  textTertiary: '#9BA8A0',

  // Accents
  accent: '#E8F5EE',
  accentFg: '#1A5C39',
  muted: '#F2F4F6',
  mutedFg: '#7B8794',

  // Utility
  border: '#E4E7EB',
  borderLight: '#F0F2F4',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',

  // Aliases kept for backward compatibility
  saving: '#2D9A5A',
  savingLight: '#D6F0E2',
  fixed: '#1A5C39',
  fixedLight: '#E8F5EE',

  // Gradient stops
  gradientEmerald: ['#0E3D23', '#1A5C39', '#2E8B5A'],
  gradientGold: ['#E8D083', '#C89A30'],

  // Shadows
  shadow: {
    card: {
      shadowColor: '#0E3D23',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    soft: {
      shadowColor: '#0E3D23',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    float: {
      shadowColor: '#0E3D23',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 12,
    },
    glow: {
      shadowColor: '#1A5C39',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.28,
      shadowRadius: 40,
      elevation: 20,
    },
    tab: {
      shadowColor: '#0E3D23',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
      elevation: 20,
    },
    button: {
      shadowColor: '#1A5C39',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    elevated: {
      shadowColor: '#0E3D23',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 12,
    },
    premium: {
      shadowColor: '#1A5C39',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
  },
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.8,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.3,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.text,
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
    lineHeight: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.8,
  },
  amountLarge: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1.5,
  },
  semibold: {
    fontWeight: '600',
  },
  bold: {
    fontWeight: '700',
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

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  card: 24,
  pill: 999,
  hero: 28,
};