// Ported from the web app's lib/badges.ts (BADGE_DEFS + SYSTEM_CHALLENGES) so
// the mobile Accomplishments screen earns/unlocks badges identically to web.
// Kept in sync manually — no shared package between the two repos yet.

export type DistanceUnit = "mi" | "km";
export type BadgeTier = "bronze" | "silver" | "gold" | "special";
export type BadgeCategory = "distance" | "elevation" | "pace" | "community" | "gear" | "sections" | "regions" | "trails";

export interface BadgeDef {
  id: string;
  category: BadgeCategory;
  tier: BadgeTier;
  name: string;
  emoji: string;
  /** If set, only display when the user's active trail matches this catalog key. */
  trailKey?: string;
  description: (unit: DistanceUnit) => string;
  earned: (stats: BadgeStats) => boolean;
  progress: (stats: BadgeStats, unit: DistanceUnit) => string;
}

export interface BadgeStats {
  milesCompleted: number;
  elevGainTotal: number;
  sectionsCompleted: number;
  photoCount: number;
  communityContributions: number; // POIs + condition reports
  beatClockCount: number;
  packWeightLogged: boolean;
  minPackWeight: number | null; // lbs
  percentComplete: number;
  trailCompleted: boolean;
  // Trail-specific & multi-trail
  trailCatalogKey?: string;
  atRegionCoverage?: Record<string, number>; // region slug → 0-100 %
  trailsStarted?: number;  // distinct trail catalog keys with ≥1 section
  trailsCompleted?: number; // distinct trails marked completed
  hasTripleCrown?: boolean; // AT + PCT + CDT all completed
}

// ─── AT Region Boundaries ─────────────────────────────────────────────────────

