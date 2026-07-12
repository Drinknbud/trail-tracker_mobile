import { Image, type ImageStyle } from "react-native";

// Trail crest badges (public/trail-logos/*.svg on web — hand-illustrated,
// too complex for react-native-svg). Only AT is bundled for now since
// that's the primary trail; add more catalogKeys here as they're needed.
const BADGES: Record<string, ReturnType<typeof require>> = {
  at: require("../../assets/images/brand/at-badge.png"),
};

export function TrailBadge({
  catalogKey,
  size = 28,
  style,
}: {
  catalogKey: string | null | undefined;
  size?: number;
  style?: ImageStyle;
}) {
  const source = catalogKey ? BADGES[catalogKey] : undefined;
  if (!source) return null;
  return (
    <Image
      source={source}
      style={{ width: size, height: size * (386 / 400), ...style }}
      resizeMode="contain"
    />
  );
}
