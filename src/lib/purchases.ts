import { Platform } from "react-native";

// RevenueCat wrapper (docs §5.5) — in-app purchase is mandatory for store
// compliance. The SDK is a native module: absent in Expo Go and on web, so
// everything is deferred-required and degrades to a "store build required"
// message until EAS builds run with the API keys set.
const API_KEY = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
});

let configured = false;

type PurchasesModule = typeof import("react-native-purchases").default;

function loadSdk(): PurchasesModule | null {
  if (Platform.OS === "web" || !API_KEY) return null;
  try {
    return (require("react-native-purchases") as typeof import("react-native-purchases")).default;
  } catch {
    return null; // Expo Go — native module unavailable
  }
}

/** Call after sign-in so purchases attach to our user id (webhook app_user_id). */
export async function configurePurchases(userId: string): Promise<boolean> {
  const Purchases = loadSdk();
  if (!Purchases) return false;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: API_KEY!, appUserID: userId });
      configured = true;
    } else {
      await Purchases.logIn(userId);
    }
    return true;
  } catch {
    return false;
  }
}

export type PurchaseResult = { success: boolean; message: string };

const NOT_AVAILABLE: PurchaseResult = {
  success: false,
  message:
    "In-app purchases arrive with the store build. Until then, manage your subscription at the Trail Tracker website.",
};

export async function purchasePremium(): Promise<PurchaseResult> {
  const Purchases = loadSdk();
  if (!Purchases || !configured) return NOT_AVAILABLE;
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages[0];
    if (!pkg) return { success: false, message: "No subscription offering is configured yet." };
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const active = Object.keys(customerInfo.entitlements.active).length > 0;
    return active
      ? { success: true, message: "Welcome to Premium! The trail is yours." }
      : { success: false, message: "Purchase completed but no entitlement is active yet." };
  } catch (err) {
    const e = err as { userCancelled?: boolean; message?: string };
    if (e.userCancelled) return { success: false, message: "Purchase cancelled." };
    return { success: false, message: e.message ?? "Purchase failed." };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const Purchases = loadSdk();
  if (!Purchases || !configured) return NOT_AVAILABLE;
  try {
    const customerInfo = await Purchases.restorePurchases();
    const active = Object.keys(customerInfo.entitlements.active).length > 0;
    return active
      ? { success: true, message: "Premium restored." }
      : { success: false, message: "No previous purchases found for this account." };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Restore failed." };
  }
}