export const AT_REGIONS = [
  { slug: "ga",    name: "Georgia",           emoji: "🍑", startMile: 0,      endMile: 78.4,   totalMiles: 78.4,  tier: "bronze" as BadgeTier },
  { slug: "nc_tn", name: "NC & Tennessee",    emoji: "🌄", startMile: 78.4,   endMile: 469.4,  totalMiles: 391.0, tier: "gold"   as BadgeTier },
  { slug: "va",    name: "Virginia",          emoji: "🏔️", startMile: 469.4,  endMile: 1023.7, totalMiles: 554.3, tier: "special" as BadgeTier },
  { slug: "wv_md", name: "WV & Maryland",     emoji: "🦅", startMile: 1023.7, endMile: 1068,   totalMiles: 44.3,  tier: "bronze" as BadgeTier },
  { slug: "pa",    name: "Pennsylvania",      emoji: "🪨", startMile: 1068,   endMile: 1295,   totalMiles: 227.0, tier: "silver" as BadgeTier },
  { slug: "nj_ny", name: "NJ & New York",     emoji: "🗽", startMile: 1295,   endMile: 1455,   totalMiles: 160.0, tier: "silver" as BadgeTier },
  { slug: "ct_ma", name: "CT & Massachusetts",emoji: "🍂", startMile: 1455,   endMile: 1622,   totalMiles: 167.0, tier: "silver" as BadgeTier },
  { slug: "vt",    name: "Vermont",           emoji: "🍁", startMile: 1622,   endMile: 1744,   totalMiles: 122.0, tier: "silver" as BadgeTier },
  { slug: "nh",    name: "New Hampshire",     emoji: "🏔️", startMile: 1744,   endMile: 1986,   totalMiles: 242.0, tier: "gold"   as BadgeTier },
  { slug: "me",    name: "Maine",             emoji: "🫐", startMile: 1986,   endMile: 2198,   totalMiles: 212.0, tier: "gold"   as BadgeTier },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function miToKm(mi: number) { return mi * 1.60934; }
function ftToM(ft: number) { return ft * 0.3048; }

function distLabel(mi: number, km: number, unit: DistanceUnit) {
  return unit === "km" ? `${km} km` : `${mi} mi`;
}

function miProgress(miles: number, thresholdMi: number, thresholdKm: number, unit: DistanceUnit) {
  if (unit === "km") {
    const current = miToKm(miles).toFixed(0);
    return miles >= thresholdMi ? `${miToKm(miles).toFixed(0)} km` : `${current} / ${thresholdKm} km`;
  }
  return miles >= thresholdMi ? `${miles.toFixed(1)} mi` : `${miles.toFixed(1)} / ${thresholdMi} mi`;
}

function elevLabel(ft: number, unit: DistanceUnit) {
  return unit === "km" ? `${Math.round(ftToM(ft)).toLocaleString()} m` : `${ft.toLocaleString()} ft`;
}

// ─── Badge Definitions ────────────────────────────────────────────────────────

export const BADGE_DEFS: BadgeDef[] = [

  // ── Distance ────────────────────────────────────────────────────────────────
  {
    id: "dist_bronze",
    category: "distance",
    tier: "bronze",
    emoji: "🥾",
    name: "Trail Walker",
    description: (u) => `Complete ${distLabel(50, 80, u)}`,
    earned: (s) => s.milesCompleted >= 50,
    progress: (s, u) => miProgress(s.milesCompleted, 50, 80, u),
  },
  {
    id: "dist_silver",
    category: "distance",
    tier: "silver",
    emoji: "⚡",
    name: "Century Hiker",
    description: (u) => `Complete ${distLabel(100, 160, u)}`,
    earned: (s) => s.milesCompleted >= 100,
    progress: (s, u) => miProgress(s.milesCompleted, 100, 160, u),
  },
  {
    id: "dist_gold",
    category: "distance",
    tier: "gold",
    emoji: "🌟",
    name: "500 Mile Club",
    description: (u) => `Complete ${distLabel(500, 800, u)}`,
    earned: (s) => s.milesCompleted >= 500,
    progress: (s, u) => miProgress(s.milesCompleted, 500, 800, u),
  },
  {
    id: "dist_special",
    category: "distance",
    tier: "special",
    emoji: "🏆",
    name: "1,000 Miles",
    description: (u) => `Complete ${distLabel(1000, 1600, u)}`,
    earned: (s) => s.milesCompleted >= 1000,
    progress: (s, u) => miProgress(s.milesCompleted, 1000, 1600, u),
  },
  {
    id: "dist_thru",
    category: "distance",
    tier: "special",
    emoji: "🏅",
    name: "Trail Completionist",
    description: () => "Complete 100% of your trail",
    earned: (s) => s.trailCompleted || s.percentComplete >= 100,
    progress: (s) => s.trailCompleted ? "Trail complete!" : `${s.percentComplete.toFixed(1)}% / 100%`,
  },

  // ── Trail milestones (% based) ───────────────────────────────────────────────
  {
    id: "pct_quarter",
    category: "distance",
    tier: "bronze",
    emoji: "🗺️",
    name: "Quarter Trail",
    description: () => "Complete 25% of your trail",
    earned: (s) => s.percentComplete >= 25,
    progress: (s) => `${s.percentComplete.toFixed(1)}% / 25%`,
  },
  {
    id: "pct_half",
    category: "distance",
    tier: "silver",
    emoji: "🌄",
    name: "Halfway There",
    description: () => "Complete 50% of your trail",
    earned: (s) => s.percentComplete >= 50,
    progress: (s) => `${s.percentComplete.toFixed(1)}% / 50%`,
  },
  {
    id: "pct_three_quarters",
    category: "distance",
    tier: "gold",
    emoji: "🔥",
    name: "Almost There",
    description: () => "Complete 75% of your trail",
    earned: (s) => s.percentComplete >= 75,
    progress: (s) => `${s.percentComplete.toFixed(1)}% / 75%`,
  },

  // ── Elevation ───────────────────────────────────────────────────────────────
  {
    id: "elev_bronze",
    category: "elevation",
    tier: "bronze",
    emoji: "⛰️",
    name: "Elevation Seeker",
    description: (u) => `Accumulate ${elevLabel(10000, u)} of gain`,
    earned: (s) => s.elevGainTotal >= 10000,
    progress: (s, u) => {
      const cur = elevLabel(s.elevGainTotal, u);
      return s.elevGainTotal >= 10000 ? cur : `${cur} / ${elevLabel(10000, u)}`;
    },
  },
  {
    id: "elev_silver",
    category: "elevation",
    tier: "silver",
    emoji: "🏔️",
    name: "Peak Bagger",
    description: (u) => `Accumulate ${elevLabel(50000, u)} of gain`,
    earned: (s) => s.elevGainTotal >= 50000,
    progress: (s, u) => {
      const cur = elevLabel(s.elevGainTotal, u);
      return s.elevGainTotal >= 50000 ? cur : `${cur} / ${elevLabel(50000, u)}`;
    },
  },
  {
    id: "elev_gold",
    category: "elevation",
    tier: "gold",
    emoji: "🌋",
    name: "Sky Walker",
    description: (u) => `Accumulate ${elevLabel(100000, u)} of gain`,
    earned: (s) => s.elevGainTotal >= 100000,
    progress: (s, u) => {
      const cur = elevLabel(s.elevGainTotal, u);
      return s.elevGainTotal >= 100000 ? cur : `${cur} / ${elevLabel(100000, u)}`;
    },
  },

  // ── Sections ─────────────────────────────────────────────────────────────────
  {
    id: "sections_bronze",
    category: "sections",
    tier: "bronze",
    emoji: "🗂️",
    name: "First Step",
    description: () => "Complete your first section",
    earned: (s) => s.sectionsCompleted >= 1,
    progress: (s) => `${s.sectionsCompleted} / 1 section`,
  },
  {
    id: "sections_silver",
    category: "sections",
    tier: "silver",
    emoji: "📋",
    name: "Section Veteran",
    description: () => "Complete 5 sections",
    earned: (s) => s.sectionsCompleted >= 5,
    progress: (s) => `${s.sectionsCompleted} / 5 sections`,
  },
  {
    id: "sections_gold",
    category: "sections",
    tier: "gold",
    emoji: "📚",
    name: "Section Master",
    description: () => "Complete 20 sections",
    earned: (s) => s.sectionsCompleted >= 20,
    progress: (s) => `${s.sectionsCompleted} / 20 sections`,
  },

  // ── Pace / Beat the Clock ────────────────────────────────────────────────────
  {
    id: "pace_bronze",
    category: "pace",
    tier: "bronze",
    emoji: "⏱️",
    name: "Fast Feet",
    description: () => "Beat your estimated time on 3 sections",
    earned: (s) => s.beatClockCount >= 3,
    progress: (s) => `${s.beatClockCount} / 3 sections`,
  },
  {
    id: "pace_silver",
    category: "pace",
    tier: "silver",
    emoji: "🚀",
    name: "Speed Hiker",
    description: () => "Beat your estimated time on 10 sections",
    earned: (s) => s.beatClockCount >= 10,
    progress: (s) => `${s.beatClockCount} / 10 sections`,
  },
  {
    id: "pace_gold",
    category: "pace",
    tier: "gold",
    emoji: "⚡",
    name: "Trail Runner",
    description: () => "Beat your estimated time on 25 sections",
    earned: (s) => s.beatClockCount >= 25,
    progress: (s) => `${s.beatClockCount} / 25 sections`,
  },

  // ── Community — Photos ────────────────────────────────────────────────────────
  {
    id: "photo_bronze",
    category: "community",
    tier: "bronze",
    emoji: "📷",
    name: "Trail Photographer",
    description: () => "Upload 10 photos",
    earned: (s) => s.photoCount >= 10,
    progress: (s) => `${s.photoCount} / 10 photos`,
  },
  {
    id: "photo_silver",
    category: "community",
    tier: "silver",
    emoji: "📸",
    name: "Chronicler",
    description: () => "Upload 50 photos",
    earned: (s) => s.photoCount >= 50,
    progress: (s) => `${s.photoCount} / 50 photos`,
  },
  {
    id: "photo_gold",
    category: "community",
    tier: "gold",
    emoji: "🎞️",
    name: "Documentarian",
    description: () => "Upload 100 photos",
    earned: (s) => s.photoCount >= 100,
    progress: (s) => `${s.photoCount} / 100 photos`,
  },

  // ── Community — POIs & Condition Reports ────────────────────────────────────
  {
    id: "contrib_bronze",
    category: "community",
    tier: "bronze",
    emoji: "🔍",
    name: "Trail Scout",
    description: () => "Submit 1 POI or condition report",
    earned: (s) => s.communityContributions >= 1,
    progress: (s) => `${s.communityContributions} / 1 contribution`,
  },
  {
    id: "contrib_silver",
    category: "community",
    tier: "silver",
    emoji: "🗺️",
    name: "Trailblazer",
    description: () => "Submit 5 POIs or condition reports",
    earned: (s) => s.communityContributions >= 5,
    progress: (s) => `${s.communityContributions} / 5 contributions`,
  },
  {
    id: "contrib_gold",
    category: "community",
    tier: "gold",
    emoji: "🛡️",
    name: "Trail Guardian",
    description: () => "Submit 20 POIs or condition reports",
    earned: (s) => s.communityContributions >= 20,
    progress: (s) => `${s.communityContributions} / 20 contributions`,
  },

  // ── Gear — Pack Weight ────────────────────────────────────────────────────────
  {
    id: "gear_bronze",
    category: "gear",
    tier: "bronze",
    emoji: "🎒",
    name: "Trail Ready",
    description: () => "Log your pack weight on a section",
    earned: (s) => s.packWeightLogged,
    progress: (s) => s.packWeightLogged ? "Pack weight logged" : "Log pack weight on any section",
  },
  {
    id: "gear_silver",
    category: "gear",
    tier: "silver",
    emoji: "🪶",
    name: "Light Packer",
    description: (u) => `Achieve a base weight under ${u === "km" ? "9 kg" : "20 lbs"}`,
    earned: (s) => s.minPackWeight !== null && s.minPackWeight < 20,
    progress: (s, u) => {
      if (!s.packWeightLogged) return "Log pack weight first";
      const display = u === "km"
        ? `${((s.minPackWeight ?? 0) * 0.453592).toFixed(1)} kg`
        : `${(s.minPackWeight ?? 0).toFixed(1)} lbs`;
      return s.minPackWeight !== null && s.minPackWeight < 20
        ? `Best: ${display}`
        : `Best: ${display} / ${u === "km" ? "9 kg" : "20 lbs"}`;
    },
  },
  {
    id: "gear_gold",
    category: "gear",
    tier: "gold",
    emoji: "🏋️",
    name: "Ultralight",
    description: (u) => `Achieve a base weight under ${u === "km" ? "4.5 kg" : "10 lbs"}`,
    earned: (s) => s.minPackWeight !== null && s.minPackWeight < 10,
    progress: (s, u) => {
      if (!s.packWeightLogged) return "Log pack weight first";
      const display = u === "km"
        ? `${((s.minPackWeight ?? 0) * 0.453592).toFixed(1)} kg`
        : `${(s.minPackWeight ?? 0).toFixed(1)} lbs`;
      return s.minPackWeight !== null && s.minPackWeight < 10
        ? `Best: ${display}`
        : `Best: ${display} / ${u === "km" ? "4.5 kg" : "10 lbs"}`;
    },
  },

  // ── AT Regional Sections ──────────────────────────────────────────────────────
  ...AT_REGIONS.map((r) => ({
    id: `at_region_${r.slug}`,
    category: "regions" as BadgeCategory,
    tier: r.tier,
    emoji: r.emoji,
    name: r.name,
    trailKey: "at",
    description: (u: DistanceUnit) => {
      const mi = Math.round(r.totalMiles);
      const km = Math.round(r.totalMiles * 1.60934);
      return `Complete ${r.name}'s AT section (~${u === "km" ? `${km} km` : `${mi} mi`})`;
    },
    earned: (s: BadgeStats) => (s.atRegionCoverage?.[r.slug] ?? 0) >= 90,
    progress: (s: BadgeStats) => {
      const pct = s.atRegionCoverage?.[r.slug] ?? 0;
      return pct >= 90 ? `Complete! (${pct.toFixed(1)}%)` : `${pct.toFixed(1)}% covered`;
    },
  })),

  // ── Multi-Trail ───────────────────────────────────────────────────────────────
  {
    id: "trail_explorer",
    category: "trails",
    tier: "bronze",
    emoji: "🗺️",
    name: "Trail Explorer",
    description: () => "Start hiking a second long trail",
    earned: (s) => (s.trailsStarted ?? 0) >= 2,
    progress: (s) => `${s.trailsStarted ?? 0} / 2 trails started`,
  },
  {
    id: "trail_multi_complete",
    category: "trails",
    tier: "silver",
    emoji: "🥈",
    name: "Multi-Trail Finisher",
    description: () => "Complete 2 different trails",
    earned: (s) => (s.trailsCompleted ?? 0) >= 2,
    progress: (s) => `${s.trailsCompleted ?? 0} / 2 trails completed`,
  },
  {
    id: "trail_collector",
    category: "trails",
    tier: "gold",
    emoji: "📍",
    name: "Trail Collector",
    description: () => "Start hiking 3 or more different trails",
    earned: (s) => (s.trailsStarted ?? 0) >= 3,
    progress: (s) => `${s.trailsStarted ?? 0} / 3 trails started`,
  },
  {
    id: "trail_triple_crown",
    category: "trails",
    tier: "special",
    emoji: "👑",
    name: "Triple Crown",
    description: () => "Complete the AT, PCT, and CDT",
    earned: (s) => s.hasTripleCrown ?? false,
    progress: (s) => s.hasTripleCrown ? "Triple Crown complete!" : `Complete all three Triple Crown trails`,
  },
];

export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  distance:  "Distance",
  elevation: "Elevation",
  pace:      "Pace",
  community: "Community",
  gear:      "Gear",
  sections:  "Sections",
  regions:   "AT Regions",
  trails:    "Multi-Trail",
};

