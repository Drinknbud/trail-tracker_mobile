import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapLibreMap,
  RasterSource,
  type PressEventWithFeatures,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import { useCallback, useMemo, useState } from "react";
import { View, type NativeSyntheticEvent } from "react-native";

import { MapScaleLegend } from "@/components/MapScaleLegend";
import { PoiDetailSheet, type PoiSelection } from "@/components/PoiDetailSheet";
import type { SectionRow } from "@/db";
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
  type MapStyleKey,
  type PoiProperties,
} from "@/lib/map-data";
import { useTheme } from "@/theme/ThemeContext";

// No sources/layers of its own — the single base-tile provider is added
// underneath, same blank-style-plus-RasterSource approach TrailMapNative uses.
const BLANK_STYLE = JSON.stringify({ version: 8, sources: {}, layers: [] });

const POI_IMAGES = {
  "poi-shelter": require("../../assets/images/poi/poi-shelter.png"),
  "poi-campsite": require("../../assets/images/poi/poi-campsite.png"),
  "poi-parking": require("../../assets/images/poi/poi-parking.png"),
  "poi-water": require("../../assets/images/poi/poi-water.png"),
  "poi-privy": require("../../assets/images/poi/poi-privy.png"),
};

export type SectionOnlyMapProps = {
  section: SectionRow;
  mapStyle: MapStyleKey;
  /** [west, south, east, north] — the section's own corridor, not the whole trail. */
  bounds: [number, number, number, number];
  /** Disables all gestures — used for the thumbnail preview. Defaults to true. */
  interactive?: boolean;
  /** Whether to show the section's shelter/campsite/water/parking/privy icons. Defaults to true. */
  showPois?: boolean;
};

/**
 * A deliberately minimal map scoped to a single section — just its own trail
 * line and its own nearby POIs, not the whole-trail decorations (mile
 * markers, resupply towns, phone-coverage overlay, other sections) the main
 * Map tab has. Used by SectionMapCard for both the small preview and the
 * full-screen expanded view; the only difference between the two is the
 * `interactive`/`showPois` flags, not which component renders.
 */
export function SectionMapNative({
  section,
  mapStyle,
  bounds,
  interactive = true,
  showPois = true,
}: SectionOnlyMapProps) {
  const { scheme } = useTheme();
  const [selectedPoi, setSelectedPoi] = useState<PoiSelection | null>(null);
  const [viewState, setViewState] = useState({ zoom: 12, latitude: (bounds[1] + bounds[3]) / 2 });

  const handleRegionDidChange = useCallback((e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { zoom, center } = e.nativeEvent;
    setViewState({ zoom, latitude: center[1] });
  }, []);

  const sectionLine = useMemo(() => buildSectionLineCollection([section]), [section]);

  const lo = section.startMile ?? 0;
  const hi = section.endMile ?? 0;
  const shelterData = useMemo(() => filterPoiCollectionByMileRange(SHELTER_COLLECTION, lo, hi), [lo, hi]);
  const campsiteData = useMemo(() => filterPoiCollectionByMileRange(CAMPSITE_COLLECTION, lo, hi), [lo, hi]);
  const waterData = useMemo(() => filterPoiCollectionByMileRange(WATER_COLLECTION, lo, hi), [lo, hi]);
  const parkingData = useMemo(() => filterPoiCollectionByMileRange(PARKING_COLLECTION, lo, hi), [lo, hi]);
  const privyData = useMemo(() => filterPoiCollectionByMileRange(PRIVY_COLLECTION, lo, hi), [lo, hi]);

  const handlePoiPress = useCallback((e: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = e.nativeEvent.features[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const props = feature.properties as PoiProperties;
    const [lon, lat] = feature.geometry.coordinates as [number, number];
    setSelectedPoi({ ...props, lat, lon });
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <MapLibreMap
        style={{ flex: 1 }}
        mapStyle={BLANK_STYLE}
        touchRotate={false}
        touchPitch={false}
        dragPan={interactive}
        touchZoom={interactive}
        doubleTapZoom={interactive}
        doubleTapHoldZoom={interactive}
        onRegionDidChange={handleRegionDidChange}
      >
        <Camera initialViewState={{ bounds, padding: { top: 24, bottom: 24, left: 24, right: 24 } }} />

        <Images images={POI_IMAGES} />

        <RasterSource
          id="section-base-tiles"
          tiles={[TILE_CONFIGS[mapStyle].urlTemplate]}
          tileSize={256}
          attribution={TILE_CONFIGS[mapStyle].attribution}
        >
          <Layer id="section-base-tiles-layer" type="raster" paint={tileRasterPaint(scheme, mapStyle)} />
        </RasterSource>

        <GeoJSONSource id="section-only-line" data={sectionLine}>
          <Layer
            id="section-only-casing"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#FFFFFF", "line-width": 8, "line-opacity": 0.72 }}
          />
          <Layer
            id="section-only-fill"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": ["get", "color"], "line-width": 4.5, "line-opacity": 0.95 }}
          />
        </GeoJSONSource>

        {/* All 5 always mounted (never conditionally add/remove a live
            GeoJSONSource — confirmed crash risk elsewhere in this project);
            showPois only ever toggles per-instance visibility, so this is
            safe even though the source is always present. */}
        <GeoJSONSource id="section-only-parking" data={parkingData} onPress={handlePoiPress}>
          <Layer
            id="section-only-parking-icons"
            type="symbol"
            minzoom={POI_MINZOOM.parking}
            layout={{ "icon-image": "poi-parking", "icon-size": 0.41, "icon-allow-overlap": true, visibility: showPois ? "visible" : "none" }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="section-only-privies" data={privyData} onPress={handlePoiPress}>
          <Layer
            id="section-only-privy-icons"
            type="symbol"
            minzoom={POI_MINZOOM.privy}
            layout={{ "icon-image": "poi-privy", "icon-size": 0.41, "icon-allow-overlap": true, visibility: showPois ? "visible" : "none" }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="section-only-water" data={waterData} onPress={handlePoiPress}>
          <Layer
            id="section-only-water-icons"
            type="symbol"
            minzoom={POI_MINZOOM.water}
            layout={{ "icon-image": "poi-water", "icon-size": 0.41, "icon-allow-overlap": true, visibility: showPois ? "visible" : "none" }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="section-only-campsites" data={campsiteData} onPress={handlePoiPress}>
          <Layer
            id="section-only-campsite-icons"
            type="symbol"
            minzoom={POI_MINZOOM.campsite}
            layout={{ "icon-image": "poi-campsite", "icon-size": 0.41, "icon-allow-overlap": true, visibility: showPois ? "visible" : "none" }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="section-only-shelters" data={shelterData} onPress={handlePoiPress}>
          <Layer
            id="section-only-shelter-icons"
            type="symbol"
            minzoom={POI_MINZOOM.shelter}
            layout={{ "icon-image": "poi-shelter", "icon-size": 0.41, "icon-allow-overlap": true, visibility: showPois ? "visible" : "none" }}
          />
        </GeoJSONSource>
      </MapLibreMap>

      {interactive ? <MapScaleLegend zoom={viewState.zoom} latitude={viewState.latitude} /> : null}
      <PoiDetailSheet poi={selectedPoi} onClose={() => setSelectedPoi(null)} />
    </View>
  );
}
