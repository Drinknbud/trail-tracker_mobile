import { API_URL, apiFetch } from "./api";

// Mirrors the web app's /api/buddy-listings, /api/buddy-connections, and
// /api/ratings routes (now bearer-token enabled). Trail Buddy is Bucket B
// (online-only, requirements FEATURE-BUCKETS.md) — no local cache, no
// outbox. Callers should show an offline wall on failure.

// Trail Personality fields aren't in webApi.ts's WebUser type (that type
// backs Settings, which doesn't expose these fields on mobile yet) — a
// narrow fetch here avoids widening that shared type for a read-only need.
export type ViewerCompatProfile = {
  typicalDailyMiles: number | null;
  socialStyle: string | null;
  wakeStyle: string | null;
  campStyle: string | null;
};

export async function fetchViewerCompatProfile(token: string): Promise<ViewerCompatProfile> {
  return apiFetch<ViewerCompatProfile>("/api/user", { token });
}

export type BuddyPoster = {
  id: string;
  trailName: string | null;
  image: string | null;
  shareSlug: string | null;
  homeZip: string | null;
  typicalDailyMiles: number | null;
  socialStyle: string | null;
  wakeStyle: string | null;
  campStyle: string | null;
  hikePace: string | null;
  buddyAgeRange: string | null;
  musicOnTrail: string | null;
  hobbies: string | null;
};

export type BuddyListing = {
  id: string;
  trailKey: string;
  startMile: number | null;
  endMile: number | null;
  startDate: string | null;
  endDate: string | null;
  miles: number | null;
  message: string | null;
  maxBuddies: number;
  status: string;
  connectionCount: number;
  avgRating: number | null;
  ratingCount: number;
  user: BuddyPoster;
  createdAt: string;
};

export async function fetchBuddyListings(
  token: string,
  opts: { startDate?: string; endDate?: string } = {}
): Promise<BuddyListing[]> {
  const params = new URLSearchParams({ status: "open" });
  if (opts.startDate) params.set("startDate", opts.startDate);
  if (opts.endDate) params.set("endDate", opts.endDate);
  const res = await apiFetch<{ listings: BuddyListing[] }>(`/api/buddy-listings?${params}`, { token });
  return res.listings;
}

export async function fetchMyBuddyListings(token: string): Promise<BuddyListing[]> {
  const res = await apiFetch<{ listings: BuddyListing[] }>("/api/buddy-listings?mine=true", { token });
  return res.listings;
}

export async function createBuddyListing(
  token: string,
  input: {
    trailKey: string;
    startMile?: number;
    endMile?: number;
    startDate?: string;
    endDate?: string;
    miles?: number;
    message?: string;
    maxBuddies?: number;
  }
): Promise<BuddyListing> {
  return apiFetch<BuddyListing>("/api/buddy-listings", { method: "POST", token, body: input });
}

export async function closeBuddyListing(token: string, listingId: string): Promise<void> {
  await apiFetch(`/api/buddy-listings/${listingId}`, { method: "PATCH", token, body: { status: "closed" } });
}

export async function deleteBuddyListing(token: string, listingId: string): Promise<void> {
  await apiFetch(`/api/buddy-listings/${listingId}`, { method: "DELETE", token });
}

export async function connectToListing(
  token: string,
  listingId: string,
  message?: string
): Promise<{ connectionId: string; dmOpened: boolean }> {
  return apiFetch(`/api/buddy-listings/${listingId}/connect`, {
    method: "POST",
    token,
    body: { message: message ?? "" },
  });
}

export type BuddyConnectionUser = {
  id: string;
  trailName: string | null;
  image: string | null;
  shareSlug: string | null;
};

export type BuddyConnection = {
  id: string;
  listingId: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "declined";
  message: string | null;
  createdAt: string;
  listing: BuddyListing;
  fromUser?: BuddyConnectionUser;
  toUser?: BuddyConnectionUser;
  existingRating?: { id: string; score: number; review: string | null } | null;
};

export type BuddyConnectionsData = {
  incoming: BuddyConnection[];
  outgoing: BuddyConnection[];
};

export async function fetchBuddyConnections(token: string): Promise<BuddyConnectionsData> {
  return apiFetch<BuddyConnectionsData>("/api/buddy-connections", { token });
}

export async function respondToConnection(
  token: string,
  connectionId: string,
  status: "accepted" | "declined"
): Promise<BuddyConnection> {
  return apiFetch(`/api/buddy-connections/${connectionId}`, { method: "PATCH", token, body: { status } });
}

export async function updateRating(
  token: string,
  ratingId: string,
  score: number,
  review?: string
): Promise<void> {
  await apiFetch(`/api/ratings/${ratingId}`, { method: "PATCH", token, body: { score, review } });
}

// Raw fetch (not apiFetch) because we need the 409 body's existingId to
// fall back to a PATCH — matches web's RatingModal recovery flow exactly.
export async function submitOrUpdateRating(
  token: string,
  toUserId: string,
  score: number,
  review?: string
): Promise<void> {
  const body = JSON.stringify({ toUserId, score, review: review?.trim() || undefined });
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  let res = await fetch(`${API_URL}/api/ratings`, { method: "POST", headers, body });
  if (res.status === 409) {
    const data = (await res.json().catch(() => null)) as { existingId?: string } | null;
    if (data?.existingId) {
      res = await fetch(`${API_URL}/api/ratings/${data.existingId}`, { method: "PATCH", headers, body });
    }
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
}
