import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { View } from "react-native";

import { AT_BOUNDS, AT_TRAIL, MAP_STYLE_URL, SHELTER_COLLECTION } from "@/lib/map-data";
import { useTheme } from "@/theme/ThemeContext";

// Web preview variant — mirrors TrailMapNative using maplibre-gl JS with the
// same style URL and data, so trail/POI rendering can be checked in a browser.
export function TrailMap() {
  const { colors } = useTheme();
  const containerRef = useRef<View>(null);

  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE_URL,
      bounds: AT_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
    });
    // Debug handle for browser-preview inspection (web preview only)
    (window as unknown as { __trailMap?: maplibregl.Map }).__trailMap = map;
    map.on("error", (e) => console.error("[TrailMap] map error:", e.error?.message ?? e));

    // Add layers as soon as the style is ready. The `load` event waits for a
    // first fully-rendered frame (deferred indefinitely in throttled tabs) and
    // the last `styledata` can fire before isStyleLoaded() flips true, so poll.
    let disposed = false;
    const addLayers = () => {
      if (disposed || map.getLayer("at-trail-line")) return;
      if (!map.isStyleLoaded()) {
        setTimeout(addLayers, 250);
        return;
      }
      map.addSource("at-trail", { type: "geojson", data: AT_TRAIL as GeoJSON.GeoJSON });
      map.addLayer({
        id: "at-trail-line",
        type: "line",
        source: "at-trail",
        paint: { "line-color": colors.accent, "line-width": 3 },
      });
      map.addSource("at-shelters", {
        type: "geojson",
        data: SHELTER_COLLECTION as GeoJSON.GeoJSON,
      });
      map.addLayer({
        id: "at-shelter-dots",
        type: "circle",
        source: "at-shelters",
        minzoom: 8,
        paint: {
          "circle-color": colors.trailBrown,
          "circle-radius": 5,
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": 1.5,
        },
      });
    };
    addLayers();

    return () => {
      disposed = true;
      map.remove();
    };
    // Recreating the map on theme change is fine for a preview surface.
  }, [colors.accent, colors.trailBrown]);

  return <View ref={containerRef} style={{ flex: 1 }} />;
}
