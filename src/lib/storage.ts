import AsyncStorage from "@react-native-async-storage/async-storage";

// Thin wrapper so the backend can be swapped for react-native-mmkv once we
// move from Expo Go to a dev-client build (MMKV needs a native module).
export const storage = {
  get(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
