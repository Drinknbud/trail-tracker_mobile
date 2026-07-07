import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import type {
  SectionRow,
  TripCounts,
  TripDownloadRow,
  TripPackage,
  TripStatusEntry,
  TripStore,
} from "./types";

// v2 added gps_sessions/gps_points. All DDL is CREATE IF NOT EXISTS, so
// upgrades are a re-run of the full DDL.
const SCHEMA_VERSION = 2;

const DDL = `
CREATE TABLE IF NOT EXISTS trails (
  id TEXT PRIMARY KEY, catalog_key TEXT NOT NULL, display_name TEXT NOT NULL,
  short_name TEXT NOT NULL, total_miles REAL NOT NULL, hike_direction TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY, trail_id TEXT, name TEXT NOT NULL, status TEXT NOT NULL,
  start_mile REAL, end_mile REAL, start_date TEXT, end_date TEXT,
  miles REAL NOT NULL DEFAULT 0, elev_gain INTEGER, difficulty TEXT,
  notes TEXT, itinerary TEXT, details TEXT,
  planned_camps TEXT, planned_camp_miles TEXT, planned_water_stops TEXT,
  in_journal INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS night_logs (
  id TEXT PRIMARY KEY, section_id TEXT NOT NULL, date TEXT, camped_at TEXT,
  camped_with TEXT, arrived_at TEXT, left_at TEXT, notes TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_night_logs_section ON night_logs(section_id);
CREATE TABLE IF NOT EXISTS day_logs (
  id TEXT PRIMARY KEY, section_id TEXT NOT NULL, date TEXT, miles_hiked REAL,
  start_time TEXT, end_time TEXT, terrain_notes TEXT, mood INTEGER, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_day_logs_section ON day_logs(section_id);
CREATE TABLE IF NOT EXISTS briefings (
  id TEXT PRIMARY KEY, section_id TEXT NOT NULL, date TEXT NOT NULL,
  day_index INTEGER NOT NULL, narrative TEXT NOT NULL, weather_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_briefings_section ON briefings(section_id);
CREATE TABLE IF NOT EXISTS pois (
  id INTEGER PRIMARY KEY AUTOINCREMENT, section_id TEXT NOT NULL,
  type TEXT NOT NULL, name TEXT NOT NULL, mile REAL, meta_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_pois_section ON pois(section_id);
CREATE TABLE IF NOT EXISTS elevation_profiles (
  section_id TEXT PRIMARY KEY, point_count INTEGER NOT NULL,
  points_json TEXT NOT NULL, coords_json TEXT NOT NULL,
  map_coords_json TEXT NOT NULL, avg_elev_m REAL,
  mid_lat REAL, mid_lon REAL
);
CREATE TABLE IF NOT EXISTS trip_downloads (
  section_id TEXT PRIMARY KEY, downloaded_at TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0, package_version INTEGER NOT NULL,
  checksum TEXT NOT NULL, bytes INTEGER NOT NULL, counts_json TEXT NOT NULL,
  error TEXT
);
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT NOT NULL, method TEXT NOT NULL,
  payload_json TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT
);
CREATE TABLE IF NOT EXISTS gps_sessions (
  id TEXT PRIMARY KEY, mode TEXT NOT NULL, section_id TEXT,
  started_at TEXT NOT NULL, ended_at TEXT, synced INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS gps_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL,
  ts INTEGER NOT NULL, lat REAL NOT NULL, lon REAL NOT NULL, alt REAL
);
CREATE INDEX IF NOT EXISTS idx_gps_points_session ON gps_points(session_id);
`;

let db: SQLiteDatabase | null = null;

function getDb(): SQLiteDatabase {
  if (!db) throw new Error("Trip store not initialized");
  return db;
}

function countsFor(dbh: SQLiteDatabase, sectionId: string): TripCounts {
  const count = (sql: string) =>
    (dbh.getFirstSync<{ n: number }>(sql, sectionId)?.n ?? 0) as number;
  return {
    nightLogs: count("SELECT COUNT(*) AS n FROM night_logs WHERE section_id = ?"),
    dayLogs: count("SELECT COUNT(*) AS n FROM day_logs WHERE section_id = ?"),
    briefings: count("SELECT COUNT(*) AS n FROM briefings WHERE section_id = ?"),
    pois: count("SELECT COUNT(*) AS n FROM pois WHERE section_id = ?"),
    elevationPoints:
      (dbh.getFirstSync<{ n: number }>(
        "SELECT point_count AS n FROM elevation_profiles WHERE section_id = ?",
        sectionId
      )?.n ?? 0) as number,
  };
}

