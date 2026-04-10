import AsyncStorage from '@react-native-async-storage/async-storage';

export const storageKeys = {
  themeMode: 'expense-tracker.theme-mode',
  signedInUser: 'expense-tracker.signed-in-user',
} as const;

export const storage = {
  async get<T>(key: string) {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async set<T>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string) {
    await AsyncStorage.removeItem(key);
  },
};
