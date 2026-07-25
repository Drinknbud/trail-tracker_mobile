import { Asset } from "expo-asset";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { MapScaleLegend } from "@/components/MapScaleLegend";
import { PoiDetailSheet, type PoiSelection } from "@/components/PoiDetailSheet";
import {
  CAMPSITE_COLLECTION,
  PARKING_COLLECTION,
  POI_MINZOOM,
  PRIVY_COLLECTION,
  SHELTER_COLLECTION,
  TILE_CONFIGS,
  WATER_COLLECTION,
  buildSectionLineCollection,
  filterPoiCollectionByMileRange,
  tileRasterPaint,
  type PoiProperties,
} from "@/lib/map-data";
import { useTheme } from "@/theme/ThemeContext";
import type { SectionOnlyMapProps } from "@/components/SectionMapNative";

const POI_IMAGE_MODULES: Record<string, number> = {
  "poi-shelter": require("../../assets/images/poi/poi-shelter.png"),
  "poi-campsite": require("../../assets/images/poi/poi-campsite.png"),
  "poi-parking": require("../../assets/images/poi/poi-parking.png"),
  "poi-water": require("../../assets/images/poi/poi-water.png"),
  "poi-privy": require("../../assets/images/poi/poi-privy.png"),
};

const POI_SOURCES: { id: string; icon: string; minzoom: number }[] = [
  { id: "section-only-parking", icon: "poi-parking", minzoom: POI_MINZOOM.parking },
  { id: "section-only-privies", icon: "poi-privy", minzoom: POI_MINZOOM.privy },
  { id: "section-only-water", icon: "poi-water", minzoom: POI_MINZOOM.water },
  { id: "section-only-campsites", icon: "poi-campsite", minzoom: POI_MINZOOM.campsite },
  { id: "section-only-shelters", icon: "poi-shelter", minzoom: POI_MINZOOM.shelter },
];

/**
 * Web-preview counterpart to SectionMapNative — same minimal scope (this
 * section's own trail line + its own nearby POIs, nothing else), rendered
 * with maplibre-gl JS instead of maplibre-react-native. Unlike TrailMap.web
 * (the main Map tab), this component's props never change during one mounted
 * instance's lifetime — the mini preview and full modal are each their own
 * mount — so there's no need for the ref/resync-without-remount machinery
 * that file uses to survive long-lived prop changes.
 */
export function SectionMap({
  section,
  mapStyle,
  bounds,
  interactive = true,
  showPois = true,
}: SectionOnlyMapProps) {
  const { scheme } = useTheme();
  const containerRef = useRef<View>(null);
  const [selectedPoi, setSelectedPoi] = useState<PoiSelection | null>(null);
  const [viewState, setViewState] = useState({ zoom: 12, latitude: (bounds[1] + bounds[3]) / 2 });

  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      style: { version: 8, sources: {}, layers: [] },
      bounds,
      fitBoundsOptions: { padding: 24 },
      attributionControl: { compact: true },
    });

    if (!interactive) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      map.doubleClickZoom.disable();
      map.dragRotate.disable();
      map.touchZoomRotate.disable();
      map.touchPitch.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
    }

    map.on("error", (e) => console.error("[SectionMap] map error:", e.error?.message ?? e));
    map.on("move", () => setViewState({ zoom: map.getZoom(), latitude: map.getCenter().lat }));

    let disposed = false;

    const loadIcon = async (name: string) => {
      try {
        const asset = Asset.fromModule(POI_IMAGE_MODULES[name]);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        const { data } = await map.loadImage(uri);
        if (data && !map.hasImage(name)) map.addImage(name, data);
      } catch (err) {
        console.error(`[SectionMap] failed to load icon "${name}":`, err);
      }
    };

    const addLayers = async () => {
      if (disposed || map.getLayer("section-only-fill")) return;
      if (!map.isStyleLoaded()) {
        setTimeout(addLayers, 250);
        return;
      }

      const tileConfig = TILE_CONFIGS[mapStyle];
      map.addSource("section-base-tiles", { type: "raster", tiles: [tileConfig.urlTemplate], tileSize: 256, attribution: tileConfig.attribution });
      map.addLayer({ id: "section-base-tiles-layer", type: "raster", source: "section-base-tiles", paint: tileRasterPaint(scheme, mapStyle) });

      map.addSource("section-only-line", { type: "geojson", data: buildSectionLineCollection([section]) as GeoJSON.GeoJSON });
      map.addLayer({ id: "section-only-casing", type: "line", source: "section-only-line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FFFFFF", "line-width": 8, "line-opacity": 0.72 } });
      map.addLayer({ id: "section-only-fill", type: "line", source: "section-only-line", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 4.5, "line-opacity": 0.95 } });

      const lo = section.startMile ?? 0;
      const hi = section.endMile ?? 0;
      const dataFor: Record<string, GeoJSON.GeoJSON> = {
        "section-only-parking": filterPoiCollectionByMileRange(PARKING_COLLECTION, lo, hi) as GeoJSON.GeoJSON,
        "section-only-privies": filterPoiCollectionByMileRange(PRIVY_COLLECTION, lo, hi) as GeoJSON.GeoJSON,
        "section-only-water": filterPoiCollectionByMileRange(WATER_COLLECTION, lo, hi) as GeoJSON.GeoJSON,
        "section-only-campsites": filterPoiCollectionByMileRange(CAMPSITE_COLLECTION, lo, hi) as GeoJSON.GeoJSON,
        "section-only-shelters": filterPoiCollectionByMileRange(SHELTER_COLLECTION, lo, hi) as GeoJSON.GeoJSON,
      };

      for (const src of POI_SOURCES) {
        await loadIcon(src.icon);
        map.addSource(src.id, { type: "geojson", data: dataFor[src.id] });
        const layerId = `${src.id}-icons`;
        map.addLayer({
          id: layerId,
          type: "symbol",
          source: src.id,
          minzoom: src.minzoom,
          layout: { "icon-image": src.icon, "icon-size": 0.41, "icon-allow-overlap": true, visibility: showPois ? "visible" : "none" },
        });
        map.on("click", layerId, (e) => {
          const feature = e.features?.[0];
          if (!feature || feature.geometry.type !== "Point") return;
          const props = feature.properties as PoiProperties;
          const [lon, lat] = feature.geometry.coordinates as [number, number];
          setSelectedPoi({ ...props, lat, lon });
        });
        map.on("mouseenter", layerId, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { map.getCanvas().style.cursor = ""; });
      }
    };
    addLayers().catch((err) => console.error("[SectionMap] addLayers failed:", err));

    return () => {
      disposed = true;
      map.remove();
    };
    // Mount once — this component's props are fixed for its instance's
    // lifetime (see the doc comment above), so there's no resync effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <View ref={containerRef} style={{ flex: 1 }} />
      {interactive ? <MapScaleLegend zoom={viewState.zoom} latitude={viewState.latitude} /> : null}
      <PoiDetailSheet poi={selectedPoi} onClose={() => setSelectedPoi(null)} />
    </>
  );
}
