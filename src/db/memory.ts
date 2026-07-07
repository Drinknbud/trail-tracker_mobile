import type {
  BriefingRow,
  DayLogRow,
  ElevationProfile,
  NightLogRow,
  OutboxRow,
  PoiRow,
  SectionDetailRow,
  SectionRow,
  TrailRow,
  TripCounts,
  TripDownloadRow,
  TripPackage,
  TripStatusEntry,
  TripStore,
} from "./types";

// In-memory TripStore for the web preview build only — expo-sqlite has no
// static-web support. Semantics mirror native.ts so flows can be exercised
// in a browser; data does not survive a reload.

const trails = new Map<string, TrailRow>();
const sections = new Map<string, Partial<SectionDetailRow> & SectionRow>();
const nightLogs = new Map<string, NightLogRow[]>();
const dayLogs = new Map<string, DayLogRow[]>();
const briefings = new Map<string, BriefingRow[]>();
const pois = new Map<string, PoiRow[]>();
const elevations = new Map<string, ElevationProfile>();
const downloads = new Map<string, TripDownloadRow>();
const outbox: OutboxRow[] = [];
let outboxNextId = 1;

function countsFor(sectionId: string): TripCounts {
  return {
    nightLogs: nightLogs.get(sectionId)?.length ?? 0,
    dayLogs: dayLogs.get(sectionId)?.length ?? 0,
    briefings: briefings.get(sectionId)?.length ?? 0,
    pois: pois.get(sectionId)?.length ?? 0,
    elevationPoints: elevations.get(sectionId)?.points.length ?? 0,
  };
}

export const memoryStore: TripStore = {
  async init() {},

  async upsertSections(rows) {
    for (const row of rows) {
      sections.set(row.id, { ...sections.get(row.id), ...row });
    }
  },

  async listSections() {
    return [...sections.values()].sort(
      (a, b) => (a.startMile ?? Infinity) - (b.startMile ?? Infinity)
    );
  },

  async applyTripPackage(pkg, bytes) {
    const { section, trail } = pkg.data;
    if (trail) trails.set(trail.id, trail);
    sections.set(section.id, section);
    nightLogs.set(section.id, pkg.data.nightLogs);
    dayLogs.set(section.id, pkg.data.dayLogs);
    briefings.set(section.id, pkg.data.briefings);
    pois.set(section.id, pkg.data.pois);
    if (pkg.data.elevationProfile) {
      elevations.set(section.id, pkg.data.elevationProfile);
    } else {
      elevations.delete(section.id);
    }

    const live = countsFor(section.id);
    const mismatches = (Object.keys(pkg.counts) as (keyof TripCounts)[]).filter(
      (k) => live[k] !== pkg.counts[k]
    );
    const base: TripDownloadRow = {
      sectionId: section.id,
      downloadedAt: new Date().toISOString(),
      verified: mismatches.length === 0,
      packageVersion: pkg.version,
      checksum: pkg.checksum,
      bytes,
      counts: pkg.counts,
      error:
        mismatches.length > 0
          ? `Row count mismatch: ${mismatches.map((k) => `${k} ${live[k]}/${pkg.counts[k]}`).join(", ")}`
          : null,
    };
    downloads.set(section.id, base);
    if (base.error) throw new Error(base.error);
  },

  async listTripDownloads() {
    return [...downloads.values()].sort((a, b) =>
      b.downloadedAt.localeCompare(a.downloadedAt)
    );
  },

  async getTripStatus() {
    return (await this.listTripDownloads()).map(
      (d): TripStatusEntry => ({
        ...d,
        sectionName: sections.get(d.sectionId)?.name ?? d.sectionId,
        liveCounts: countsFor(d.sectionId),
      })
    );
  },

  async getOutboxCount() {
    return outbox.length;
  },

  async getSectionDetail(id) {
    const s = sections.get(id);
    if (!s) return null;
    return {
      notes: null,
      itinerary: null,
      details: null,
      plannedCamps: null,
      plannedCampMiles: null,
      plannedWaterStops: null,
      ...s,
    };
  },

  async listPois(sectionId) {
    return pois.get(sectionId) ?? [];
  },

  async listNightLogs(sectionId) {
    return [...(nightLogs.get(sectionId) ?? [])].sort((a, b) =>
      (a.date ?? "").localeCompare(b.date ?? "")
    );
  },

  async listDayLogs(sectionId) {
    return [...(dayLogs.get(sectionId) ?? [])].sort((a, b) =>
      (a.date ?? "").localeCompare(b.date ?? "")
    );
  },

  async upsertNightLog(n) {
    const list = nightLogs.get(n.sectionId) ?? [];
    const idx = list.findIndex((x) => x.id === n.id);
    if (idx >= 0) list[idx] = n;
    else list.push(n);
    nightLogs.set(n.sectionId, list);
  },

  async upsertDayLog(d) {
    const list = dayLogs.get(d.sectionId) ?? [];
    const idx = list.findIndex((x) => x.id === d.id);
    if (idx >= 0) list[idx] = d;
    else list.push(d);
    dayLogs.set(d.sectionId, list);
  },

  async setSectionStatus(id, status) {
    const s = sections.get(id);
    if (s) sections.set(id, { ...s, status, updatedAt: new Date().toISOString() });
  },

  async outboxEnqueue(entry) {
    if (outbox.some((e) => e.idempotencyKey === entry.idempotencyKey)) return;
    outbox.push({
      id: outboxNextId++,
      endpoint: entry.endpoint,
      method: entry.method,
      payload: entry.payload,
      idempotencyKey: entry.idempotencyKey,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
    });
  },

  async outboxPending(maxAttempts) {
    return outbox.filter((e) => e.attempts < maxAttempts);
  },

  async outboxDelete(id) {
    const idx = outbox.findIndex((e) => e.id === id);
    if (idx >= 0) outbox.splice(idx, 1);
  },

  async outboxRecordFailure(id, error) {
    const e = outbox.find((x) => x.id === id);
    if (e) {
      e.attempts += 1;
      e.lastError = error;
    }
  },
};
