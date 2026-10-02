import { describe, expect, it } from 'vitest';

import { appFontVariants, sansFaceForWeight } from './mobile-typography';

const faces = {
  regular: 'ManropeV5-Regular',
  medium: 'ManropeV5-Medium',
  semibold: 'ManropeV5-SemiBold',
  bold: 'ManropeV5-Bold',
  extraBold: 'ManropeV5-ExtraBold',
};

describe('sansFaceForWeight', () => {
  it.each([
    [undefined, 'ManropeV5-Regular'],
    ['400', 'ManropeV5-Regular'],
    ['500', 'ManropeV5-Medium'],
    ['medium', 'ManropeV5-Medium'],
    ['600', 'ManropeV5-SemiBold'],
    ['semibold', 'ManropeV5-SemiBold'],
    ['700', 'ManropeV5-Bold'],
    ['bold', 'ManropeV5-Bold'],
    ['800', 'ManropeV5-ExtraBold'],
    ['900', 'ManropeV5-ExtraBold'],
  ] as const)('maps weight %s to its static face', (weight, expected) => {
    expect(sansFaceForWeight(weight, faces)).toBe(expected);
  });
});

describe('appFontVariants', () => {
  it('disables common ligatures while preserving tabular numerals', () => {
    expect(appFontVariants(['tabular-nums'])).toEqual([
      'no-common-ligatures',
      'tabular-nums',
    ]);
  });

  it('adds the no-ligature setting once', () => {
    expect(appFontVariants(['no-common-ligatures', 'tabular-nums'])).toEqual([
      'no-common-ligatures',
      'tabular-nums',
    ]);
  });
});