type SectionDbRow = {
  id: string;
  trail_id: string | null;
  name: string;
  status: string;
  start_mile: number | null;
  end_mile: number | null;
  start_date: string | null;
  end_date: string | null;
  miles: number;
  elev_gain: number | null;
  difficulty: string | null;
  in_journal: number;
  updated_at: string;
};

function toSectionRow(r: SectionDbRow): SectionRow {
  return {
    id: r.id,
    trailId: r.trail_id,
    name: r.name,
    status: r.status,
    startMile: r.start_mile,
    endMile: r.end_mile,
    startDate: r.start_date,
    endDate: r.end_date,
    miles: r.miles,
    elevGain: r.elev_gain,
    difficulty: r.difficulty,
    inJournal: r.in_journal === 1,
    updatedAt: r.updated_at,
  };
}

type TripDownloadDbRow = {
  section_id: string;
  downloaded_at: string;
  verified: number;
  package_version: number;
  checksum: string;
  bytes: number;
  counts_json: string;
  error: string | null;
};

function toDownloadRow(r: TripDownloadDbRow): TripDownloadRow {
  return {
    sectionId: r.section_id,
    downloadedAt: r.downloaded_at,
    verified: r.verified === 1,
    packageVersion: r.package_version,
    checksum: r.checksum,
    bytes: r.bytes,
    counts: JSON.parse(r.counts_json) as TripCounts,
    error: r.error,
  };
}

