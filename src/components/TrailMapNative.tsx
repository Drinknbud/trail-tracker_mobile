import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map as MapLibreMap,
  RasterSource,
  UserLocation,
  type PressEventWithFeatures,
  type ViewStateChangeEvent,
} from "@maplibre/maplibre-react-native";
import { useCallback, useMemo, useState } from "react";
import { View, type NativeSyntheticEvent } from "react-native";

import {
  AT_BOUNDS,
  AT_TRAIL,
  CAMPSITE_COLLECTION,
  COVERAGE_DATA,
  COVERAGE_HATCH_PATTERN,
  KM_MARKER_COLLECTION,
  KM_MARKER_TIERS,
  MILE_MARKER_COLLECTION,
  MILE_MARKER_TIERS,
  PARKING_COLLECTION,
  PRIVY_COLLECTION,
  SHELTER_COLLECTION,
  TILE_CONFIGS,
  POI_MINZOOM,
  WATER_COLLECTION,
  buildPhotoCollection,
  buildSectionLineCollection,
  tileRasterPaint,
  type MapPhotoResolved,
  type PoiProperties,
} from "@/lib/map-data";
import { carrierCoverageKey, carrierLabel } from "@/lib/carriers";
import { CoverageInfoSheet } from "@/components/CoverageInfoSheet";
import { MapScaleLegend } from "@/components/MapScaleLegend";
import { PoiDetailSheet, type PoiSelection } from "@/components/PoiDetailSheet";
import { PhotoDetailSheet, type PhotoSelection } from "@/components/PhotoDetailSheet";
import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";
import type { TrailMapProps } from "@/components/trailMapTypes";

// Base style has no built-in sources/layers — the selected raster provider
// (Outdoors/Satellite/Topo) is added underneath as its own RasterSource, the
// same swap-the-tile-provider approach web's TileLayer uses. Offline map tiles
// are downloaded per-section from the Journal/Trip Status screens (see
// src/lib/offline-tiles.ts), and MapLibre serves them automatically when a
// saved region is viewed offline — the map itself needs no download control.
// glyphs is required for the mile-marker text-field labels to render at all
// (MapLibre silently draws nothing without a font source — no error either).
const BLANK_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [],
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
});

const POI_IMAGES = {
  "poi-shelter": require("../../assets/images/poi/poi-shelter.png"),
  "poi-campsite": require("../../assets/images/poi/poi-campsite.png"),
  "poi-parking": require("../../assets/images/poi/poi-parking.png"),
  "poi-water": require("../../assets/images/poi/poi-water.png"),
  "poi-privy": require("../../assets/images/poi/poi-privy.png"),
  // White rounded "sign" stretched behind the stacked mile-marker digits via
  // icon-text-fit — reproduces web's bordered divIcon box (see MILE_MARKER
  // layers below), replacing the bare haloed text this used to render.
  "mile-marker-sign": require("../../assets/images/map/mile-marker-sign.png"),
  // Amber camera badge for the Photos layer (matches web's cameraIcon).
  "photo-marker": require("../../assets/images/map/photo-marker.png"),
  // Diagonal red hatch tile for the phone-coverage dead-zone fill (matches
  // web's FccCoverageLayer SVG pattern) — see coverage layer below. Multiple
  // sizes so the pattern can swap by zoom (COVERAGE_HATCH_PATTERN in
  // map-data.ts) — keeps the apparent stripe density per-hexagon roughly
  // constant instead of a single fixed-pixel tile looking sparse zoomed in
  // and mushy zoomed out.
  "coverage-hatch": require("../../assets/images/map/coverage-hatch.png"),
  "coverage-hatch-12": require("../../assets/images/map/coverage-hatch-12.png"),
  "coverage-hatch-24": require("../../assets/images/map/coverage-hatch-24.png"),
  "coverage-hatch-96": require("../../assets/images/map/coverage-hatch-96.png"),
  "coverage-hatch-192": require("../../assets/images/map/coverage-hatch-192.png"),
};

const MAP_STYLE_KEYS = Object.keys(TILE_CONFIGS) as (keyof typeof TILE_CONFIGS)[];

// Neutral fallback for the coverage source when the selected carrier has no
// precomputed data — keeps the source always-mounted with valid empty data
// instead of it appearing/disappearing (see the mount-order note below).
const EMPTY_FEATURE_COLLECTION = { type: "FeatureCollection" as const, features: [] };

