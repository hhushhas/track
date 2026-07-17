import * as SecureStore from 'expo-secure-store';

const INSTALLATION_KEY = 'track.push.installation-id.v1';
const LAST_RESPONSE_KEY = 'track.push.last-response-id.v1';

function createInstallationId() {
  const random = Math.random().toString(36).slice(2);
  return `track-${Date.now().toString(36)}-${random}`;
}

export async function getPushInstallationId() {
  const existing = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (existing) return existing;
  const created = createInstallationId();
  await SecureStore.setItemAsync(INSTALLATION_KEY, created);
  return created;
}

export function getStoredPushInstallationId() {
  return SecureStore.getItemAsync(INSTALLATION_KEY);
}

export async function consumePushResponseId(responseId: string) {
  const last = await SecureStore.getItemAsync(LAST_RESPONSE_KEY);
  if (last === responseId) return false;
  await SecureStore.setItemAsync(LAST_RESPONSE_KEY, responseId);
  return true;
}
