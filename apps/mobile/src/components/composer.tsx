import { Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import type { DetailedMessage } from '@/components/thread-row';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  activeGroupName: string | null;
  busy: boolean;
  isRecording: boolean;
  recordingDuration?: number;
  onAttach: () => void;
  onCancelReply: () => void;
  onChangeText: (v: string) => void;
  onFocus?: () => void;
  onRecord: () => void;
  onSend: () => void;
  replyTo: DetailedMessage | null;
  value: string;
};

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function RecordingDot() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.3, { duration: 800 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.recordingDotBase, style]} />;
}

export function Composer({ activeGroupName, busy, isRecording, recordingDuration = 0, onAttach, onCancelReply, onChangeText, onFocus, onRecord, onSend, replyTo, value }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  const canSend = Boolean(value.trim()) && !busy;

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <View style={[
      styles.bar,
      {
        backgroundColor: theme.background,
        borderTopColor: theme.hairline,
        paddingBottom: keyboardVisible ? Spacing.two : insets.bottom > 0 ? insets.bottom : Spacing.three,
      },
    ]}>
      {replyTo ? (
        <View style={[styles.replyBanner, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.replyAccent, { backgroundColor: theme.accent }]} />
          <View style={styles.replyBody}>
            <ThemedText style={{ color: theme.textSecondary }} type="code">
              Replying to {replyTo.author?.displayName ?? 'Member'}
            </ThemedText>
            <ThemedText numberOfLines={1} type="small">{replyTo.message.body}</ThemedText>
          </View>
          <Pressable hitSlop={12} onPress={onCancelReply}>
            <PlatformIcon color={theme.textSecondary} name="close" size={18} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable
          android_ripple={{ color: theme.backgroundSelected, borderless: true }}
          hitSlop={8}
          onPress={() => { hapticLight(); onAttach(); }}
          style={[styles.circle, { backgroundColor: theme.backgroundElement }]}>
          <PlatformIcon color={theme.textSecondary} name="paperclip" size={20} />
        </Pressable>

        {isRecording ? (
          <View style={[styles.recordingBar, { backgroundColor: theme.backgroundElement }]}>
            <RecordingDot />
            <ThemedText type="small">Recording…</ThemedText>
            <ThemedText style={{ color: theme.textSecondary }} type="code">
              {formatDuration(recordingDuration)}
            </ThemedText>
            <Pressable
              android_ripple={{ color: theme.backgroundSelected, borderless: true }}
              hitSlop={8}
              onPress={() => { hapticLight(); onRecord(); }}
              style={[styles.stopButton, { backgroundColor: theme.backgroundSelected }]}>
              <PlatformIcon color="#b91c1c" name="stop" size={18} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end' }}>
            <TextInput
              allowFontScaling
              multiline
              onChangeText={onChangeText}
              onFocus={onFocus}
              placeholder={`Message ${activeGroupName ?? 'Channel'} or ask @track…`}
              placeholderTextColor={theme.textSecondary}
              style={[styles.pill, { backgroundColor: theme.backgroundElement, color: theme.text, flex: 1 }]}
              value={value}
            />
            {canSend ? (
              <Pressable
                android_ripple={{ color: theme.backgroundSelected, borderless: true }}
                hitSlop={8}
                onPress={() => { hapticMedium(); onSend(); }}
                style={[styles.sendInline, { backgroundColor: theme.accent }]}>
                <PlatformIcon color="#1b1917" name="arrow-up" size={18} />
              </Pressable>
            ) : (
              <Pressable
                android_ripple={{ color: theme.backgroundSelected, borderless: true }}
                hitSlop={8}
                onPress={() => { hapticLight(); onRecord(); }}
                style={[styles.micInline, { backgroundColor: theme.backgroundElement }]}>
                <PlatformIcon color={theme.textSecondary} name="microphone-outline" size={20} />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const BTN = Platform.select({ ios: 44, android: 48 }) ?? 44;

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  circle: { alignItems: 'center', borderRadius: BTN / 2, height: BTN, justifyContent: 'center', width: BTN },
  micInline: { alignItems: 'center', borderRadius: BTN / 2, height: BTN, justifyContent: 'center', marginLeft: Spacing.two, width: BTN },
  pill: { borderRadius: 20, fontSize: 14, lineHeight: 20, maxHeight: 112, minHeight: BTN, paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? 10 : 8 },
  recordingBar: { alignItems: 'center', borderRadius: 20, flex: 1, flexDirection: 'row', gap: Spacing.two, height: BTN, paddingHorizontal: Spacing.three },
  recordingDotBase: { backgroundColor: '#b91c1c', borderRadius: 5, height: 10, width: 10 },
  replyAccent: { borderRadius: 2, width: 3 },
  replyBanner: { alignItems: 'center', borderRadius: 8, flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  replyBody: { flex: 1, gap: 2 },
  row: { alignItems: 'flex-end', flexDirection: 'row', gap: Spacing.two },
  sendInline: { alignItems: 'center', borderRadius: BTN / 2, height: BTN, justifyContent: 'center', marginLeft: Spacing.two, width: BTN },
  stopButton: { alignItems: 'center', borderRadius: BTN / 2, height: BTN, justifyContent: 'center', width: BTN },
});
