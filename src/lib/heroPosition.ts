import type { ImageContentPositionObject } from "expo-image";

// heroImagePosition is stored as a CSS background-position string ("70% 30%")
// to match web exactly. Convert to/from expo-image's contentPosition object.
export function parseHeroPosition(pos: string): { x: number; y: number } {
  const [xRaw, yRaw] = pos.split(" ");
  const x = parseFloat(xRaw);
  const y = parseFloat(yRaw);
  return { x: Number.isFinite(x) ? x : 50, y: Number.isFinite(y) ? y : 50 };
}

export function heroContentPosition(pos: string): ImageContentPositionObject {
  const { x, y } = parseHeroPosition(pos);
  return { left: `${x}%`, top: `${y}%` };
}

export function formatHeroPosition(x: number, y: number): string {
  return `${Math.round(x)}% ${Math.round(y)}%`;
}
