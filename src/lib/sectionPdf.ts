import { Platform } from "react-native";

import type { ElevationProfile, PoiRow, SectionDetailRow } from "@/db";
import { computeAscentDescent } from "@/lib/elevation";

// Section PDF export — mobile port of web's SectionPrintView (window.print()
// off-screen DOM + @media print). Mobile has no window.print(), so this
// builds an HTML string and hands it to expo-print, which renders it in a
// headless WebView and returns a PDF file — then expo-sharing hands that
// file to the OS share sheet (Save to Files, AirDrop, email, etc).
//
// Runs entirely from data already downloaded for offline use (section,
// elevation profile, POIs) — unlike web's version, which re-fetches
// elevation/POIs from the network when the user clicks Print.
//
// Deliberately does NOT attempt to embed a map: web's print map is a
// server-rendered Leaflet snapshot; replicating that offline (tile fetch,
// canvas rasterization) is a separate, heavier piece of work. POIs are
// listed as a mile-ordered table instead, which is arguably more useful
// on a printed page than a static map thumbnail.

const POI_LABEL: Record<string, string> = {
  shelter: "Shelter",
  campsite: "Campsite",
  town: "Town",
  trailhead: "Trailhead",
  "road-crossing": "Road Crossing",
};

type SectionDetails = {
  summits?: string;
  water?: string;
  resupply?: string;
  naturalHighlights?: string;
  historical?: string;
  planAround?: string;
  gearRecommendations?: string;
  foodRecommendations?: string;
};

const DETAIL_LABELS: { key: keyof SectionDetails; label: string }[] = [
  { key: "summits", label: "Major Summits & Ridgelines" },
  { key: "water", label: "Notable Water Sources" },
  { key: "resupply", label: "Towns & Resupply" },
  { key: "naturalHighlights", label: "Natural Highlights" },
  { key: "historical", label: "Historical & Cultural" },
  { key: "planAround", label: "Things to Plan Around" },
  { key: "gearRecommendations", label: "Gear" },
  { key: "foodRecommendations", label: "Food Strategy" },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline **bold** / *italic* within an already-escaped line. */
function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/** Minimal markdown → HTML: tables, **bold**, *italic*, paragraphs, bullets. */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    // Table: a header row, a |---|---| separator, then data rows
    if (line.startsWith("|") && lines[i + 1]?.trim().match(/^\|[\s\-:|]+\|$/)) {
      const headerCells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      out.push(
        `<table class="md-table"><thead><tr>${headerCells
          .map((c) => `<th>${inline(escapeHtml(c))}</th>`)
          .join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(escapeHtml(c))}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`
      );
      continue;
    }

    // Bullet list
    if (line.startsWith("• ") || line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith("• ") || lines[i].trim().startsWith("- "))) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(escapeHtml(it))}</li>`).join("")}</ul>`);
      continue;
    }

    out.push(`<p>${inline(escapeHtml(line))}</p>`);
    i++;
  }
  return out.join("\n");
}

