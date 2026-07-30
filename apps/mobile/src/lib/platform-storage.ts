import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

function webStorage() {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function getItem(key: string) {
  const storage = webStorage();
  if (Platform.OS === 'web') {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItem(key);
}

function setItem(key: string, value: string) {
  const storage = webStorage();
  if (Platform.OS === 'web') {
    try {
      storage?.setItem(key, value);
    } catch {
      // Web storage may be disabled by the browser.
    }
    return;
  }
  SecureStore.setItem(key, value);
}

function deleteItem(key: string) {
  const storage = webStorage();
  if (Platform.OS === 'web') {
    try {
      storage?.removeItem(key);
    } catch {
      // Web storage may be disabled by the browser.
    }
    return;
  }
  SecureStore.deleteItemAsync(key).catch(() => undefined);
}

export const platformStorage = {
  deleteItem,
  deleteItemAsync: async (key: string) => {
    if (Platform.OS === 'web') {
      deleteItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
  getItem,
  getItemAsync: async (key: string) => {
    if (Platform.OS === 'web') return getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem,
  setItemAsync: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
};