export function TrailMapNative({ layers, mapStyle, sections, photos, carrier }: TrailMapProps) {
  const { scheme } = useTheme();
  const { distanceUnit } = useUnits();
  const [selectedPoi, setSelectedPoi] = useState<PoiSelection | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoSelection | null>(null);
  const [coverageInfoOpen, setCoverageInfoOpen] = useState(false);
  // Drives MapScaleLegend — defaults roughly match the whole-trail initial
  // fit (see AT_BOUNDS) until the first onRegionDidChange settles moments
  // after mount.
  const [viewState, setViewState] = useState({ zoom: 5, latitude: 39.85 });
  const handleRegionDidChange = useCallback((e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
    const { zoom, center } = e.nativeEvent;
    setViewState({ zoom, latitude: center[1] });
  }, []);

  const sectionLines = useMemo(() => buildSectionLineCollection(sections), [sections]);
  const photoCollection = useMemo(() => buildPhotoCollection(photos), [photos]);
  const coverageKey = carrierCoverageKey(carrier);
  const coverageFeature = coverageKey ? COVERAGE_DATA[coverageKey] : null;
  const campsiteData = useMemo(() => {
    if (!layers.campsitesNamedOnly) return CAMPSITE_COLLECTION;
    return {
      ...CAMPSITE_COLLECTION,
      features: CAMPSITE_COLLECTION.features.filter((f) => f.properties.name),
    };
  }, [layers.campsitesNamedOnly]);

  // Same handler for every POI source — GeoJSONSource's onPress fires when one
  // of ITS child layers is the topmost hit at the tap point (across the whole
  // map, not just this source), so this naturally respects the icon hierarchy:
  // tapping an overlapping cluster selects whichever icon is drawn on top.
  const handlePoiPress = useCallback((e: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = e.nativeEvent.features[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const props = feature.properties as PoiProperties;
    const [lon, lat] = feature.geometry.coordinates as [number, number];
    setSelectedPoi({ ...props, lat, lon });
  }, []);

  // Photo markers carry their group's photos as a JSON string (MapLibre can't
  // hold nested arrays in feature properties) — parse it back out on tap.
  const handlePhotoPress = useCallback((e: NativeSyntheticEvent<PressEventWithFeatures>) => {
    const feature = e.nativeEvent.features[0];
    if (!feature) return;
    const raw = (feature.properties as { photosJson?: string })?.photosJson;
    if (!raw) return;
    try {
      setSelectedPhotos(JSON.parse(raw) as MapPhotoResolved[]);
    } catch {
      /* malformed payload — ignore rather than crash the map */
    }
  }, []);

  const handleCoveragePress = useCallback(() => setCoverageInfoOpen(true), []);

  return (
    <View style={{ flex: 1 }}>
      {/* touchRotate disabled — matches web's Leaflet map, which has no rotate gesture at all */}
      <MapLibreMap style={{ flex: 1 }} mapStyle={BLANK_STYLE} touchRotate={false} onRegionDidChange={handleRegionDidChange}>
        <Camera initialViewState={{ bounds: AT_BOUNDS, padding: { top: 40, bottom: 40, left: 40, right: 40 } }} />

        <Images images={POI_IMAGES} />

        {/* Base tile providers — all 3 styles stay permanently mounted and only
            the active one is set visible, instead of swapping the `tiles` URL
            on a single shared source. MapLibre Native doesn't pick up a
            changed `tiles` array on an already-mounted source (confirmed
            on-device — the segmented control updated but tiles never changed),
            and forcing a remount via `key` to work around that turned out to
            disrupt the sibling <Camera>'s attachment lifecycle too, resetting
            zoom/pan on every style switch (also confirmed on-device). Never
            remounting anything sidesteps both problems at once. */}
        {MAP_STYLE_KEYS.map((key, i) => (
          <RasterSource
            key={key}
            id={`base-tiles-${key}`}
            tiles={[TILE_CONFIGS[key].urlTemplate]}
            tileSize={256}
            attribution={TILE_CONFIGS[key].attribution}
          >
            <Layer
              id={`base-tiles-${key}-layer`}
              type="raster"
              layerIndex={i}
              paint={tileRasterPaint(scheme, key)}
              layout={{ visibility: mapStyle === key ? "visible" : "none" }}
            />
          </RasterSource>
        ))}

        {/* Full AT line — white casing behind, dark fill on top (matches web).
            Widths bumped ~45% over web's own px values — a straight port read
            noticeably thinner on-device (confirmed on-device: web's exact
            weights are too subtle at typical phone pixel density).
            line-cap/line-join: round — the trail is ~2000 separate short
            LineString features (one per mile-marker interval), and MapLibre's
            default butt-cap/miter-join makes every segment boundary a visible
            gap or jagged kink. Leaflet (web) defaults to round caps/joins for
            the same multi-feature GeoJSON, which is why web's line looks
            continuous despite being built from just as many segments. */}
        <GeoJSONSource id="at-trail" data={AT_TRAIL}>
          <Layer id="at-trail-casing" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": "#FFFFFF", "line-width": 8, "line-opacity": 0.72 }} />
          <Layer id="at-trail-line" type="line" layout={{ "line-cap": "round", "line-join": "round" }} paint={{ "line-color": "#1F2937", "line-width": 3.5, "line-opacity": 0.9 }} />
        </GeoJSONSource>

        {/* Completed / planned sections — per-section color matched to the log
            page. Same round cap/join fix as the trail line above — section
            lines are also built from one feature per trail segment
            (buildSectionLineCollection). */}
        <GeoJSONSource id="sections" data={sectionLines}>
          <Layer
            id="section-casing"
            type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#FFFFFF", "line-width": 13, "line-opacity": 0.6 }}
          />
          <Layer
            id="section-planned-line"
            type="line"
            filter={["==", ["get", "status"], "planned"]}
            layout={{ "line-cap": "round", "line-join": "round", visibility: layers.planned ? "visible" : "none" }}
            paint={{ "line-color": ["get", "color"], "line-width": 7.5, "line-opacity": 0.95 }}
          />
          <Layer
            id="section-completed-line"
            type="line"
            filter={["==", ["get", "status"], "completed"]}
            layout={{ "line-cap": "round", "line-join": "round", visibility: layers.completed ? "visible" : "none" }}
            paint={{ "line-color": ["get", "color"], "line-width": 7.5, "line-opacity": 0.95 }}
          />
        </GeoJSONSource>

        {/* Phone-coverage dead zones — precomputed per-carrier polygons (see
            lib/map-data.ts COVERAGE_DATA), rendered above the trail/section
            lines but below every POI/photo/mile-marker icon (matches web's
            custom Leaflet pane, z=350, sitting under its overlayPane=400).
            Always mounted (empty FeatureCollection when there's no data for
            the selected carrier) and toggled via layout visibility only —
            conditionally mounting/unmounting a GeoJSONSource while the map is
            live is the same footgun documented above for RasterSource
            (disrupts the native Camera's attachment lifecycle); this source
            used to appear/disappear whenever `carrier` flipped between null
            and a real value (e.g. right after Settings loads the user's
            carrier), which is exactly that footgun. */}
        <GeoJSONSource id="coverage-deadzone" data={coverageFeature ?? EMPTY_FEATURE_COLLECTION} onPress={handleCoveragePress}>
          <Layer
            id="coverage-deadzone-fill"
            type="fill"
            layout={{ visibility: layers.fccCoverage ? "visible" : "none" }}
            paint={{ "fill-pattern": COVERAGE_HATCH_PATTERN as unknown as string, "fill-opacity": 1 }}
          />
          <Layer
            id="coverage-deadzone-outline"
            type="line"
            layout={{ visibility: layers.fccCoverage ? "visible" : "none" }}
            paint={{ "line-color": "#DC2626", "line-width": 2, "line-opacity": 1 }}
          />
        </GeoJSONSource>

        <UserLocation />

        {/* POI icon hierarchy: layers painted later sit on top when markers
            overlap. Lowest priority first (parking/privies), then water,
            then shelters/campsites on top. */}
        <GeoJSONSource id="at-parking" data={PARKING_COLLECTION} onPress={handlePoiPress}>
          <Layer
            id="at-parking-icons"
            type="symbol"
            minzoom={POI_MINZOOM.parking}
            layout={{ "icon-image": "poi-parking", "icon-size": 0.41, "icon-allow-overlap": true, visibility: layers.parking ? "visible" : "none" }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="at-privies" data={PRIVY_COLLECTION} onPress={handlePoiPress}>
          <Layer
            id="at-privy-icons"
            type="symbol"
            minzoom={POI_MINZOOM.privy}
            layout={{ "icon-image": "poi-privy", "icon-size": 0.41, "icon-allow-overlap": true, visibility: layers.privies ? "visible" : "none" }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="at-water" data={WATER_COLLECTION} onPress={handlePoiPress}>
          <Layer
            id="at-water-icons"
            type="symbol"
            minzoom={POI_MINZOOM.water}
            layout={{ "icon-image": "poi-water", "icon-size": 0.41, "icon-allow-overlap": true, visibility: layers.water ? "visible" : "none" }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="at-campsites" data={campsiteData} onPress={handlePoiPress}>
          <Layer
            id="at-campsite-icons"
            type="symbol"
            minzoom={POI_MINZOOM.campsite}
            layout={{ "icon-image": "poi-campsite", "icon-size": 0.41, "icon-allow-overlap": true, visibility: layers.campsites ? "visible" : "none" }}
          />
        </GeoJSONSource>

        <GeoJSONSource id="at-shelters" data={SHELTER_COLLECTION} onPress={handlePoiPress}>
          <Layer
            id="at-shelter-icons"
            type="symbol"
            minzoom={POI_MINZOOM.shelter}
            layout={{ "icon-image": "poi-shelter", "icon-size": 0.41, "icon-allow-overlap": true, visibility: layers.shelters ? "visible" : "none" }}
          />
        </GeoJSONSource>

        {/* Photo markers — camera badges, on top of the POI icons (matches web). */}
        <GeoJSONSource id="at-photos" data={photoCollection} onPress={handlePhotoPress}>
          <Layer
            id="at-photo-icons"
            type="symbol"
            layout={{ "icon-image": "photo-marker", "icon-size": 0.5, "icon-allow-overlap": true, visibility: layers.photos ? "visible" : "none" }}
          />
        </GeoJSONSource>

        {/* Mile/km markers — AT-blaze-style digit-stacked labels, one layer per
            zoom tier so each can carry its own minzoom threshold. Rendered
            LAST so the markers sit on top of the POI/photo icons instead of
            being covered by them. Two independent source/tier sets (mi and
            km) rather than one dataset with a swapped label: km markers sit
            at round-km positions (not the km-equivalent of round-mile
            positions), matching web's own per-unit marker placement — see
            KM_MARKER_COLLECTION in map-data.ts. Only the active unit's set is
            mounted, so re-adding icon-image etc. per tier stays exactly like
            the single-set version used to be. */}
        <GeoJSONSource
          // Keyed on the unit so switching mi↔km cleanly unmounts/remounts
          // this source+its layers instead of mutating an existing native
          // source's id/feature-set in place (the two carry different
          // positions and feature counts, not just a swapped label).
          key={distanceUnit}
          id={distanceUnit === "km" ? "km-markers" : "mile-markers"}
          data={distanceUnit === "km" ? KM_MARKER_COLLECTION : MILE_MARKER_COLLECTION}
        >
          {(distanceUnit === "km" ? KM_MARKER_TIERS : MILE_MARKER_TIERS).map(({ tier, minzoom }) => (
            <Layer
              key={tier}
              id={`${distanceUnit === "km" ? "km" : "mile"}-marker-labels-${tier}`}
              type="symbol"
              minzoom={minzoom}
              filter={["==", ["get", "tier"], tier]}
              layout={{
                "icon-image": "mile-marker-sign",
                "icon-text-fit": "both",
                // [top, right, bottom, left] px added around the digits — the
                // breathing room that makes it read as a padded sign, not text.
                "icon-text-fit-padding": [3, 5, 3, 5],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                // If the fitted box ever fails to place, still show the digits.
                "icon-optional": true,
                "text-field": ["get", "label"],
                "text-font": ["Noto Sans Bold"],
                "text-size": 10,
                "text-line-height": 1,
                "text-allow-overlap": true,
                "text-ignore-placement": true,
              }}
              paint={{
                // White halo is invisible against the white sign box, but keeps
                // the digits legible if the box didn't render (fallback).
                "text-color": "#1F2937",
                "text-halo-color": "#FFFFFF",
                "text-halo-width": 1.5,
              }}
            />
          ))}
        </GeoJSONSource>
      </MapLibreMap>

      <MapScaleLegend zoom={viewState.zoom} latitude={viewState.latitude} />

      <PoiDetailSheet poi={selectedPoi} onClose={() => setSelectedPoi(null)} />
      <PhotoDetailSheet photos={selectedPhotos} onClose={() => setSelectedPhotos(null)} />
      <CoverageInfoSheet
        visible={coverageInfoOpen}
        carrierLabel={carrierLabel(carrier)}
        onClose={() => setCoverageInfoOpen(false)}
      />
    </View>
  );
}
