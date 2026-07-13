// Mirrors lib/trail-catalog.ts on web — only the fields the Settings > Trails
// browse/add UI needs (no map/POI-specific fields).
export type TrailDirection = "NOBO" | "SOBO" | "EABO" | "WABO";

export type CatalogEntry = {
  key: string;
  name: string;
  shortName: string;
  totalMiles: number;
  states: string[];
  directions: TrailDirection[];
  hidden?: boolean;
};

export const TRAIL_CATALOG: CatalogEntry[] = [
  { key: "at", name: "Appalachian Trail", shortName: "AT", totalMiles: 2198, states: ["GA", "NC", "TN", "VA", "WV", "MD", "PA", "NJ", "NY", "CT", "MA", "VT", "NH", "ME"], directions: ["NOBO", "SOBO"] },
  { key: "pct", name: "Pacific Crest Trail", shortName: "PCT", totalMiles: 2653, states: ["CA", "OR", "WA"], directions: ["NOBO", "SOBO"] },
  { key: "cdt", name: "Continental Divide Trail", shortName: "CDT", totalMiles: 3100, states: ["NM", "CO", "WY", "ID", "MT"], directions: ["NOBO", "SOBO"] },
  { key: "lt", name: "Long Trail", shortName: "LT", totalMiles: 272, states: ["VT"], directions: ["NOBO", "SOBO"] },
  { key: "jmt", name: "John Muir Trail", shortName: "JMT", totalMiles: 211, states: ["CA"], directions: ["NOBO", "SOBO"] },
  { key: "azt", name: "Arizona Trail", shortName: "AZT", totalMiles: 800, states: ["AZ"], directions: ["NOBO", "SOBO"] },
  { key: "ct", name: "Colorado Trail", shortName: "CT", totalMiles: 486, states: ["CO"], directions: ["NOBO", "SOBO"], hidden: true },
  { key: "longpath", name: "Long Path", shortName: "LP", totalMiles: 357, states: ["NY", "NJ"], directions: ["NOBO", "SOBO"] },
  { key: "ft", name: "Florida Trail", shortName: "FT", totalMiles: 1500, states: ["FL"], directions: ["NOBO", "SOBO"] },
  { key: "sht", name: "Superior Hiking Trail", shortName: "SHT", totalMiles: 310, states: ["MN"], directions: ["NOBO", "SOBO"] },
  { key: "oct", name: "Oregon Coast Trail", shortName: "OCT", totalMiles: 382, states: ["OR"], directions: ["NOBO", "SOBO"] },
  { key: "sheltowee", name: "Sheltowee Trace", shortName: "ST", totalMiles: 339, states: ["KY", "TN"], directions: ["NOBO", "SOBO"] },
  { key: "allegheny", name: "Allegheny Trail", shortName: "ATR", totalMiles: 330, states: ["WV", "PA"], directions: ["NOBO", "SOBO"], hidden: true },
  { key: "bartram", name: "Bartram Trail", shortName: "BT", totalMiles: 115, states: ["GA", "NC"], directions: ["NOBO", "SOBO"], hidden: true },
  { key: "bmt", name: "Benton MacKaye Trail", shortName: "BMT", totalMiles: 300, states: ["GA", "TN", "NC"], directions: ["NOBO", "SOBO"] },
  { key: "net", name: "New England Trail", shortName: "NET", totalMiles: 215, states: ["CT", "MA"], directions: ["NOBO", "SOBO"], hidden: true },
  { key: "ouachita", name: "Ouachita Trail", shortName: "OT", totalMiles: 223, states: ["AR", "OK"], directions: ["EABO", "WABO"] },
  { key: "iat", name: "Ice Age Trail", shortName: "IAT", totalMiles: 1200, states: ["WI"], directions: ["EABO", "WABO"], hidden: true },
  { key: "flt", name: "Finger Lakes Trail", shortName: "FLT", totalMiles: 950, states: ["NY"], directions: ["EABO", "WABO"], hidden: true },
  { key: "oht", name: "Ozark Highlands Trail", shortName: "OHT", totalMiles: 223, states: ["AR"], directions: ["EABO", "WABO"], hidden: true },
  { key: "lsht", name: "Lone Star Hiking Trail", shortName: "LSHT", totalMiles: 128, states: ["TX"], directions: ["EABO", "WABO"] },
  { key: "mst", name: "Mountains-to-Sea Trail", shortName: "MST", totalMiles: 1175, states: ["NC"], directions: ["EABO", "WABO"], hidden: true },
  { key: "foothills", name: "Foothills Trail", shortName: "FHT", totalMiles: 76, states: ["SC", "NC"], directions: ["EABO", "WABO"], hidden: true },
  { key: "trt", name: "Tahoe Rim Trail", shortName: "TRT", totalMiles: 165, states: ["CA", "NV"], directions: ["NOBO", "SOBO", "EABO", "WABO"] },
];

export const VISIBLE_TRAILS = TRAIL_CATALOG.filter((t) => !t.hidden);

export function directionsFor(catalogKey: string): { value: TrailDirection; label: string }[] {
  const entry = TRAIL_CATALOG.find((c) => c.key === catalogKey);
  const dirs = entry?.directions ?? (["NOBO", "SOBO"] as TrailDirection[]);
  const labels: Record<TrailDirection, string> = {
    NOBO: "↑ Northbound",
    SOBO: "↓ Southbound",
    EABO: "→ Eastbound",
    WABO: "← Westbound",
  };
  return dirs.map((d) => ({ value: d, label: labels[d] }));
}
