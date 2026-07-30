import { apiFetch } from "./api";

// Mirrors the web app's /api/tribes/** routes (now bearer-token enabled).
// Tribes is Bucket B (online-only, requirements FEATURE-BUCKETS.md) — no
// local cache, no outbox. Callers should catch ApiError/network failures and
// show an offline wall rather than a partial/stale view.

export type TribeSummary = {
  id: string;
  name: string;
  description: string | null;
  trailKey: string | null;
  isAutoTrail: boolean;
  ownerId: string;
  memberCount: number;
  myRole: "owner" | "admin" | "member";
  createdAt: string;
};

export type JoinableTrailTribe = {
  id: string | null;
  trailKey: string;
  trailName: string;
  trailShortName: string;
  memberCount: number;
  joined: boolean;
};

export type TribesResponse = {
  tribes: TribeSummary[];
  joinableTrailTribe: JoinableTrailTribe | null;
};

export async function fetchTribes(token: string): Promise<TribesResponse> {
  return apiFetch<TribesResponse>("/api/tribes", { token });
}

export async function createTribe(
  token: string,
  input: { name: string; description?: string; trailKey?: string }
): Promise<TribeSummary> {
  return apiFetch<TribeSummary>("/api/tribes", { method: "POST", token, body: input });
}

export async function joinTrailTribe(
  token: string,
  trailKey: string
): Promise<{ tribe: TribeSummary; alreadyMember: boolean }> {
  return apiFetch("/api/tribes/trail-join", { method: "POST", token, body: { trailKey } });
}

export type TribeMemberUser = {
  id: string;
  name: string | null;
  trailName: string | null;
  image: string | null;
};

export type TribeMember = {
  id: string;
  tribeId: string;
  userId: string | null;
  inviteeEmail: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "accepted" | "declined";
  invitedById: string;
  createdAt: string;
  updatedAt: string;
  user: TribeMemberUser | null;
};

export type TribeDetail = {
  id: string;
  name: string;
  description: string | null;
  trailKey: string | null;
  isAutoTrail: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members: TribeMember[];
  myRole: "owner" | "admin" | "member";
  myMemberId: string;
};

export async function fetchTribe(token: string, tribeId: string): Promise<TribeDetail> {
  return apiFetch<TribeDetail>(`/api/tribes/${tribeId}`, { token });
}

export async function leaveTribe(token: string, tribeId: string, memberId: string): Promise<void> {
  await apiFetch(`/api/tribes/${tribeId}/members/${memberId}`, { method: "DELETE", token });
}

export async function removeMember(token: string, tribeId: string, memberId: string): Promise<void> {
  await apiFetch(`/api/tribes/${tribeId}/members/${memberId}`, { method: "DELETE", token });
}

export async function setMemberRole(
  token: string,
  tribeId: string,
  memberId: string,
  role: "admin" | "member"
): Promise<TribeMember> {
  return apiFetch(`/api/tribes/${tribeId}/members/${memberId}`, { method: "PATCH", token, body: { role } });
}

export async function inviteToTribe(
  token: string,
  tribeId: string,
  input: { email?: string; trailName?: string }
): Promise<TribeMember> {
  return apiFetch(`/api/tribes/${tribeId}/invite`, { method: "POST", token, body: input });
}

export type TribeMessage = {
  id: string;
  tribeId: string;
  userId: string;
  content: string;
  photoUrls: string; // JSON string[]
  deletedAt: string | null;
  createdAt: string;
  user: TribeMemberUser;
};

export async function fetchTribeMessages(
  token: string,
  tribeId: string,
  before?: string
): Promise<TribeMessage[]> {
  const query = before ? `?before=${encodeURIComponent(before)}&limit=50` : "?limit=50";
  const res = await apiFetch<{ messages: TribeMessage[] }>(`/api/tribes/${tribeId}/messages${query}`, { token });
  return res.messages;
}

export async function sendTribeMessage(
  token: string,
  tribeId: string,
  input: { content?: string; photoUrls?: string[] }
): Promise<TribeMessage> {
  return apiFetch(`/api/tribes/${tribeId}/messages`, { method: "POST", token, body: input });
}

// Matches web's 10s poll interval for tribe/party chat (components/community/TribeChatPanel.tsx).
// Requirements doc flags upgrading this to push/WebSocket as an open question — not blocking v1.
export const TRIBE_MESSAGE_POLL_MS = 10_000;