export const nativeStore: TripStore = {
  async init() {
    if (db) return;
    db = openDatabaseSync("trailtracker.db");
    db.execSync("PRAGMA journal_mode = WAL;");
    db.execSync(DDL);
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  },

  async upsertSections(rows) {
    const dbh = getDb();
    dbh.withTransactionSync(() => {
      for (const s of rows) {
        // Preserve detail columns (notes/itinerary/…) already saved by a
        // trip download — the list endpoint doesn't include them.
        dbh.runSync(
          `INSERT INTO sections (id, trail_id, name, status, start_mile, end_mile, start_date, end_date, miles, elev_gain, difficulty, in_journal, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             trail_id = excluded.trail_id, name = excluded.name, status = excluded.status,
             start_mile = excluded.start_mile, end_mile = excluded.end_mile,
             start_date = excluded.start_date, end_date = excluded.end_date,
             miles = excluded.miles, elev_gain = excluded.elev_gain,
             difficulty = excluded.difficulty, in_journal = excluded.in_journal,
             updated_at = excluded.updated_at`,
          s.id,
          s.trailId,
          s.name,
          s.status,
          s.startMile,
          s.endMile,
          s.startDate,
          s.endDate,
          s.miles,
          s.elevGain,
          s.difficulty,
          s.inJournal ? 1 : 0,
          s.updatedAt
        );
      }
    });
  },

  async listSections() {
    const rows = getDb().getAllSync<SectionDbRow>(
      "SELECT * FROM sections ORDER BY start_mile ASC, name ASC"
    );
    return rows.map(toSectionRow);
  },

  async applyTripPackage(pkg, bytes) {
    const dbh = getDb();
    const { section, trail, nightLogs, dayLogs, briefings, pois, elevationProfile, sunrise } =
      pkg.data;
    const now = new Date().toISOString();

    let verifyError: string | null = null;
    const runTransaction = () => dbh.withTransactionSync(() => {
      if (trail) {
        dbh.runSync(
          `INSERT OR REPLACE INTO trails (id, catalog_key, display_name, short_name, total_miles, hike_direction)
           VALUES (?, ?, ?, ?, ?, ?)`,
          trail.id,
          trail.catalogKey,
          trail.displayName,
          trail.shortName,
          trail.totalMiles,
          trail.hikeDirection
        );
      }
      dbh.runSync(
        `INSERT OR REPLACE INTO sections (id, trail_id, name, status, start_mile, end_mile, start_date, end_date, miles, elev_gain, difficulty, notes, itinerary, details, planned_camps, planned_camp_miles, planned_water_stops, in_journal, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        section.id,
        section.trailId,
        section.name,
        section.status,
        section.startMile,
        section.endMile,
        section.startDate,
        section.endDate,
        section.miles,
        section.elevGain,
        section.difficulty,
        section.notes,
        section.itinerary,
        section.details,
        section.plannedCamps,
        section.plannedCampMiles,
        section.plannedWaterStops,
        section.inJournal ? 1 : 0,
        section.updatedAt
      );

      dbh.runSync("DELETE FROM night_logs WHERE section_id = ?", section.id);
      for (const n of nightLogs) {
        dbh.runSync(
          `INSERT INTO night_logs (id, section_id, date, camped_at, camped_with, arrived_at, left_at, notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          n.id, n.sectionId, n.date, n.campedAt, n.campedWith, n.arrivedAt, n.leftAt, n.notes, n.updatedAt
        );
      }

      dbh.runSync("DELETE FROM day_logs WHERE section_id = ?", section.id);
      for (const d of dayLogs) {
        dbh.runSync(
          `INSERT INTO day_logs (id, section_id, date, miles_hiked, start_time, end_time, terrain_notes, mood, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          d.id, d.sectionId, d.date, d.milesHiked, d.startTime, d.endTime, d.terrainNotes, d.mood, d.updatedAt
        );
      }

      dbh.runSync("DELETE FROM briefings WHERE section_id = ?", section.id);
      for (const b of briefings) {
        dbh.runSync(
          `INSERT INTO briefings (id, section_id, date, day_index, narrative, weather_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
          b.id, b.sectionId, b.date, b.dayIndex, b.narrative, b.weatherJson
        );
      }

      dbh.runSync("DELETE FROM pois WHERE section_id = ?", section.id);
      for (const p of pois) {
        dbh.runSync(
          "INSERT INTO pois (section_id, type, name, mile, meta_json) VALUES (?, ?, ?, ?, ?)",
          section.id, p.type, p.name, p.mile, JSON.stringify(p.meta)
        );
      }

      dbh.runSync("DELETE FROM elevation_profiles WHERE section_id = ?", section.id);
      if (elevationProfile) {
        dbh.runSync(
          `INSERT INTO elevation_profiles (section_id, point_count, points_json, coords_json, map_coords_json, avg_elev_m, mid_lat, mid_lon)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          section.id,
          elevationProfile.points.length,
          JSON.stringify(elevationProfile.points),
          JSON.stringify(elevationProfile.coords),
          JSON.stringify(elevationProfile.mapCoords),
          elevationProfile.avgElevM,
          sunrise?.midLat ?? null,
          sunrise?.midLon ?? null
        );
      }

      // Verify inside the transaction; roll back on mismatch by throwing.
      const live = countsFor(dbh, section.id);
      const mismatches = (Object.keys(pkg.counts) as (keyof TripCounts)[]).filter(
        (k) => live[k] !== pkg.counts[k]
      );
      if (mismatches.length > 0) {
        verifyError = `Row count mismatch: ${mismatches
          .map((k) => `${k} ${live[k]}/${pkg.counts[k]}`)
          .join(", ")}`;
        throw new Error(verifyError);
      }

      dbh.runSync(
        `INSERT OR REPLACE INTO trip_downloads (section_id, downloaded_at, verified, package_version, checksum, bytes, counts_json, error)
         VALUES (?, ?, 1, ?, ?, ?, ?, NULL)`,
        section.id, now, pkg.version, pkg.checksum, bytes, JSON.stringify(pkg.counts)
      );
    });

    try {
      runTransaction();
    } catch (err) {
      // Transaction rolled back — record the failed attempt so Trip Status
      // shows the failure instead of a mysteriously missing download.
      dbh.runSync(
        `INSERT OR REPLACE INTO trip_downloads (section_id, downloaded_at, verified, package_version, checksum, bytes, counts_json, error)
         VALUES (?, ?, 0, ?, ?, ?, ?, ?)`,
        section.id,
        now,
        pkg.version,
        pkg.checksum,
        bytes,
        JSON.stringify(pkg.counts),
        verifyError ?? (err instanceof Error ? err.message : "Insert failed")
      );
      throw err;
    }
  },

  async listTripDownloads() {
    const rows = getDb().getAllSync<TripDownloadDbRow>(
      "SELECT * FROM trip_downloads ORDER BY downloaded_at DESC"
    );
    return rows.map(toDownloadRow);
  },

  async getTripStatus() {
    const dbh = getDb();
    const downloads = await this.listTripDownloads();
    return downloads.map((d): TripStatusEntry => {
      const name =
        dbh.getFirstSync<{ name: string }>(
          "SELECT name FROM sections WHERE id = ?",
          d.sectionId
        )?.name ?? d.sectionId;
      return { ...d, sectionName: name, liveCounts: countsFor(dbh, d.sectionId) };
    });
  },

  async getOutboxCount() {
    return (
      (getDb().getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox")?.n ?? 0) as number
    );
  },

  async getSectionDetail(id) {
    const r = getDb().getFirstSync<
      SectionDbRow & {
        notes: string | null;
        itinerary: string | null;
        details: string | null;
        planned_camps: string | null;
        planned_camp_miles: string | null;
        planned_water_stops: string | null;
      }
    >("SELECT * FROM sections WHERE id = ?", id);
    if (!r) return null;
    return {
      ...toSectionRow(r),
      notes: r.notes,
      itinerary: r.itinerary,
      details: r.details,
      plannedCamps: r.planned_camps,
      plannedCampMiles: r.planned_camp_miles,
      plannedWaterStops: r.planned_water_stops,
    };
  },

  async listPois(sectionId) {
    const rows = getDb().getAllSync<{
      type: string;
      name: string;
      mile: number | null;
      meta_json: string | null;
    }>("SELECT type, name, mile, meta_json FROM pois WHERE section_id = ? ORDER BY mile ASC", sectionId);
    return rows.map((r) => ({
      type: r.type,
      name: r.name,
      mile: r.mile ?? 0,
      meta: r.meta_json ? (JSON.parse(r.meta_json) as Record<string, unknown>) : {},
    }));
  },

  async listNightLogs(sectionId) {
    return getDb()
      .getAllSync<{
        id: string;
        section_id: string;
        date: string | null;
        camped_at: string | null;
        camped_with: string | null;
        arrived_at: string | null;
        left_at: string | null;
        notes: string | null;
        updated_at: string;
      }>("SELECT * FROM night_logs WHERE section_id = ? ORDER BY date ASC, updated_at ASC", sectionId)
      .map((r) => ({
        id: r.id,
        sectionId: r.section_id,
        date: r.date,
        campedAt: r.camped_at,
        campedWith: r.camped_with,
        arrivedAt: r.arrived_at,
        leftAt: r.left_at,
        notes: r.notes,
        updatedAt: r.updated_at,
      }));
  },

  async listDayLogs(sectionId) {
    return getDb()
      .getAllSync<{
        id: string;
        section_id: string;
        date: string | null;
        miles_hiked: number | null;
        start_time: string | null;
        end_time: string | null;
        terrain_notes: string | null;
        mood: number | null;
        updated_at: string;
      }>("SELECT * FROM day_logs WHERE section_id = ? ORDER BY date ASC, updated_at ASC", sectionId)
      .map((r) => ({
        id: r.id,
        sectionId: r.section_id,
        date: r.date,
        milesHiked: r.miles_hiked,
        startTime: r.start_time,
        endTime: r.end_time,
        terrainNotes: r.terrain_notes,
        mood: r.mood,
        updatedAt: r.updated_at,
      }));
  },

  async upsertNightLog(n) {
    getDb().runSync(
      `INSERT INTO night_logs (id, section_id, date, camped_at, camped_with, arrived_at, left_at, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         date = excluded.date, camped_at = excluded.camped_at, camped_with = excluded.camped_with,
         arrived_at = excluded.arrived_at, left_at = excluded.left_at, notes = excluded.notes,
         updated_at = excluded.updated_at`,
      n.id, n.sectionId, n.date, n.campedAt, n.campedWith, n.arrivedAt, n.leftAt, n.notes, n.updatedAt
    );
  },

  async upsertDayLog(d) {
    getDb().runSync(
      `INSERT INTO day_logs (id, section_id, date, miles_hiked, start_time, end_time, terrain_notes, mood, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         date = excluded.date, miles_hiked = excluded.miles_hiked, start_time = excluded.start_time,
         end_time = excluded.end_time, terrain_notes = excluded.terrain_notes, mood = excluded.mood,
         updated_at = excluded.updated_at`,
      d.id, d.sectionId, d.date, d.milesHiked, d.startTime, d.endTime, d.terrainNotes, d.mood, d.updatedAt
    );
  },

  async setSectionStatus(id, status) {
    getDb().runSync(
      "UPDATE sections SET status = ?, updated_at = ? WHERE id = ?",
      status, new Date().toISOString(), id
    );
  },

  async outboxEnqueue(entry) {
    getDb().runSync(
      `INSERT OR IGNORE INTO outbox (endpoint, method, payload_json, idempotency_key, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      entry.endpoint, entry.method, JSON.stringify(entry.payload), entry.idempotencyKey,
      new Date().toISOString()
    );
  },

  async outboxPending(maxAttempts) {
    return getDb()
      .getAllSync<{
        id: number;
        endpoint: string;
        method: string;
        payload_json: string;
        idempotency_key: string;
        created_at: string;
        attempts: number;
        last_error: string | null;
      }>("SELECT * FROM outbox WHERE attempts < ? ORDER BY id ASC", maxAttempts)
      .map((r) => ({
        id: r.id,
        endpoint: r.endpoint,
        method: r.method,
        payload: JSON.parse(r.payload_json) as Record<string, unknown>,
        idempotencyKey: r.idempotency_key,
        createdAt: r.created_at,
        attempts: r.attempts,
        lastError: r.last_error,
      }));
  },

  async outboxDelete(id) {
    getDb().runSync("DELETE FROM outbox WHERE id = ?", id);
  },

  async outboxRecordFailure(id, error) {
    getDb().runSync(
      "UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?",
      error, id
    );
  },

  async listBriefings(sectionId) {
    return getDb()
      .getAllSync<{
        id: string;
        section_id: string;
        date: string;
        day_index: number;
        narrative: string;
        weather_json: string | null;
      }>("SELECT * FROM briefings WHERE section_id = ? ORDER BY day_index ASC", sectionId)
      .map((r) => ({
        id: r.id,
        sectionId: r.section_id,
        date: r.date,
        dayIndex: r.day_index,
        narrative: r.narrative,
        weatherJson: r.weather_json,
      }));
  },

  async getElevationProfile(sectionId) {
    const r = getDb().getFirstSync<{
      points_json: string;
      coords_json: string;
      map_coords_json: string;
      avg_elev_m: number | null;
      mid_lat: number | null;
      mid_lon: number | null;
    }>("SELECT * FROM elevation_profiles WHERE section_id = ?", sectionId);
    if (!r) return null;
    return {
      points: JSON.parse(r.points_json),
      coords: JSON.parse(r.coords_json),
      mapCoords: JSON.parse(r.map_coords_json),
      avgElevM: r.avg_elev_m ?? 0,
      midLat: r.mid_lat,
      midLon: r.mid_lon,
    };
  },

  async gpsStartSession(entry) {
    getDb().runSync(
      "INSERT INTO gps_sessions (id, mode, section_id, started_at) VALUES (?, ?, ?, ?)",
      entry.id, entry.mode, entry.sectionId, new Date().toISOString()
    );
  },

  async gpsEndSession(id) {
    getDb().runSync(
      "UPDATE gps_sessions SET ended_at = ? WHERE id = ?",
      new Date().toISOString(), id
    );
  },

  async gpsActiveSession() {
    const r = getDb().getFirstSync<{
      id: string;
      mode: string;
      section_id: string | null;
      started_at: string;
      ended_at: string | null;
      synced: number;
    }>("SELECT * FROM gps_sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1");
    if (!r) return null;
    return {
      id: r.id,
      mode: r.mode,
      sectionId: r.section_id,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      pointCount: (getDb().getFirstSync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM gps_points WHERE session_id = ?", r.id
      )?.n ?? 0) as number,
      synced: r.synced === 1,
    };
  },

  async gpsAddPoints(sessionId, points) {
    const dbh = getDb();
    dbh.withTransactionSync(() => {
      for (const p of points) {
        dbh.runSync(
          "INSERT INTO gps_points (session_id, ts, lat, lon, alt) VALUES (?, ?, ?, ?, ?)",
          sessionId, p.timestamp, p.lat, p.lon, p.alt
        );
      }
      dbh.runSync("UPDATE gps_sessions SET synced = 0 WHERE id = ?", sessionId);
    });
  },

  async gpsSessionPoints(sessionId) {
    return getDb()
      .getAllSync<{ ts: number; lat: number; lon: number; alt: number | null }>(
        "SELECT ts, lat, lon, alt FROM gps_points WHERE session_id = ? ORDER BY ts ASC",
        sessionId
      )
      .map((r) => ({ timestamp: r.ts, lat: r.lat, lon: r.lon, alt: r.alt }));
  },

  async gpsListSessions(limit) {
    return getDb()
      .getAllSync<{
        id: string;
        mode: string;
        section_id: string | null;
        started_at: string;
        ended_at: string | null;
        synced: number;
      }>("SELECT * FROM gps_sessions ORDER BY started_at DESC LIMIT ?", limit)
      .map((r) => ({
        id: r.id,
        mode: r.mode,
        sectionId: r.section_id,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        pointCount: (getDb().getFirstSync<{ n: number }>(
          "SELECT COUNT(*) AS n FROM gps_points WHERE session_id = ?", r.id
        )?.n ?? 0) as number,
        synced: r.synced === 1,
      }));
  },

  async gpsMarkSynced(id) {
    getDb().runSync("UPDATE gps_sessions SET synced = 1 WHERE id = ?", id);
  },
};
