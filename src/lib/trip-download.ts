import * as Crypto from "expo-crypto";

import { tripStore, type TripPackage } from "@/db";
import { API_URL } from "./api";
import { scheduleBriefingNotifications } from "./briefing-notifications";
import { deleteSectionTiles, downloadSectionTiles } from "./offline-tiles";
import { enqueueWrite } from "./outbox";

/**
 * Trip Download (docs §4.2): fetch the section's offline package, verify its
 * checksum, insert transactionally, and verify row counts. Any failure
 * throws — the app never reports "ready for trail" on a partial save.
 */
export async function downloadTrip(sectionId: string, token: string | null): Promise<void> {
  const res = await fetch(`${API_URL}/api/sections/${sectionId}/offline-package`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await res.text();

  let parsed: TripPackage & { error?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected response (${res.status})`);
  }
  if (!res.ok) throw new Error(parsed.error ?? `Download failed (${res.status})`);

  // Integrity: sha256 over the exact data payload, matched against the
  // server's hash. JSON.parse → JSON.stringify preserves key order, so the
  // string round-trips identically.
  const recomputed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify(parsed.data)
  );
  if (recomputed !== parsed.checksum) {
    throw new Error("Checksum mismatch — the download was corrupted, try again");
  }

  await tripStore.applyTripPackage(parsed, text.length);

  // Trip is verified on-device — arm the morning briefing notifications (F5).
  await scheduleBriefingNotifications(parsed.data.section);

  // Save the section's map tiles for offline use (native dev-client only;
  // no-ops in Expo Go / web). Best-effort: the trip data is what makes a
  // section "ready for trail", so a tile-server hiccup mustn't fail the whole
  // download or roll back the verified data — log and move on. Runs after the
  // data is committed so the section still shows as offline even if tiles lag.
  try {
    const { id, startMile, endMile } = parsed.data.section;
    await downloadSectionTiles(id, startMile, endMile);
  } catch (err) {
    console.warn("[trip-download] map tiles not saved:", err);
  }
}

/**
 * Undo a trip download: clears the section's local data (logs, briefings,
 * POIs, elevation profile) and its saved offline map tiles. The section's own
 * synced row is untouched, so it stays visible in Journal and can be
 * re-downloaded any time.
 */
export async function deleteTripData(sectionId: string): Promise<void> {
  await tripStore.deleteTripDownload(sectionId);
  await deleteSectionTiles(sectionId);
}

/**
 * Delete a section entirely: clears its local data and offline map tiles
 * immediately (so it disappears from Journal right away, online or not),
 * then queues the server-side delete through the outbox — consistent with
 * every other mobile section write, and safe to fire while offline since the
 * outbox retries once connectivity returns.
 */
export async function removeSection(sectionId: string, token: string | null): Promise<void> {
  await tripStore.deleteSection(sectionId);
  await deleteSectionTiles(sectionId);
  await enqueueWrite(
    `/api/mobile/sections/${sectionId}/delete`,
    {},
    `delete-section-${sectionId}`,
    token
  );
}
