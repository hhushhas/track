import { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { MaxFontScale } from '@/constants/theme';
import { appFontVariants } from '@/lib/mobile-typography';

export const ThemedTextInput = forwardRef<TextInput, TextInputProps>(function ThemedTextInput(
  { maxFontSizeMultiplier = MaxFontScale, style, ...props },
  ref,
) {
  const textStyle = StyleSheet.flatten(style);

  return (
    <TextInput
      {...props}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      ref={ref}
      style={[style, { fontVariant: appFontVariants(textStyle?.fontVariant) }]}
    />
  );
});
