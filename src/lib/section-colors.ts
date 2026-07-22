/**
 * Shared color palette for planned trail sections — ported verbatim from the
 * web app's lib/section-colors.ts so the mobile map matches web pixel-for-pixel.
 * Completed sections are always green (#22C55E / trail-completed).
 * Each planned section is assigned a color from this palette based on its
 * sorted position by startMile (ascending, nulls last), so the log page
 * and the trail map always render the same color for the same section.
 */
export const PLANNED_COLORS = [
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // fuchsia
  "#06B6D4", // cyan
  "#F97316", // orange
  "#14B8A6", // teal
  "#6366F1", // indigo
] as const;

export const COMPLETED_COLOR = "#22C55E";

/** Sort planned sections the same way both log and map do (startMile asc, nulls last). */
function sortedPlanned<T extends { id: string; startMile: number | null }>(
  sections: T[]
): T[] {
  return [...sections].sort((a, b) => {
    if (a.startMile === null && b.startMile === null) return 0;
    if (a.startMile === null) return 1;
    if (b.startMile === null) return -1;
    return a.startMile - b.startMile;
  });
}

/**
 * Returns the hex color for a planned section.
 * @param sectionId  The section whose color you want.
 * @param allPlanned All planned sections (will be sorted internally).
 */
export function getPlannedSectionColor(
  sectionId: string,
  allPlanned: { id: string; startMile: number | null }[]
): string {
  const sorted = sortedPlanned(allPlanned);
  const index = sorted.findIndex((s) => s.id === sectionId);
  return PLANNED_COLORS[index >= 0 ? index % PLANNED_COLORS.length : 0];
}

/**
 * Returns the hex color for any section (planned or completed).
 */
export function getSectionColor(
  section: { id: string; status: string; startMile: number | null },
  allPlanned: { id: string; startMile: number | null }[]
): string {
  if (section.status === "completed") return COMPLETED_COLOR;
  return getPlannedSectionColor(section.id, allPlanned);
}
