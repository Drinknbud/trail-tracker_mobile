import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";

import type {
  SectionRow,
  TripCounts,
  TripDownloadRow,
  TripPackage,
  TripStatusEntry,
  TripStore,
} from "./types";

const SCHEMA_VERSION = 1;

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
};