export const CATEGORY_EMOJIS: Record<BadgeCategory, string> = {
  distance:  "🗺️",
  elevation: "⛰️",
  pace:      "⏱️",
  community: "🤝",
  gear:      "🎒",
  sections:  "📋",
  regions:   "📍",
  trails:    "🏅",
};

// ─── System Challenge Definitions ─────────────────────────────────────────────

export type ChallengeReset = "weekly" | "monthly" | "yearly" | "once";

export interface SystemChallenge {
  key: (now: Date) => string;      // unique key for this period
  title: (now: Date) => string;
  description: (unit: DistanceUnit) => string;
  reset: ChallengeReset;
  emoji: string;
  check: (stats: SystemChallengeStats, now: Date) => boolean;
  progressLabel: (stats: SystemChallengeStats, unit: DistanceUnit) => string;
}

export interface SystemChallengeStats {
  milesThisWeek: number;
  dayLogsThisWeek: number;
  milesThisMonth: number;
  sectionsThisMonth: number;
  dayLogsThisMonth: number;
  milesThisYear: number;
  sectionsThisYear: number;
  daysOnTrailThisYear: number;
}

function fmtMilesLocal(mi: number, unit: DistanceUnit): string {
  return unit === "km" ? `${miToKm(mi).toFixed(1)} km` : `${parseFloat(mi.toFixed(2))} mi`;
}

