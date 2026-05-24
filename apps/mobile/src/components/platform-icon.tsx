import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { Platform } from 'react-native';

export type IconName =
  | 'apple'
  | 'arrow-up'
  | 'bell-outline'
  | 'bell-off-outline'
  | 'briefcase-outline'
  | 'check-circle'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'dots-horizontal'
  | 'email-outline'
  | 'file-document-outline'
  | 'forum-outline'
  | 'logout'
  | 'microphone-outline'
  | 'paperclip'
  | 'shield-lock-outline'
  | 'stop'
  | 'trash-can-outline'
  | 'account-edit-outline'
  | 'clock-outline'
  | 'white-balance-sunny'
  | 'theme-light-dark'
  | 'moon-waning-crescent'
  | 'plus';

const SF_MAP: Partial<Record<IconName, SFSymbol>> = {
  'apple': 'apple.logo',
  'arrow-up': 'arrow.up',
  'bell-outline': 'bell',
  'bell-off-outline': 'bell.slash',
  'briefcase-outline': 'briefcase',
  'check-circle': 'checkmark.circle.fill',
  'chevron-down': 'chevron.down',
  'chevron-left': 'chevron.left',
  'chevron-right': 'chevron.right',
  'close': 'xmark',
  'dots-horizontal': 'ellipsis',
  'email-outline': 'envelope',
  'file-document-outline': 'doc.text',
  'forum-outline': 'bubble.left.and.bubble.right',
  'logout': 'rectangle.portrait.and.arrow.right',
  'microphone-outline': 'mic',
  'paperclip': 'paperclip',
  'shield-lock-outline': 'lock.shield',
  'stop': 'stop.fill',
  'trash-can-outline': 'trash',
  'account-edit-outline': 'person.crop.circle',
  'clock-outline': 'clock',
  'white-balance-sunny': 'sun.max',
  'theme-light-dark': 'circle.lefthalf.filled',
  'moon-waning-crescent': 'moon',
  'plus': 'plus',
};

// Android Material Icons mapping for a more native Android feel
const ANDROID_MAP: Partial<Record<IconName, React.ComponentProps<typeof MaterialIcons>['name']>> = {
  'apple': 'apple',
  'arrow-up': 'arrow-upward',
  'bell-outline': 'notifications-none',
  'bell-off-outline': 'notifications-off',
  'briefcase-outline': 'work-outline',
  'check-circle': 'check-circle',
  'chevron-down': 'keyboard-arrow-down',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'close': 'close',
  'dots-horizontal': 'more-horiz',
  'email-outline': 'mail-outline',
  'file-document-outline': 'description',
  'forum-outline': 'forum',
  'logout': 'logout',
  'microphone-outline': 'mic-none',
  'paperclip': 'attach-file',
  'shield-lock-outline': 'security',
  'stop': 'stop',
  'trash-can-outline': 'delete-outline',
  'account-edit-outline': 'person-outline',
  'clock-outline': 'access-time',
  'white-balance-sunny': 'wb-sunny',
  'theme-light-dark': 'brightness-medium',
  'moon-waning-crescent': 'nightlight',
  'plus': 'add',
};

// iOS-friendly Ionicons fallback for any unmatched icons
const ION_MAP: Partial<Record<IconName, React.ComponentProps<typeof Ionicons>['name']>> = {
  'white-balance-sunny': 'sunny-outline',
  'theme-light-dark': 'contrast-outline',
  'moon-waning-crescent': 'moon-outline',
};

type Props = { name: IconName; size: number; color: string };

export function PlatformIcon({ name, size, color }: Props) {
  if (Platform.OS === 'ios') {
    const sf = SF_MAP[name];
    if (sf) {
      return (
        <SymbolView
          name={sf}
          size={size}
          tintColor={color}
          style={{ width: size, height: size }}
        />
      );
    }
    const ion = ION_MAP[name];
    if (ion) return <Ionicons color={color} name={ion} size={size} />;
    return <Ionicons color={color} name="help-circle-outline" size={size} />;
  }

  // Android: prefer Material Icons, then Ionicons
  const mat = ANDROID_MAP[name];
  if (mat) return <MaterialIcons color={color} name={mat} size={size} />;
  const ion = ION_MAP[name];
  if (ion) return <Ionicons color={color} name={ion} size={size} />;
  return <Ionicons color={color} name="help-circle-outline" size={size} />;
}
