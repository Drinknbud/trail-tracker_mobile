import Svg, { G, Polygon } from "react-native-svg";

// Direction-of-travel compass needle — matches the web dashboard's inline
// SVG exactly (red = north, gray = south, rotated per hike direction).
const ROTATION: Record<string, number> = { NOBO: 0, SOBO: 180, EABO: 270, WABO: 90 };

export function CompassBadge({ direction, size = 18 }: { direction: string; size?: number }) {
  const rotation = ROTATION[direction] ?? 0;
  return (
    <Svg viewBox="0 0 14 14" width={size} height={size}>
      <G rotation={rotation} origin="7, 7">
        <Polygon points="7,1 10,7 7,5.5 4,7" fill="#ef4444" />
        <Polygon points="7,13 10,7 7,8.5 4,7" fill="#9ca3af" />
      </G>
    </Svg>
  );
}

export const DIRECTION_LABEL: Record<string, string> = {
  NOBO: "Northbound",
  SOBO: "Southbound",
  EABO: "Eastbound",
  WABO: "Westbound",
};
