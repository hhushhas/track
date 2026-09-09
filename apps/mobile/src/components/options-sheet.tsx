import { Children, Fragment, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxFontScale, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useThemeOverride } from '@/contexts/theme-override-context';
import { hapticLight } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
/** Rows rendered before a search narrows the list, so opening stays instant. */
const SEARCH_PAGE = 30;

type Props = {
  children: React.ReactNode;
  onClose: () => void;
  showScrollProgress?: boolean;
  title: string;
  visible: boolean;
};

export function OptionsSheet({ children, onClose, showScrollProgress = false, title, visible }: Props) {
  const theme = useTheme();
  const { theme: themeName } = useThemeOverride();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const scrim = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (visible) {
      // A screen input may still hold the keyboard; the modal is a separate
      // window, so stale keyboard padding would float the sheet mid-screen.
      Keyboard.dismiss();
      translateY.value = 0;
      scrim.value = withTiming(1, { duration: reducedMotion ? 0 : 180 });
    } else {
      scrim.value = 0;
    }
  }, [reducedMotion, scrim, translateY, visible]);

  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      const shouldClose =
        event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;
      if (shouldClose) {
        translateY.value = withTiming(600, { duration: reducedMotion ? 0 : 160 }, () => scheduleOnRN(onClose));
        return;
      }
      translateY.value = reducedMotion ? 0 : withSpring(0, { damping: 22, stiffness: 240 });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const progressStyle = useAnimatedStyle(() => {
    const viewport = viewportHeight.value;
    const content = contentHeight.value;
    if (!showScrollProgress || !viewport || content <= viewport + 1) return { opacity: 0, height: 0, transform: [{ translateY: 0 }] };
    const thumb = Math.max(32, (viewport * viewport) / content);
    const travel = Math.max(0, viewport - thumb - 16);
    const offset = Math.min(Math.max(scrollY.value, 0), content - viewport);
    return {
      opacity: 1,
      height: thumb,
      transform: [{ translateY: 8 + (offset / (content - viewport)) * travel }],
    };
  });

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.modal}>
        <KeyboardAvoidingView behavior="padding" style={styles.modal}>
          <Animated.View style={[styles.scrimLayer, scrimStyle]}>
            <Pressable
              accessibilityLabel="Dismiss options"
              accessibilityRole="button"
              onPress={onClose}
              style={[styles.scrim, { backgroundColor: theme.overlay }]}
            />
          </Animated.View>
          {/*
            The sheet is a flex child rather than an absolutely placed one: a
            percentage max height cannot resolve against an auto-height parent,
            so the old sheet grew past both screen edges and its scroll view
            never took over. Bounding it here also means the keyboard shrinks
            the sheet instead of pushing its head off the top of the screen.
          */}
          <View pointerEvents="box-none" style={[styles.sheetLayer, { paddingTop: insets.top + Spacing.six }]}>
            <Animated.View style={[styles.sheetWrap, sheetStyle]}>
              <ThemedView
                style={[styles.sheet, { borderTopColor: theme.hairline }]}
                type="backgroundElevated">
                <GestureDetector gesture={pan}>
                  <View style={styles.grabArea}>
                    <View style={[styles.handle, { backgroundColor: theme.hairline }]} />
                    <View style={styles.header}>
                      <ThemedText style={styles.headerTitle} type="subtitle">{title}</ThemedText>
                      <Pressable
                        accessibilityLabel="Close"
                        accessibilityRole="button"
                        android_ripple={{ color: theme.backgroundSelected, borderless: true }}
                        hitSlop={12}
                        onPress={() => { hapticLight(); onClose(); }}
                        style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
                        <PlatformIcon color={theme.textSecondary} name="close" size={18} />
                      </Pressable>
                    </View>
                  </View>
                </GestureDetector>
                <View style={styles.scrollFrame}>
                  <Animated.ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
                    indicatorStyle={themeName === 'dark' ? 'white' : 'black'}
                    keyboardDismissMode="interactive"
                    keyboardShouldPersistTaps="handled"
                    onContentSizeChange={(_, height) => { contentHeight.value = height; }}
                    onLayout={(event) => { viewportHeight.value = event.nativeEvent.layout.height; }}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={!showScrollProgress}
                    style={styles.scroll}>
                    {children}
                  </Animated.ScrollView>
                  {showScrollProgress ? (
                    <View pointerEvents="none" style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
                      <Animated.View style={[styles.progressThumb, { backgroundColor: theme.accentStrong }, progressStyle]} />
                    </View>
                  ) : null}
                </View>
              </ThemedView>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

