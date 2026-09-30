import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, TouchTarget } from '@/constants/theme';

type PressableProps = Omit<ComponentProps<typeof Pressable>, 'children' | 'style'>;

type Props = PressableProps & {
  children: ReactNode;
  pillStyle?: StyleProp<ViewStyle>;
  pressedPillStyle?: StyleProp<ViewStyle>;
  targetStyle?: StyleProp<ViewStyle>;
};

/** Keeps a compact capsule visual inside the platform minimum touch target. */
export function CompactPillButton({
  children,
  pillStyle,
  pressedPillStyle,
  targetStyle,
  ...pressableProps
}: Props) {
  return (
    <Pressable {...pressableProps} style={[styles.target, targetStyle]}>
      {({ pressed }) => (
        <View pointerEvents="none" style={[styles.pill, pillStyle, pressed && pressedPillStyle]}>
          {children}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: Spacing.three,
  },
  target: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TouchTarget,
  },
});
