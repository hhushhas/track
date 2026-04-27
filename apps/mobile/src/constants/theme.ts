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
    sans: 'system-ui',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
    mono: 'JetBrains Mono, ui-monospace, monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 72 }) ?? 0;
export const MaxContentWidth = 800;
