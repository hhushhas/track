import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1b1917',
    background: '#faf9f7',
    backgroundElement: '#f3f1ed',
    backgroundSelected: '#ebe8e2',
    textSecondary: '#6b655c',
    hairline: '#e3dfd7',
    accent: '#f0b100',
    accentSoft: '#fef3c7',
  },
  dark: {
    text: '#faf9f7',
    background: '#1b1917',
    backgroundElement: '#292522',
    backgroundSelected: '#3a3631',
    textSecondary: '#c9c3b8',
    hairline: '#3a3631',
    accent: '#f0b100',
    accentSoft: '#7a5800',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: undefined,
    mono: 'Menlo',
  },
  android: {
    sans: 'sans-serif',
    mono: 'monospace',
  },
  default: {
    sans: 'sans-serif',
    mono: 'monospace',
  },
});

export const Typography = {
  body: {
    fontFamily: Fonts?.sans,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400' as const,
  },
  bodyBold: {
    fontFamily: Fonts?.sans,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600' as const,
  },
  title: {
    fontFamily: Fonts?.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  subtitle: {
    fontFamily: Fonts?.sans,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  metadata: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: Platform.OS === 'android' ? ('700' as const) : ('500' as const),
    letterSpacing: 0.3,
  },
  metadataLabel: {
    fontFamily: Fonts?.mono,
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: Platform.OS === 'android' ? ('700' as const) : ('500' as const),
    letterSpacing: 0.6,
  },
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
} as const;

export const TouchTarget = Platform.select({ ios: 44, android: 48 }) ?? 44;

export const BottomTabInset = Platform.select({ ios: 50, android: 72 }) ?? 0;
export const MaxContentWidth = 800;
