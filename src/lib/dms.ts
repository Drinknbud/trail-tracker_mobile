import { apiFetch } from "./api";

// Mirrors the web app's /api/dms/** routes (now bearer-token enabled).
// Direct Messages is Bucket B (online-only, requirements FEATURE-BUCKETS.md) —
// no local cache, no outbox. Callers should show an offline wall on failure.

export type DmUser = {
  id: string;
  name: string | null;
  trailName: string | null;
  image: string | null;
};

export type DmThread = {
  userId: string;
  user: DmUser;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
};

export async function fetchDmThreads(token: string): Promise<DmThread[]> {
  return apiFetch<DmThread[]>("/api/dms", { token });
}

export type DmMessage = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  recipientId: string;
  sender: DmUser;
  recipient: DmUser;
};

export async function fetchDmMessages(
  token: string,
  otherId: string,
  before?: string
): Promise<DmMessage[]> {
  const query = before ? `?before=${encodeURIComponent(before)}&limit=50` : "?limit=50";
  const res = await apiFetch<{ messages: DmMessage[] }>(`/api/dms/${otherId}${query}`, { token });
  return res.messages;
}

export async function sendDm(token: string, otherId: string, content: string): Promise<DmMessage> {
  return apiFetch<DmMessage>(`/api/dms/${otherId}`, { method: "POST", token, body: { content } });
}

// Matches web's 10s poll (components/community/... and app/community/dms/[userId]/page.tsx POLL_MS).
export const DM_POLL_MS = 10_000;
