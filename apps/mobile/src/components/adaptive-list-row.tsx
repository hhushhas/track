import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isCompactListRow } from '@/lib/adaptive-layout';

type Props = {
  accessibilityHint?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  emphasized?: boolean;
  leading?: ReactNode;
  onPress: () => void;
  subtitle?: ReactNode;
  title: string;
  trailingBottom?: ReactNode;
  trailingTop?: ReactNode;
};

/**
 * The shared phone-list grammar: identity and context on the left, one stable
 * value/state slot on the right. It responds to the row's measured width so a
 * split-view or sheet can compact independently of the device viewport.
 */
export function AdaptiveListRow({
  accessibilityHint,
  accessibilityLabel,
  disabled,
  emphasized,
  leading,
  onPress,
  subtitle,
  title,
  trailingBottom,
  trailingTop,
}: Props) {
  const theme = useTheme();
  const [compact, setCompact] = useState(false);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = isCompactListRow(event.nativeEvent.layout.width);
    setCompact((current) => current === next ? current : next);
  }, []);
  const hasTrailing = Boolean(trailingTop || trailingBottom);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.surface,
        {
          backgroundColor: emphasized ? theme.accentSoft : theme.backgroundElement,
          borderColor: emphasized ? theme.accent : theme.hairline,
        },
      ]}>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        android_ripple={{ color: theme.backgroundSelected }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressable,
          compact && styles.pressableCompact,
          { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
        ]}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <View style={styles.copy}>
          <ThemedText numberOfLines={compact ? 2 : 1} type="title">{title}</ThemedText>
          {subtitle ? (
            typeof subtitle === 'string'
              ? <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{subtitle}</ThemedText>
              : subtitle
          ) : null}
        </View>
        {hasTrailing ? (
          <View style={[styles.trailing, compact && styles.trailingCompact]}>
            <View style={styles.trailingLine}>{trailingTop}</View>
            <View style={styles.trailingLine}>{trailingBottom}</View>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: 3, minWidth: 0 },
  leading: { alignItems: 'center', justifyContent: 'center' },
  pressable: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: 68,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressableCompact: { gap: Spacing.two },
  surface: {
    borderCurve: 'continuous',
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  trailing: { alignItems: 'flex-end', gap: 3, justifyContent: 'center', maxWidth: 116, minHeight: TouchTarget, minWidth: 88 },
  trailingCompact: { maxWidth: 96, minWidth: 72 },
  trailingLine: { alignItems: 'flex-end', minHeight: 18, justifyContent: 'center', maxWidth: '100%' },
});
