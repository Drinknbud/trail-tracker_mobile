import { storage } from "./storage";
import type { WebUser } from "./webApi";

// Last-known copy of the full profile/settings object, persisted on-device
// so the Dashboard header and the Settings screen both have something to
// show offline instead of a blank/spinner state — the live `user` fetch has
// no local fallback of its own. The server is always the source of truth;
// this is just the last successful GET (or the last locally-applied PATCH,
// see settings.tsx's save() functions), refreshed opportunistically whenever
// online. expo-image's default cachePolicy ("disk") already keeps the hero/
// avatar image bytes themselves on-device after the first successful
// render — this cache is only for the WebUser fields, which is what was
// actually missing offline.
const KEY = "webUser.v1";

export async function getCachedUser(): Promise<WebUser | null> {
  const raw = await storage.get(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WebUser;
  } catch {
    return null;
  }
}

export async function cacheUser(user: WebUser): Promise<void> {
  await storage.set(KEY, JSON.stringify(user));
}
