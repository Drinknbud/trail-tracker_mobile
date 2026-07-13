import type { PickerOption } from "@/components/PickerModal";

// Mirrors the <optgroup> list in app/settings/page.tsx exactly.
export const CARRIER_OPTIONS: PickerOption[] = [
  { header: "Tier 1 Networks" },
  { value: "verizon", label: "Verizon" },
  { value: "att", label: "AT&T" },
  { value: "tmobile", label: "T-Mobile" },
  { value: "uscc", label: "US Cellular" },
  { header: "Verizon Network" },
  { value: "visible", label: "Visible" },
  { value: "usmobile_vzw", label: "US Mobile (Verizon)" },
  { value: "xfinity", label: "Xfinity Mobile" },
  { value: "spectrum", label: "Spectrum Mobile" },
  { header: "T-Mobile Network" },
  { value: "mint", label: "Mint Mobile" },
  { value: "googlefi", label: "Google Fi Wireless" },
  { value: "metro", label: "Metro by T-Mobile" },
  { value: "usmobile_tmo", label: "US Mobile (T-Mobile)" },
  { header: "AT&T Network" },
  { value: "cricket", label: "Cricket Wireless" },
  { value: "straighttalk", label: "Straight Talk" },
  { header: "Multi-Network" },
  { value: "consumercellular", label: "Consumer Cellular (T-Mobile + AT&T)" },
  { header: "Other" },
  { value: "other", label: "Other" },
];

export function carrierLabel(value: string | null): string {
  if (!value) return "Not specified";
  const found = CARRIER_OPTIONS.find((o) => "value" in o && o.value === value);
  return found && "label" in found ? found.label : value;
}

export const ACCENT_PRESETS = [
  { hex: "#2D6A4F", label: "Trail Green" },
  { hex: "#52796F", label: "Sage" },
  { hex: "#1A472A", label: "Pine" },
  { hex: "#2563EB", label: "Sky" },
  { hex: "#475569", label: "Slate" },
  { hex: "#B45309", label: "Rust" },
  { hex: "#0F4C5C", label: "Spruce" },
  { hex: "#57534E", label: "Stone" },
];
