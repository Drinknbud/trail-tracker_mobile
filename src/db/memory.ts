import type {
  BriefingRow,
  DayLogRow,
  ElevationProfile,
  GpsPointRow,
  GpsSessionRow,
  NightLogRow,
  OutboxRow,
  PhotoQueueRow,
  PoiRow,
  SectionDetailRow,
  SectionRow,
  TrailRow,
  TripCounts,
  TripDownloadRow,
  TrailMailRow,
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
const gpsSessions = new Map<string, Omit<GpsSessionRow, "pointCount">>();
const gpsPoints = new Map<string, GpsPointRow[]>();
const photos = new Map<string, PhotoQueueRow>();
const mail = new Map<string, TrailMailRow>();

// Sunrise midpoints live on elevation_profiles in SQLite; the memory store
// keeps them alongside the profile.
const elevationMids = new Map<string, { midLat: number | null; midLon: number | null }>();

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
      elevationMids.set(section.id, {
        midLat: pkg.data.sunrise?.midLat ?? null,
        midLon: pkg.data.sunrise?.midLon ?? null,
      });
    } else {
      elevations.delete(section.id);
      elevationMids.delete(section.id);
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

  async deleteTripDownload(sectionId) {
    nightLogs.delete(sectionId);
    dayLogs.delete(sectionId);
    briefings.delete(sectionId);
    pois.delete(sectionId);
    elevations.delete(sectionId);
    elevationMids.delete(sectionId);
    downloads.delete(sectionId);
  },

  async deleteSection(sectionId) {
    nightLogs.delete(sectionId);
    dayLogs.delete(sectionId);
    briefings.delete(sectionId);
    pois.delete(sectionId);
    elevations.delete(sectionId);
    elevationMids.delete(sectionId);
    downloads.delete(sectionId);
    sections.delete(sectionId);
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

  async setSectionInJournal(id, inJournal) {
    const s = sections.get(id);
    if (s) sections.set(id, { ...s, inJournal, updatedAt: new Date().toISOString() });
  },

  async updateSectionAi(id, fields) {
    const s = sections.get(id);
    if (!s) return;
    sections.set(id, {
      ...s,
      ...(fields.details !== undefined ? { details: fields.details } : {}),
      ...(fields.itinerary !== undefined ? { itinerary: fields.itinerary } : {}),
      ...(fields.plannedCamps !== undefined ? { plannedCamps: fields.plannedCamps } : {}),
      ...(fields.plannedCampMiles !== undefined ? { plannedCampMiles: fields.plannedCampMiles } : {}),
      updatedAt: new Date().toISOString(),
    });
  },

  async updateSectionFields(id, fields) {
    const s = sections.get(id);
    const updatedAt = new Date().toISOString();
    if (s) {
      sections.set(id, {
        ...s,
        ...(fields.name !== undefined ? { name: fields.name } : {}),
        ...(fields.status !== undefined ? { status: fields.status } : {}),
        ...(fields.startMile !== undefined ? { startMile: fields.startMile } : {}),
        ...(fields.endMile !== undefined ? { endMile: fields.endMile } : {}),
        ...(fields.startDate !== undefined ? { startDate: fields.startDate } : {}),
        ...(fields.endDate !== undefined ? { endDate: fields.endDate } : {}),
        ...(fields.miles !== undefined ? { miles: fields.miles } : {}),
        ...(fields.difficulty !== undefined ? { difficulty: fields.difficulty } : {}),
        ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
        updatedAt,
      });
    }
    return updatedAt;
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

  async listBriefings(sectionId) {
    return [...(briefings.get(sectionId) ?? [])].sort((a, b) => a.dayIndex - b.dayIndex);
  },

  async getElevationProfile(sectionId) {
    const profile = elevations.get(sectionId);
    if (!profile) return null;
    const mid = elevationMids.get(sectionId);
    return { ...profile, midLat: mid?.midLat ?? null, midLon: mid?.midLon ?? null };
  },

  async gpsStartSession(entry) {
    gpsSessions.set(entry.id, {
      id: entry.id,
      mode: entry.mode,
      sectionId: entry.sectionId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      synced: false,
    });
    gpsPoints.set(entry.id, []);
  },

  async gpsEndSession(id) {
    const s = gpsSessions.get(id);
    if (s) gpsSessions.set(id, { ...s, endedAt: new Date().toISOString() });
  },

  async gpsActiveSession() {
    const active = [...gpsSessions.values()]
      .filter((s) => !s.endedAt)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (!active) return null;
    return { ...active, pointCount: gpsPoints.get(active.id)?.length ?? 0 };
  },

  async gpsAddPoints(sessionId, points) {
    const list = gpsPoints.get(sessionId) ?? [];
    list.push(...points);
    gpsPoints.set(sessionId, list);
    const s = gpsSessions.get(sessionId);
    if (s) gpsSessions.set(sessionId, { ...s, synced: false });
  },

  async gpsSessionPoints(sessionId) {
    return [...(gpsPoints.get(sessionId) ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  },

  async gpsListSessions(limit) {
    return [...gpsSessions.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit)
      .map((s) => ({ ...s, pointCount: gpsPoints.get(s.id)?.length ?? 0 }));
  },

  async gpsLatestPoint() {
    let latest: GpsPointRow | null = null;
    for (const list of gpsPoints.values()) {
      for (const p of list) {
        if (!latest || p.timestamp > latest.timestamp) latest = p;
      }
    }
    return latest;
  },

  async gpsMarkSynced(id) {
    const s = gpsSessions.get(id);
    if (s) gpsSessions.set(id, { ...s, synced: true });
  },

  async photoEnqueue(p) {
    photos.set(p.id, p);
  },

  async photoList() {
    return [...photos.values()].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  },

  async photoPending() {
    return (await this.photoList()).filter((p) => !p.uploaded);
  },

  async photoMarkUploaded(id) {
    const p = photos.get(id);
    if (p) photos.set(id, { ...p, uploaded: true, error: null });
  },

  async photoMarkError(id, error) {
    const p = photos.get(id);
    if (p) photos.set(id, { ...p, error });
  },

  async upsertTrailMail(rows) {
    for (const m of rows) {
      const existing = mail.get(m.id);
      mail.set(m.id, { ...m, isRead: m.isRead || (existing?.isRead ?? false) });
    }
  },

  async listTrailMail() {
    return [...mail.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async markTrailMailRead(id) {
    const m = mail.get(id);
    if (m) mail.set(id, { ...m, isRead: true });
  },
};

// Dev-only preview hook: the web memory store is never bundled into the native
// app (native uses src/db/native.ts), so exposing it here lets browser-preview
// verification seed rows (e.g. a GPS point to test the elevation "you are
// here" dot) without shipping anything to devices. Guarded by __DEV__ so it's
// stripped from any release build.
if (__DEV__ && typeof globalThis !== "undefined") {
  (globalThis as unknown as { __tripStore?: TripStore }).__tripStore = memoryStore;
}