function isoWeek(d: Date) {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const diff = d.getTime() - jan4.getTime();
  return `${d.getFullYear()}-W${String(Math.ceil((diff / 86400000 + jan4.getDay() + 1) / 7)).padStart(2, "0")}`;
}
function isoMonth(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function isoYear(d: Date) { return `${d.getFullYear()}`; }

export const SYSTEM_CHALLENGES: SystemChallenge[] = [
  // Weekly
  {
    key: (d) => `weekly_miler_${isoWeek(d)}`,
    title: (d) => `Weekly Miler — ${isoWeek(d)}`,
    description: () => "Log any miles this week",
    reset: "weekly",
    emoji: "📅",
    check: (s) => s.milesThisWeek > 0,
    progressLabel: (s, unit) => `${fmtMilesLocal(s.milesThisWeek, unit)} logged`,
  },
  {
    key: (d) => `weekly_logger_${isoWeek(d)}`,
    title: (d) => `Trail Journal — ${isoWeek(d)}`,
    description: () => "Log a day entry this week",
    reset: "weekly",
    emoji: "📓",
    check: (s) => s.dayLogsThisWeek >= 1,
    progressLabel: (s) => `${s.dayLogsThisWeek} day log${s.dayLogsThisWeek !== 1 ? "s" : ""} this week`,
  },
  // Monthly
  {
    key: (d) => `monthly_50mi_${isoMonth(d)}`,
    title: (d) => `Monthly Explorer — ${new Date(d.getFullYear(), d.getMonth()).toLocaleString("default", { month: "long", year: "numeric" })}`,
    description: (u) => u === "km" ? "Hike 80 km this month" : "Hike 50 miles this month",
    reset: "monthly",
    emoji: "🌙",
    check: (s) => s.milesThisMonth >= 50,
    progressLabel: (s, unit) => `${fmtMilesLocal(s.milesThisMonth, unit)} / ${fmtMilesLocal(50, unit)}`,
  },
  {
    key: (d) => `monthly_section_${isoMonth(d)}`,
    title: (d) => `Section of the Month — ${new Date(d.getFullYear(), d.getMonth()).toLocaleString("default", { month: "long", year: "numeric" })}`,
    description: () => "Complete a section this month",
    reset: "monthly",
    emoji: "🏕️",
    check: (s) => s.sectionsThisMonth >= 1,
    progressLabel: (s) => `${s.sectionsThisMonth} section${s.sectionsThisMonth !== 1 ? "s" : ""} completed`,
  },
  {
    key: (d) => `monthly_3logs_${isoMonth(d)}`,
    title: (d) => `Active Month — ${new Date(d.getFullYear(), d.getMonth()).toLocaleString("default", { month: "long", year: "numeric" })}`,
    description: () => "Log 3 day entries this month",
    reset: "monthly",
    emoji: "✍️",
    check: (s) => s.dayLogsThisMonth >= 3,
    progressLabel: (s) => `${s.dayLogsThisMonth} / 3 day logs`,
  },
  // Yearly
  {
    key: (d) => `yearly_century_${isoYear(d)}`,
    title: (d) => `${d.getFullYear()} Century`,
    description: (u) => u === "km" ? "Hike 150 km in a calendar year" : "Hike 100 miles in a calendar year",
    reset: "yearly",
    emoji: "🗓️",
    check: (s) => s.milesThisYear >= 100,
    progressLabel: (s, unit) => `${fmtMilesLocal(s.milesThisYear, unit)} / ${fmtMilesLocal(100, unit)}`,
  },
  {
    key: (d) => `yearly_5sections_${isoYear(d)}`,
    title: (d) => `${d.getFullYear()} Section Crusher`,
    description: () => "Complete 5 sections in a calendar year",
    reset: "yearly",
    emoji: "💪",
    check: (s) => s.sectionsThisYear >= 5,
    progressLabel: (s) => `${s.sectionsThisYear} / 5 sections`,
  },
  {
    key: (d) => `yearly_30days_${isoYear(d)}`,
    title: (d) => `${d.getFullYear()} Days on Trail`,
    description: () => "Spend 30 days on trail in a calendar year",
    reset: "yearly",
    emoji: "🏔️",
    check: (s) => s.daysOnTrailThisYear >= 30,
    progressLabel: (s) => `${s.daysOnTrailThisYear} / 30 days`,
  },
];
