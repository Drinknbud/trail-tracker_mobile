import { apiFetch } from "./api";

// Mirrors the web app's /api/questions/** routes (now bearer-token enabled).
// Trail Q&A is Bucket B (online-only, requirements FEATURE-BUCKETS.md) — no
// local cache, no outbox. Callers should show an offline wall on failure.
// Anonymous by design: only trailName is ever exposed, never askerId/name/email.

export type QuestionSummary = {
  id: string;
  trailKey: string;
  startMile: number | null;
  endMile: number | null;
  body: string;
  status: "open" | "closed";
  createdAt: string;
  _count: { answers: number };
};

export async function fetchAllQuestions(token: string): Promise<QuestionSummary[]> {
  return apiFetch<QuestionSummary[]>("/api/questions", { token });
}

export async function fetchEligibleQuestions(token: string): Promise<QuestionSummary[]> {
  return apiFetch<QuestionSummary[]>("/api/questions?eligible=true", { token });
}

export async function askQuestion(
  token: string,
  input: { trailKey: string; startMile?: number; endMile?: number; body: string }
): Promise<QuestionSummary> {
  return apiFetch<QuestionSummary>("/api/questions", { method: "POST", token, body: input });
}

export type Answer = {
  id: string;
  body: string;
  createdAt: string;
  answerer: { trailName: string | null };
};

export type QuestionDetail = QuestionSummary & {
  isAsker: boolean;
  answers: Answer[];
};

export async function fetchQuestion(token: string, id: string): Promise<QuestionDetail> {
  return apiFetch<QuestionDetail>(`/api/questions/${id}`, { token });
}

export async function closeQuestion(token: string, id: string): Promise<void> {
  await apiFetch(`/api/questions/${id}`, { method: "PATCH", token, body: { status: "closed" } });
}

export async function submitAnswer(token: string, questionId: string, body: string): Promise<Answer> {
  return apiFetch<Answer>(`/api/questions/${questionId}/answers`, { method: "POST", token, body: { body } });
}
