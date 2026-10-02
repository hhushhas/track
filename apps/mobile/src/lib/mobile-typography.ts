import type { TextStyle } from 'react-native';

type AppFontVariant = NonNullable<TextStyle['fontVariant']>[number];

const noCommonLigatures: AppFontVariant = 'no-common-ligatures';

export function appFontVariants(variants: TextStyle['fontVariant'] = []): AppFontVariant[] {
  return [...new Set<AppFontVariant>([noCommonLigatures, ...variants])];
}

export type SansFontFaces = {
  regular: string | undefined;
  medium: string | undefined;
  semibold: string | undefined;
  bold: string | undefined;
  extraBold: string | undefined;
};

export function sansFaceForWeight(weight: TextStyle['fontWeight'], faces: SansFontFaces) {
  switch (String(weight ?? '400')) {
    case '500':
    case 'medium':
      return faces.medium;
    case '600':
    case 'semibold':
      return faces.semibold;
    case '700':
    case 'condensedBold':
    case 'bold':
      return faces.bold;
    case '800':
    case '900':
    case 'heavy':
    case 'black':
      return faces.extraBold;
    default:
      return faces.regular;
  }
}
