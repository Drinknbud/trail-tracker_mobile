import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

// expo-notifications throws at import time on Android in Expo Go (SDK 53+
// removed remote-notification support there and its push-token-registration
// side effect module throws unconditionally as soon as anything imports the
// package — see DevicePushTokenAutoRegistration.fx.js). A dev build doesn't
// have this restriction. Static `import * as Notifications from
// "expo-notifications"` crashes the whole app before render on Expo Go
// Android, so every call site must go through this lazy, guarded accessor
// instead of importing the package directly.

export function notificationsAvailable(): boolean {
  return !(Platform.OS === "android" && isRunningInExpoGo());
}

export function getNotifications(): typeof import("expo-notifications") | null {
  if (!notificationsAvailable()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications");
}
