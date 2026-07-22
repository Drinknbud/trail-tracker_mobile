// expo-localization requires a native module (ExpoLocalization) that isn't
// present in whatever dev-client build is currently installed on the device
// — the dependency + app.json plugin were added after that build was
// compiled, and a JS/Metro reload can't add native code, only a fresh EAS
// build + reinstall can. Guard behind a lazy require + try/catch (same
// pattern as notifications-safe.ts) so the app degrades to no device-locale
// default instead of crashing the whole app at root layout.

export function getMeasurementSystem(): "us" | "uk" | "metric" | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocales } = require("expo-localization");
    return getLocales()[0]?.measurementSystem ?? null;
  } catch {
    return null;
  }
}
