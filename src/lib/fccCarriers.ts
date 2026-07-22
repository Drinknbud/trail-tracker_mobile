// Verbatim port of web's lib/fccCarriers.ts — carrier → network(s) mapping
// used to pick which coverage file(s) to fetch/check for the FCC dead-zone
// layer. src/lib/carriers.ts already has the mobile Settings picker's display
// labels; this is the separate lookup web keeps for coverage-file resolution.

export const CARRIER_DISPLAY_NAMES: Record<string, string> = {
  verizon: "Verizon",
  att: "AT&T",
  tmobile: "T-Mobile",
  uscc: "US Cellular",
  visible: "Visible",
  usmobile_vzw: "US Mobile (Verizon)",
  xfinity: "Xfinity Mobile",
  spectrum: "Spectrum Mobile",
  mint: "Mint Mobile",
  googlefi: "Google Fi Wireless",
  metro: "Metro by T-Mobile",
  usmobile_tmo: "US Mobile (T-Mobile)",
  cricket: "Cricket Wireless",
  straighttalk: "Straight Talk",
  consumercellular: "Consumer Cellular",
  other: "Other",
};

/**
 * Maps a carrier key to the underlying network(s) used for coverage lookups.
 * MVNOs that run on a single network return one entry. Consumer Cellular
 * returns both ["tmobile", "att"] — covered = on either network.
 */
export const CARRIER_NETWORKS: Record<string, string[]> = {
  verizon: ["verizon"],
  att: ["att"],
  tmobile: ["tmobile"],
  uscc: ["uscc"],
  visible: ["verizon"],
  usmobile_vzw: ["verizon"],
  xfinity: ["verizon"],
  spectrum: ["verizon"],
  mint: ["tmobile"],
  googlefi: ["tmobile"],
  metro: ["tmobile"],
  usmobile_tmo: ["tmobile"],
  cricket: ["att"],
  straighttalk: ["att"],
  consumercellular: ["tmobile", "att"],
};

export function carrierDisplayName(carrier: string): string {
  return CARRIER_DISPLAY_NAMES[carrier] ?? carrier;
}

/** Returns the Tier 1 network keys for a given carrier (for coverage file lookups). */
export function carrierNetworks(carrier: string): string[] {
  return CARRIER_NETWORKS[carrier] ?? [];
}
