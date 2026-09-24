export type PushAvailability = 'available' | 'expo_go';

export function resolvePushAvailability({
  expoGo,
}: {
  expoGo: boolean;
}): PushAvailability {
  if (expoGo) return 'expo_go';
  return 'available';
}
