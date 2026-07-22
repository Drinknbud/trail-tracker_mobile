// Ported verbatim from the web app's lib/units.ts (source of truth) so mobile
// formats distance/elevation/temperature/weight/date/time identically. Pure
// functions — the current unit prefs are supplied by the useUnits() context.

export type DistanceUnit = "mi" | "km";
export type TempUnit = "F" | "C";
export type WeightUnit = "lbs" | "kg";
export type DateFormat = "MDY" | "DMY" | "YMD";
export type TimeFormat = "12h" | "24h";

export function miToKm(mi: number) { return mi * 1.60934; }
export function ftToM(ft: number) { return ft * 0.3048; }
export function fToC(f: number) { return (f - 32) * 5 / 9; }

/** Format a miles value for display, e.g. "12.3 mi" or "19.8 km" */
export function fmtMiles(mi: number, unit: DistanceUnit): string {
  if (unit === "km") return `${miToKm(mi).toFixed(1)} km`;
  return `${parseFloat(mi.toFixed(2))} mi`;
}

/** Format an elevation value for display, e.g. "3,200 ft" or "975 m" */
export function fmtElev(ft: number, unit: DistanceUnit): string {
  if (unit === "km") return `${Math.round(ftToM(ft)).toLocaleString()} m`;
  return `${ft.toLocaleString()} ft`;
}

/** Format a single temperature for display, e.g. "72°F" or "22°C" */
export function fmtTemp(f: number, unit: TempUnit): string {
  if (unit === "C") return `${Math.round(fToC(f))}°C`;
  return `${Math.round(f)}°F`;
}

/** Format a min–max temperature range, e.g. "55–72°F" or "13–22°C" */
export function fmtTempRange(min: number, max: number, unit: TempUnit): string {
  if (unit === "C") return `${Math.round(fToC(min))}–${Math.round(fToC(max))}°C`;
  return `${Math.round(min)}–${Math.round(max)}°F`;
}

/** Format a trail mile marker label, e.g. "273.1 mi" or "439.6 km" */
export function fmtMileMarker(mi: number, unit: DistanceUnit): string {
  if (unit === "km") return `${miToKm(mi).toFixed(1)} km`;
  return `${parseFloat(mi.toFixed(2))} mi`;
}

/** Convert pounds to kilograms */
export function lbsToKg(lbs: number) { return lbs * 0.453592; }

/** Format a weight value for display, e.g. "16 lbs" or "7.3 kg" */
export function fmtWeight(lbs: number, unit: WeightUnit): string {
  if (unit === "kg") return `${lbsToKg(lbs).toFixed(1)} kg`;
  return `${lbs} lbs`;
}

/**
 * Format a date string (ISO "YYYY-MM-DD" or datetime) for display.
 * MDY → 07/04/2026  |  DMY → 04/07/2026  |  YMD → 2026-07-04
 */
export function fmtDate(dateStr: string, format: DateFormat): string {
  if (!dateStr) return "";
  // Normalise to local noon so no timezone shift flips the day
  const normalized = dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return dateStr;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  if (format === "DMY") return `${dd}/${mm}/${yyyy}`;
  if (format === "YMD") return `${yyyy}-${mm}-${dd}`;
  return `${mm}/${dd}/${yyyy}`; // MDY default
}

/**
 * Format a time string (stored as "H:MM AM/PM") for display.
 * 12h → "7:30 AM"  |  24h → "07:30"
 */
export function fmtTime(timeStr: string, format: TimeFormat): string {
  if (!timeStr) return timeStr;
  if (format === "12h") return timeStr; // already stored in 12h format
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return timeStr;
  let h = parseInt(m[1]);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

export const UNIT_DEFAULTS = {
  distanceUnit: "mi" as DistanceUnit,
  tempUnit: "F" as TempUnit,
  weightUnit: "lbs" as WeightUnit,
  dateFormat: "MDY" as DateFormat,
  timeFormat: "12h" as TimeFormat,
};

/** Narrow a raw string pref to a known union value, falling back to the default. */
export function coerceDistanceUnit(v: string | null | undefined): DistanceUnit {
  return v === "km" ? "km" : "mi";
}
export function coerceTempUnit(v: string | null | undefined): TempUnit {
  return v === "C" ? "C" : "F";
}
export function coerceWeightUnit(v: string | null | undefined): WeightUnit {
  return v === "kg" ? "kg" : "lbs";
}
export function coerceDateFormat(v: string | null | undefined): DateFormat {
  return v === "DMY" || v === "YMD" ? v : "MDY";
}
export function coerceTimeFormat(v: string | null | undefined): TimeFormat {
  return v === "24h" ? "24h" : "12h";
}
