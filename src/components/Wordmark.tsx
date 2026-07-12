import { Image } from "react-native";

import { useTheme } from "@/theme/ThemeContext";

const LOGO_LIGHT = require("../../assets/images/brand/logo-long-light.png");
const LOGO_DARK = require("../../assets/images/brand/logo-long-dark.png");

// Real "TRAIL TRACKER" wordmark (public/logo-long-*.svg on web, rasterized —
// the source SVGs are ~12,500-path illustrator exports, too heavy for
// react-native-svg). Matches web's header lockup pixel-for-pixel.
export function Wordmark({ height = 28 }: { height?: number }) {
  const { scheme } = useTheme();
  const source = scheme === "dark" ? LOGO_DARK : LOGO_LIGHT;
  // Source art is 1044×142
  const width = height * (1044 / 142);
  return <Image source={source} style={{ width, height }} resizeMode="contain" />;
}
