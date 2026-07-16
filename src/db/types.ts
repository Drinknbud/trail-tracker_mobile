// Row and payload types shared by the SQLite (native) and in-memory (web
// preview) trip stores, mirroring the offline-package endpoint.

export type SectionRow = {
  id: string;
  trailId: string | null;
  name: string;
  status: string;
  startMile: number | null;
  endMile: number | null;
  startDate: string | null;
  endDate: string | null;
  miles: number;
  elevGain: number | null;
  difficulty: string | null;
  inJournal: boolean;
  updatedAt: string;
};

export type SectionDetailRow = SectionRow & {
  notes: string | null;
  itinerary: string | null;
  details: string | null;
  plannedCamps: string | null;
  plannedCampMiles: string | null;
  plannedWaterStops: string | null;
};

export type TrailRow = {
  id: string;
  catalogKey: string;
  displayName: string;
  shortName: string;
  totalMiles: number;
  hikeDirection: string;
};

export type NightLogRow = {
  id: string;
  sectionId: string;
  date: string | null;
  campedAt: string | null;
  campedWith: string | null;
  arrivedAt: string | null;
  leftAt: string | null;
  notes: string | null;
  updatedAt: string;
};

export type DayLogRow = {
  id: string;
  sectionId: string;
  date: string | null;
  milesHiked: number | null;
  startTime: string | null;
  endTime: string | null;
  terrainNotes: string | null;
  mood: number | null;
  updatedAt: string;
};

export type BriefingRow = {
  id: string;
  sectionId: string;
  date: string;
  dayIndex: number;
  narrative: string;
  weatherJson: string | null;
};

export type PoiRow = {
  type: string;
  name: string;
  mile: number;
  meta: Record<string, unknown>;
};

export type ElevationProfile = {
  points: { dist: number; elev: number }[];
  coords: [number, number][];
  mapCoords: [number, number][];
  avgElevM: number;
  /** Trail-wide elevation extremes (not this section's own min/max) — fixes
   * the chart's y-axis so sections are comparable across the whole trail. */
  trailMinElevFt: number | null;
  trailMaxElevFt: number | null;
};

export type TripCounts = {
  nightLogs: number;
  dayLogs: number;
  briefings: number;
  pois: number;
  elevationPoints: number;
};

export type TripPackage = {
  version: number;
  generatedAt: string;
  checksum: string;
  counts: TripCounts;
  data: {
    section: SectionDetailRow;
    trail: TrailRow | null;
    nightLogs: NightLogRow[];
    dayLogs: DayLogRow[];
    briefings: BriefingRow[];
    pois: PoiRow[];
    elevationProfile: ElevationProfile | null;
    sunrise: { midLat: number; midLon: number } | null;
  };
};

export type TripDownloadRow = {
  sectionId: string;
  downloadedAt: string;
  verified: boolean;
  packageVersion: number;
  checksum: string;
  bytes: number;
  counts: TripCounts;
  error: string | null;
};

export type TripStatusEntry = TripDownloadRow & {
  sectionName: string;
  liveCounts: TripCounts;
};

export type GpsSessionRow = {
  id: string; // client-generated sessionKey — the server idempotency key
  mode: string;
  sectionId: string | null;
  startedAt: string;
  endedAt: string | null;
  pointCount: number;
  synced: boolean;
};

export type GpsPointRow = {
  timestamp: number; // epoch ms
  lat: number;
  lon: number;
  alt: number | null;
};

export type PhotoQueueRow = {
  id: string;
  sectionId: string | null;
  uri: string;
  lat: number | null;
  lon: number | null;
  takenAt: string;
  uploaded: boolean;
  error: string | null;
};

export type TrailMailRow = {
  id: string;
  senderName: string | null;
  message: string;
  photoUrls: string; // JSON string[]
  isPublic: boolean;
  isRead: boolean;
  createdAt: string;
};

export type OutboxRow = {
  id: number;
  endpoint: string;
  method: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

export interface TripStore {
  init(): Promise<void>;
  upsertSections(rows: SectionRow[]): Promise<void>;
  listSections(): Promise<SectionRow[]>;
  /**
   * Insert a downloaded package transactionally, verify row counts against
   * pkg.counts, and record the download. Throws (and records the failure)
   * on any mismatch — no silent partial saves.
   */
  applyTripPackage(pkg: TripPackage, bytes: number): Promise<void>;
  listTripDownloads(): Promise<TripDownloadRow[]>;
  getTripStatus(): Promise<TripStatusEntry[]>;
  getOutboxCount(): Promise<number>;

  // Section detail + journal (all reads/writes are local-first)
  getSectionDetail(id: string): Promise<SectionDetailRow | null>;
  listPois(sectionId: string): Promise<PoiRow[]>;
  listNightLogs(sectionId: string): Promise<NightLogRow[]>;
  listDayLogs(sectionId: string): Promise<DayLogRow[]>;
  upsertNightLog(row: NightLogRow): Promise<void>;
  upsertDayLog(row: DayLogRow): Promise<void>;
  setSectionStatus(id: string, status: string): Promise<void>;

  // Briefing + elevation reads (M4, all offline)
  listBriefings(sectionId: string): Promise<BriefingRow[]>;
  getElevationProfile(
    sectionId: string
  ): Promise<(ElevationProfile & { midLat: number | null; midLon: number | null }) | null>;

  // GPS tracking (docs F8)
  gpsStartSession(entry: { id: string; mode: string; sectionId: string | null }): Promise<void>;
  gpsEndSession(id: string): Promise<void>;
  gpsActiveSession(): Promise<GpsSessionRow | null>;
  gpsAddPoints(sessionId: string, points: GpsPointRow[]): Promise<void>;
  gpsSessionPoints(sessionId: string): Promise<GpsPointRow[]>;
  gpsListSessions(limit: number): Promise<GpsSessionRow[]>;
  /** Most recent GPS point across all sessions — powers the elevation "you are here" dot. */
  gpsLatestPoint(): Promise<GpsPointRow | null>;
  gpsMarkSynced(id: string): Promise<void>;

  // Photo capture queue (F12)
  photoEnqueue(row: PhotoQueueRow): Promise<void>;
  photoList(): Promise<PhotoQueueRow[]>;
  photoPending(): Promise<PhotoQueueRow[]>;
  photoMarkUploaded(id: string): Promise<void>;
  photoMarkError(id: string, error: string): Promise<void>;

  // Trail mail cache (F14)
  upsertTrailMail(rows: TrailMailRow[]): Promise<void>;
  listTrailMail(): Promise<TrailMailRow[]>;
  markTrailMailRead(id: string): Promise<void>;

  // Outbox (docs §4.3)
  outboxEnqueue(entry: {
    endpoint: string;
    method: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<void>;
  outboxPending(maxAttempts: number): Promise<OutboxRow[]>;
  outboxDelete(id: number): Promise<void>;
  outboxRecordFailure(id: number, error: string): Promise<void>;
}
