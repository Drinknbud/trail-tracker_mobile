import { apiFetch } from "./api";
import { storage } from "./storage";
import type { MeResponse } from "./auth";

// Premium entitlement, cached on-device so gates work offline (a hiker who
// bought premium must keep briefings 14 days into airplane mode). The server
// is the source of truth (docs §5.5) — Stripe and RevenueCat both write the
// same fields; this is just the last-known copy.
const KEY = "entitlement.v1";

export type Entitlement = {
  userId: string;
  tier: string;
  expiresAt: string | null;
  fetchedAt: string;
};

export function entitlementIsPremium(e: Entitlement | null): boolean {
  if (!e) return false;
  if (e.tier !== "premium" && e.tier !== "comped") return false;
  if (e.expiresAt && new Date(e.expiresAt) < new Date()) return false;
  return true;
}

export async function getCachedEntitlement(): Promise<Entitlement | null> {
  const raw = await storage.get(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Entitlement;
  } catch {
    return null;
  }
}

export async function refreshEntitlement(token: string | null): Promise<Entitlement | null> {
  if (!token) return getCachedEntitlement();
  try {
    const me = await apiFetch<MeResponse>("/api/mobile/me", { token });
    const entitlement: Entitlement = {
      userId: me.user.id,
      tier: me.user.subscriptionTier,
      expiresAt: me.user.subscriptionExpiresAt,
      fetchedAt: new Date().toISOString(),
    };
    await storage.set(KEY, JSON.stringify(entitlement));
    return entitlement;
  } catch {
    // Offline — the cached copy stands
    return getCachedEntitlement();
  }
}

export async function clearEntitlement(): Promise<void> {
  await storage.remove(KEY);
}