function buildElevationSvg(elevation: ElevationProfile, width = 640, height = 110): string {
  const { points, trailMinElevFt, trailMaxElevFt } = elevation;
  if (points.length < 2) return "";
  const elevs = points.map((p) => p.elev);
  const min = trailMinElevFt ?? Math.min(...elevs);
  const max = trailMaxElevFt ?? Math.max(...elevs);
  const range = max - min || 1;
  const maxDist = points[points.length - 1].dist || 1;
  const pad = 4;
  const coords = points
    .map((p) => {
      const x = pad + (p.dist / maxDist) * (width - pad * 2);
      const y = pad + (1 - (p.elev - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `M ${pad},${height - pad} L ${coords} L ${width - pad},${height - pad} Z`;
  return `
    <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <path d="${areaPath}" fill="#2D6A4F" opacity="0.15" />
      <polyline points="${coords}" fill="none" stroke="#2D6A4F" stroke-width="2" />
    </svg>`;
}

export function buildSectionPdfHtml(
  section: SectionDetailRow,
  elevation: ElevationProfile | null,
  pois: PoiRow[]
): string {
  const printDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dateRange = (() => {
    const fmt = (d: string) =>
      new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    if (section.startDate && section.endDate) return `${fmt(section.startDate)} – ${fmt(section.endDate)}`;
    if (section.startDate) return `From ${fmt(section.startDate)}`;
    if (section.endDate) return `To ${fmt(section.endDate)}`;
    return "";
  })();

  const details: SectionDetails = section.details ? (() => {
    try { return JSON.parse(section.details as string) as SectionDetails; } catch { return {}; }
  })() : {};
  const filledDetails = DETAIL_LABELS.filter(({ key }) => (details[key] ?? "").trim());

  const hasElevation = !!elevation && elevation.points.length > 1;
  const ascent = hasElevation ? Math.round(computeAscentDescent(elevation!.points).ascent) : null;

  const sortedPois = [...pois].sort((a, b) => a.mile - b.mile);

  const statsRow = [
    `<strong>${section.miles.toFixed(1)}</strong> mi`,
    dateRange,
    ascent != null ? `<strong>${ascent.toLocaleString()}</strong> ft gain` : null,
    section.difficulty,
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 32px; }
  .eyebrow { font-size: 9pt; color: #666; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .title { font-size: 20pt; font-weight: 700; line-height: 1.2; }
  .printed { font-size: 8pt; color: #888; text-align: right; }
  .stats { display: flex; gap: 24px; padding: 8px 12px; background: #f4f4f4; border-radius: 6px; margin: 14px 0; font-size: 9pt; color: #333; }
  .section-heading { font-size: 8pt; font-weight: 700; color: #2d6a4f; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid #2d6a4f; padding-bottom: 3px; margin: 18px 0 8px; }
  .eyebrow-small { font-size: 8pt; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
  p { font-size: 9pt; line-height: 1.6; margin: 4px 0; }
  ul { margin: 4px 0; padding-left: 18px; }
  li { font-size: 9pt; line-height: 1.5; }
  table.md-table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 8.5pt; }
  table.md-table th, table.md-table td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
  table.md-table th { background: #f4f4f4; }
  table.poi-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 6px; }
  table.poi-table th, table.poi-table td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
  table.poi-table th { background: #f4f4f4; }
  .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .details-grid .label { font-size: 8pt; font-weight: 600; color: #555; margin-bottom: 3px; }
  .details-grid p { font-size: 8.5pt; }
  .footer { margin-top: 28px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 7.5pt; color: #aaa; text-align: center; }
</style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <div class="eyebrow">Trail Tracker</div>
      <div class="title">${escapeHtml(section.name)}</div>
    </div>
    <div class="printed">Printed ${printDate}</div>
  </div>

  <div class="stats">${statsRow}</div>

  ${hasElevation ? `
  <div>
    <div class="eyebrow-small">Elevation Profile</div>
    ${buildElevationSvg(elevation!)}
  </div>` : ""}

  ${section.itinerary?.trim() ? `
  <div class="section-heading">Itinerary</div>
  ${markdownToHtml(section.itinerary)}` : ""}

  ${sortedPois.length > 0 ? `
  <div class="section-heading">Points of Interest</div>
  <table class="poi-table">
    <thead><tr><th>Mile</th><th>Type</th><th>Name</th></tr></thead>
    <tbody>
      ${sortedPois
        .map(
          (p) =>
            `<tr><td>${p.mile}</td><td>${escapeHtml(POI_LABEL[p.type] ?? p.type)}</td><td>${escapeHtml(p.name)}</td></tr>`
        )
        .join("\n")}
    </tbody>
  </table>` : ""}

  ${filledDetails.length > 0 ? `
  <div class="section-heading">Section Details</div>
  <div class="details-grid">
    ${filledDetails
      .map(
        ({ key, label }) =>
          `<div><div class="label">${escapeHtml(label)}</div>${markdownToHtml(details[key] ?? "")}</div>`
      )
      .join("\n")}
  </div>` : ""}

  <div class="footer">Generated by Trail Tracker · trailtracker.plus</div>
</body>
</html>`;
}

/** True on platforms where PDF export + native share actually work (not web preview). */
export function pdfExportAvailable(): boolean {
  return Platform.OS !== "web";
}

/**
 * Renders the HTML to a PDF and opens the OS share sheet. Native only —
 * callers should gate the entry point on pdfExportAvailable() and show a
 * "available on device" message on web instead of calling this.
 */
export async function exportSectionPdf(
  section: SectionDetailRow,
  elevation: ElevationProfile | null,
  pois: PoiRow[]
): Promise<void> {
  const html = buildSectionPdfHtml(section, elevation, pois);
  const Print = await import("expo-print");
  const Sharing = await import("expo-sharing");
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: section.name });
  }
}