export function SheetSection({ children, title }: { children: React.ReactNode; title?: string }) {
  const theme = useTheme();
  const items = Children.toArray(children);
  return (
    <View style={styles.section}>
      {title ? (
        <ThemedText style={styles.sectionTitle} themeColor="textSecondary" type="captionBold">
          {title}
        </ThemedText>
      ) : null}
      <View style={[styles.sectionBody, { backgroundColor: theme.backgroundElement }]}>
        {items.map((child, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={[styles.separator, { backgroundColor: theme.hairline }]} /> : null}
            {child}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/** Consistent padded copy for loading, empty, offline, and result states. */
export function SheetNote({
  children,
  state = 'default',
}: {
  children: React.ReactNode;
  state?: 'default' | 'success' | 'error' | 'offline';
}) {
  const theme = useTheme();
  const color = state === 'error'
    ? theme.danger
    : state === 'success'
      ? theme.success
      : state === 'offline'
        ? theme.accentStrong
        : theme.textSecondary;

  return (
    <View accessibilityRole={state === 'error' ? 'alert' : undefined} style={styles.note}>
      <ThemedText style={{ color }} type="caption">{children}</ThemedText>
    </View>
  );
}

export function SheetRow({
  destructive,
  detail,
  disabled,
  icon,
  label,
  leading,
  loading,
  onPress,
  selected,
  state = 'default',
  trailing,
}: {
  destructive?: boolean;
  detail?: string;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof PlatformIcon>['name'];
  label: string;
  leading?: React.ReactNode;
  loading?: boolean;
  onPress?: () => void;
  selected?: boolean;
  state?: 'default' | 'success' | 'error' | 'offline';
  trailing?: React.ReactNode;
}) {
  const theme = useTheme();
  const textColor = destructive || state === 'error' ? theme.danger : state === 'success' ? theme.success : theme.text;
  const iconColor = destructive || state === 'error' ? theme.danger : state === 'success' ? theme.success : state === 'offline' ? theme.accentStrong : theme.textSecondary;
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityRole={onPress ? selected === undefined ? 'button' : 'radio' : undefined}
      accessibilityState={{ busy: Boolean(loading), disabled: Boolean(unavailable), selected }}
      android_ripple={{ color: theme.backgroundSelected }}
      disabled={unavailable}
      onPress={() => { if (onPress) { hapticLight(); onPress(); } }}
      style={({ pressed }) => [styles.sheetRow, { opacity: unavailable ? 0.45 : pressed ? 0.7 : 1 }]}>
      <View style={styles.sheetRowLeading}>
        {leading ?? (icon ? <PlatformIcon color={iconColor} name={icon} size={20} /> : state === 'offline' ? <PlatformIcon color={iconColor} name="cloud-off" size={20} /> : null)}
      </View>
      <View style={styles.sheetRowBody}>
        <ThemedText numberOfLines={1} style={{ color: textColor }} type="small">
          {label}
        </ThemedText>
        {detail ? (
          <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{detail}</ThemedText>
        ) : null}
      </View>
      {loading ? <ActivityIndicator color={iconColor} size="small" /> : selected ? (
        <PlatformIcon color={theme.accentStrong} name="check-circle" size={19} />
      ) : trailing ? (
        trailing
      ) : null}
    </Pressable>
  );
}

export function SheetInput({
  autoFocus,
  label,
  maxLength,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  autoFocus?: boolean;
  label: string;
  maxLength?: number;
  multiline?: boolean;
  onChangeText: (v: string) => void;
  placeholder?: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.inputWrap}>
      <ThemedText accessible={false} themeColor="textSecondary" type="captionBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        autoFocus={autoFocus}
        cursorColor={theme.accent}
        maxLength={maxLength}
        maxFontSizeMultiplier={MaxFontScale}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        selectionColor={theme.accent}
        selectionHandleColor={theme.accent}
        style={[
          styles.input,
          multiline && styles.inputMulti,
          styles.inputText,
          { backgroundColor: theme.backgroundElement, borderColor: theme.hairline, color: theme.text },
          multiline && styles.inputTextMulti,
        ]}
        value={value}
      />
    </View>
  );
}

/**
 * A tappable field that shows the current value and opens a dedicated picker.
 * Replaces free-form text entry for structured values.
 */
export function SheetFieldButton({
  icon,
  label,
  onPress,
  placeholder = 'Not set',
  onClear,
  value,
}: {
  icon?: React.ComponentProps<typeof PlatformIcon>['name'];
  label: string;
  onPress: () => void;
  placeholder?: string;
  onClear?: () => void;
  value?: string | null;
}) {
  const theme = useTheme();
  return (
    <View style={styles.inputWrap}>
      <ThemedText accessible={false} themeColor="textSecondary" type="captionBold">{label}</ThemedText>
      <Pressable
        accessibilityHint={`Opens the ${label.toLowerCase()} picker`}
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityRole="button"
        android_ripple={{ color: theme.backgroundSelected }}
        onPress={() => { hapticLight(); onPress(); }}
        style={[styles.field, { backgroundColor: theme.backgroundElement, borderColor: theme.hairline }]}>
        {icon ? <PlatformIcon color={theme.textSecondary} name={icon} size={19} /> : null}
        <ThemedText
          numberOfLines={1}
          style={styles.fieldValue}
          themeColor={value ? 'text' : 'textTertiary'}
          type="small">
          {value || placeholder}
        </ThemedText>
        {value && onClear ? (
          <Pressable
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            accessibilityRole="button"
            hitSlop={14}
            onPress={() => { hapticLight(); onClear(); }}>
            <PlatformIcon color={theme.textSecondary} name="close" size={17} />
          </Pressable>
        ) : (
          <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
        )}
      </Pressable>
    </View>
  );
}

export type SearchListItem = {
  /**
   * A function is resolved only for the rows that actually render, so a detail
   * that costs real work — a timezone's live offset and clock — never has to be
   * computed for the whole table.
   */
  detail?: string | (() => string);
  key: string;
  label: string;
  leading?: React.ReactNode;
  searchText?: string;
};

/** A filtered, selectable list for choices too numerous to stack as rows. */
export function SheetSearchList({
  emptyLabel = 'No matches',
  items,
  onSelect,
  placeholder = 'Search',
  selectedKey,
}: {
  emptyLabel?: string;
  items: SearchListItem[];
  onSelect: (key: string) => void;
  placeholder?: string;
  selectedKey?: string | null;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => (item.searchText ?? item.label).toLowerCase().includes(needle));
  }, [items, query]);

  // A sheet scrolls its own content, so a virtualized list cannot live inside
  // it. Rendering a page at a time keeps a long table cheap to open instead.
  const visible = filtered.slice(0, SEARCH_PAGE);
  const remaining = filtered.length - visible.length;

  return (
    <View style={styles.searchWrap}>
      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
        <PlatformIcon color={theme.textSecondary} name="search" size={18} />
        <TextInput
          accessibilityLabel={placeholder}
          autoCorrect={false}
          clearButtonMode="while-editing"
          cursorColor={theme.accent}
          maxLength={100}
          maxFontSizeMultiplier={MaxFontScale}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          selectionColor={theme.accent}
          selectionHandleColor={theme.accent}
          style={[styles.searchInput, { color: theme.text }]}
          value={query}
        />
      </View>
      {visible.length ? (
        <SheetSection>
          {visible.map((item) => (
            <SheetRow
              detail={typeof item.detail === 'function' ? item.detail() : item.detail}
              key={item.key}
              label={item.label}
              leading={item.leading}
              onPress={() => onSelect(item.key)}
              selected={item.key === selectedKey}
            />
          ))}
        </SheetSection>
      ) : (
        <View style={styles.searchEmpty}>
          <ThemedText themeColor="textSecondary" type="small">{emptyLabel}</ThemedText>
        </View>
      )}
      {remaining > 0 ? (
        <ThemedText
          accessibilityLiveRegion="polite"
          style={styles.searchMore}
          themeColor="textSecondary"
          type="caption">
          {`${remaining} more — keep typing to narrow the list`}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: TouchTarget,
    justifyContent: 'center',
    width: TouchTarget,
  },
  content: {
    gap: Spacing.three,
  },
  field: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
  },
  fieldValue: {
    flex: 1,
  },
  grabArea: {
    paddingTop: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    marginBottom: Spacing.three,
    width: 40,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
    paddingBottom: Spacing.three,
  },
  headerTitle: {
    flex: 1,
  },
  input: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: TouchTarget,
    overflow: 'hidden',
  },
  inputMulti: {
    minHeight: 96,
  },
  inputText: {
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  inputTextMulti: {
    textAlignVertical: 'top',
  },
  inputWrap: {
    gap: Spacing.one,
  },
  modal: {
    flex: 1,
  },
  scrim: {
    flex: 1,
  },
  scrimLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollFrame: {
    flexShrink: 1,
    position: 'relative',
  },
  progressTrack: {
    borderRadius: Radius.pill,
    bottom: 8,
    overflow: 'hidden',
    position: 'absolute',
    right: 2,
    top: 8,
    width: 3,
  },
  progressThumb: {
    borderRadius: Radius.pill,
    position: 'absolute',
    width: 3,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: Radius.medium,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
  },
  searchEmpty: {
    alignItems: 'center',
    padding: Spacing.five,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    paddingVertical: Spacing.two,
  },
  searchMore: {
    paddingHorizontal: 4,
  },
  searchWrap: {
    gap: Spacing.three,
  },
  note: {
    justifyContent: 'center',
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  sectionBody: {
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  sectionTitle: {
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
  sheet: {
    borderTopLeftRadius: Radius.xlarge,
    borderTopRightRadius: Radius.xlarge,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 1,
    paddingHorizontal: Spacing.four,
  },
  sheetLayer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.three,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sheetRowBody: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  sheetRowLeading: { alignItems: 'center', justifyContent: 'center', minWidth: 24 },
  sheetWrap: {
    flexShrink: 1,
  },
});
