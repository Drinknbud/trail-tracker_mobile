import { tripStore } from "@/db";
import { API_URL } from "./api";

// Outbox sync engine (docs §4.3): offline writes land in SQLite plus the
// outbox; this flushes them opportunistically. Failures never block the UI —
// rows keep their error and retry on the next flush, up to MAX_ATTEMPTS
// (dead rows stay visible in Trip Status rather than vanishing).
const MAX_ATTEMPTS = 8;

let flushing = false;

export async function enqueueWrite(
  endpoint: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
  token: string | null,
  method: string = "POST"
): Promise<void> {
  await tripStore.outboxEnqueue({ endpoint, method, payload, idempotencyKey });
  // Opportunistic immediate flush — succeeds when online, quietly fails when not.
  void flushOutbox(token);
}

export async function flushOutbox(
  token: string | null
): Promise<{ sent: number; failed: number }> {
  if (flushing || !token) return { sent: 0, failed: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  try {
    const pending = await tripStore.outboxPending(MAX_ATTEMPTS);
    for (const entry of pending) {
      try {
        const res = await fetch(`${API_URL}${entry.endpoint}`, {
          method: entry.method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "Idempotency-Key": entry.idempotencyKey,
          },
          body: JSON.stringify(entry.payload),
        });
        if (res.ok) {
          await tripStore.outboxDelete(entry.id);
          sent++;
        } else {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          await tripStore.outboxRecordFailure(
            entry.id,
            body?.error ?? `HTTP ${res.status}`
          );
          failed++;
        }
      } catch {
        // Network-level failure (offline): stop the flush and leave rows
        // untouched — connectivity loss must not burn retry attempts.
        failed++;
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { sent, failed };
}
