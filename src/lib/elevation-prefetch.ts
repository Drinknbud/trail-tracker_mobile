import { fetchLiveElevationProfile, type LiveElevationProfile } from "@/lib/webApi";

// Kicks off the same /api/elevation/profile fetch that section/[id].tsx's
// load() falls back to for a Planning section (no local/downloaded profile
// yet), but as soon as the Journal row is pressed instead of after the
// navigation completes — shaves the network round-trip off the perceived
// "tap → chart appears" delay instead of eliminating any real work.
// Module-level Map (not a ref/state) so it survives the Journal→detail
// screen navigation, which mounts a different component tree entirely.
const inFlight = new Map<string, Promise<LiveElevationProfile | null>>();

export function startElevationPrefetch(
  sectionId: string,
  params: { catalogKey: string; startMile: number; endMile: number; totalMiles: number },
): void {
  if (inFlight.has(sectionId)) return;
  inFlight.set(
    sectionId,
    fetchLiveElevationProfile(params).catch(() => null),
  );
}

/** Consumes (removes) a pending/finished prefetch for this section, if any. */
export function takeElevationPrefetch(sectionId: string): Promise<LiveElevationProfile | null> | undefined {
  const p = inFlight.get(sectionId);
  inFlight.delete(sectionId);
  return p;
}
