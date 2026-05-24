import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const native = Platform.OS !== 'web';

export function hapticLight() {
  if (native) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticMedium() {
  if (native) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticDestructive() {
  if (native) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
