import { Asset } from "expo-asset";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import {
  AT_BOUNDS,
  AT_TRAIL,
  CAMPSITE_COLLECTION,
  COVERAGE_DATA,
  COVERAGE_HATCH_PATTERN,
  TOWN_COLLECTION,
  TOWN_LINK_COLLECTION,
  TOWN_MINZOOM,
  COVERAGE_HATCH_TIERS,
  KM_MARKER_COLLECTION,
  KM_MARKER_TIERS,
  MILE_MARKER_COLLECTION,
  MILE_MARKER_TIERS,
  PARKING_COLLECTION,
  PRIVY_COLLECTION,
  SHELTER_COLLECTION,
  TILE_CONFIGS,
  WATER_COLLECTION,
  POI_MINZOOM,
  buildPhotoCollection,
  buildSectionLineCollection,
  tileRasterPaint,
  type MapPhotoResolved,
  type PoiProperties,
  type TownProperties,
} from "@/lib/map-data";
import { carrierCoverageKey, carrierLabel } from "@/lib/carriers";
import { CoverageInfoSheet } from "@/components/CoverageInfoSheet";
import { MapScaleLegend } from "@/components/MapScaleLegend";
import { PoiDetailSheet, type PoiSelection } from "@/components/PoiDetailSheet";
import { TownDetailSheet } from "@/components/TownDetailSheet";
import { PhotoDetailSheet, type PhotoSelection } from "@/components/PhotoDetailSheet";
import { useUnits } from "@/lib/units-context";
import { useTheme } from "@/theme/ThemeContext";
import type { TrailMapProps } from "@/components/trailMapTypes";

const POI_IMAGE_MODULES: Record<string, number> = {
  "poi-shelter": require("../../assets/images/poi/poi-shelter.png"),
  "poi-campsite": require("../../assets/images/poi/poi-campsite.png"),
  "poi-parking": require("../../assets/images/poi/poi-parking.png"),
  "poi-water": require("../../assets/images/poi/poi-water.png"),
  "poi-privy": require("../../assets/images/poi/poi-privy.png"),
  // Resupply towns (ATC Data Book) — violet house badge, matches the web app.
  "poi-town": require("../../assets/images/poi/poi-town.png"),
  // White rounded "sign" stretched behind the stacked mile-marker digits via
  // icon-text-fit — mirrors TrailMapNative and web's bordered divIcon box.
  "mile-marker-sign": require("../../assets/images/map/mile-marker-sign.png"),
  // Amber camera badge for the Photos layer (matches web's cameraIcon).
  "photo-marker": require("../../assets/images/map/photo-marker.png"),
  // Diagonal red hatch tile for the phone-coverage dead-zone fill (matches
  // web's FccCoverageLayer SVG pattern). Multiple sizes so the pattern can
  // swap by zoom (see COVERAGE_HATCH_PATTERN in map-data.ts) — keeps the
  // apparent stripe density per-hexagon roughly constant instead of a single
  // fixed-pixel tile looking sparse zoomed in and mushy zoomed out.
  "coverage-hatch": require("../../assets/images/map/coverage-hatch.png"),
  "coverage-hatch-12": require("../../assets/images/map/coverage-hatch-12.png"),
  "coverage-hatch-24": require("../../assets/images/map/coverage-hatch-24.png"),
  "coverage-hatch-96": require("../../assets/images/map/coverage-hatch-96.png"),
  "coverage-hatch-192": require("../../assets/images/map/coverage-hatch-192.png"),
};

const EMPTY_FEATURE_COLLECTION: GeoJSON.GeoJSON = { type: "FeatureCollection", features: [] };

// POI icon hierarchy: layers painted later sit on top when markers overlap.
// Lowest priority first (parking/privies), then water, then shelters/campsites
// on top — order here is paint order, not a fixed id, so keep it deliberate.
const POI_SOURCES: { id: string; icon: string; data: GeoJSON.GeoJSON; layerKey: keyof TrailMapProps["layers"]; minzoom: number }[] = [
  { id: "at-parking", icon: "poi-parking", data: PARKING_COLLECTION as GeoJSON.GeoJSON, layerKey: "parking", minzoom: POI_MINZOOM.parking },
  { id: "at-privies", icon: "poi-privy", data: PRIVY_COLLECTION as GeoJSON.GeoJSON, layerKey: "privies", minzoom: POI_MINZOOM.privy },
  { id: "at-water", icon: "poi-water", data: WATER_COLLECTION as GeoJSON.GeoJSON, layerKey: "water", minzoom: POI_MINZOOM.water },
  { id: "at-campsites", icon: "poi-campsite", data: CAMPSITE_COLLECTION as GeoJSON.GeoJSON, layerKey: "campsites", minzoom: POI_MINZOOM.campsite },
  { id: "at-shelters", icon: "poi-shelter", data: SHELTER_COLLECTION as GeoJSON.GeoJSON, layerKey: "shelters", minzoom: POI_MINZOOM.shelter },
];

const MAP_STYLE_KEYS = Object.keys(TILE_CONFIGS) as (keyof typeof TILE_CONFIGS)[];

// Web preview variant — mirrors TrailMapNative using maplibre-gl JS with the
// same style URL and data, so trail/POI rendering can be checked in a browser.
export function TrailMap({ layers, mapStyle, sections, photos, carrier }: TrailMapProps) {
  const { scheme } = useTheme();
  const { distanceUnit } = useUnits();
  const schemeRef = useRef(scheme);
  schemeRef.current = scheme;
  const mapStyleRef = useRef(mapStyle);
  mapStyleRef.current = mapStyle;
  const distanceUnitRef = useRef(distanceUnit);
  distanceUnitRef.current = distanceUnit;
  const containerRef = useRef<View>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const carrierRef = useRef(carrier);
  carrierRef.current = carrier;
  const [selectedPoi, setSelectedPoi] = useState<PoiSelection | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoSelection | null>(null);
  const [coverageInfoOpen, setCoverageInfoOpen] = useState(false);
  const [selectedTown, setSelectedTown] = useState<TownProperties | null>(null);
  // Drives MapScaleLegend — defaults roughly match the whole-trail initial
  // fit (see AT_BOUNDS) until the first "move" event settles moments after mount.
  const [viewState, setViewState] = useState({ zoom: 5, latitude: 39.85 });

  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      // glyphs is required for the mile-marker text-field labels to render at
      // all (MapLibre silently draws nothing without a font source).
      style: { version: 8, sources: {}, layers: [], glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf" },
      bounds: AT_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true },
    });
    // Debug handle for browser-preview inspection (web preview only)
    (window as unknown as { __trailMap?: maplibregl.Map }).__trailMap = map;
    map.on("error", (e) => console.error("[TrailMap] map error:", e.error?.message ?? e));
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
        console.error(`[TrailMap] failed to load icon "${name}":`, err);
      }
    };

    // The mile-marker sign must be a nine-patch (stretchable) image: maplibre-gl
    // drops an icon-text-fit icon entirely when the source image has no stretch
    // metadata (confirmed in-preview — the digits rendered but the box never
    // did), so the stretchX/stretchY/content boxes are required, not cosmetic.
    // They also keep the border even under the non-uniform text-fit stretch.
    const loadSignIcon = async () => {
      try {
        const asset = Asset.fromModule(POI_IMAGE_MODULES["mile-marker-sign"]);
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        const { data } = await map.loadImage(uri);
        if (!data || map.hasImage("mile-marker-sign")) return;
        const w = data.width;
        const h = data.height;
        map.addImage("mile-marker-sign", data, {
          pixelRatio: 3,
          stretchX: [[Math.round(w / 3), Math.round((w * 2) / 3)]],
          stretchY: [[Math.round(h / 3), Math.round((h * 2) / 3)]],
          content: [Math.round(w * 0.16), Math.round(h * 0.16), Math.round(w * 0.84), Math.round(h * 0.84)],
        });
      } catch (err) {
        console.error('[TrailMap] failed to load icon "mile-marker-sign":', err);
      }
    };

    // Add layers as soon as the style is ready. The `load` event waits for a
    // first fully-rendered frame (deferred indefinitely in throttled tabs) and
    // the last `styledata` can fire before isStyleLoaded() flips true, so poll.
    const addLayers = async () => {
      if (disposed || map.getLayer("at-trail-line")) return;
      if (!map.isStyleLoaded()) {
        setTimeout(addLayers, 250);
        return;
      }

      // All 3 tile styles stay permanently mounted, only the active one
      // visible — matches TrailMapNative, which does this specifically to
      // avoid a zoom/pan reset that came from remounting the raster source on
      // every style switch (see that file for the full on-device story).
      for (const key of MAP_STYLE_KEYS) {
        const tileConfig = TILE_CONFIGS[key];
        map.addSource(`base-tiles-${key}`, { type: "raster", tiles: [tileConfig.urlTemplate], tileSize: 256, attribution: tileConfig.attribution });
        map.addLayer({
          id: `base-tiles-${key}-layer`,
          type: "raster",
          source: `base-tiles-${key}`,
          paint: tileRasterPaint(schemeRef.current, key),
          layout: { visibility: mapStyleRef.current === key ? "visible" : "none" },
        });
      }

      // Widths bumped ~45% over web's own px values — a straight port read
      // noticeably thinner on-device at typical phone pixel density.
      // line-cap/line-join: round on every line layer below — the trail and
      // section data are each ~2000 separate short LineString features (one
      // per trail-segment interval), and MapLibre's default butt-cap/
      // miter-join makes every segment boundary a visible gap or jagged kink.
      // Leaflet (web's own renderer) defaults to round caps/joins for the
      // same multi-feature GeoJSON, which is why web's line looks continuous
      // despite being built from just as many segments.
      map.addSource("at-trail", { type: "geojson", data: AT_TRAIL as GeoJSON.GeoJSON });
      map.addLayer({ id: "at-trail-casing", type: "line", source: "at-trail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FFFFFF", "line-width": 8, "line-opacity": 0.72 } });
      map.addLayer({ id: "at-trail-line", type: "line", source: "at-trail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1F2937", "line-width": 3.5, "line-opacity": 0.9 } });

      map.addSource("sections", { type: "geojson", data: buildSectionLineCollection(sectionsRef.current) as GeoJSON.GeoJSON });
      map.addLayer({ id: "section-casing", type: "line", source: "sections", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FFFFFF", "line-width": 13, "line-opacity": 0.6 } });
      map.addLayer({
        id: "section-planned-line",
        type: "line",
        source: "sections",
        filter: ["==", ["get", "status"], "planned"],
        layout: { "line-cap": "round", "line-join": "round", visibility: layersRef.current.planned ? "visible" : "none" },
        paint: { "line-color": ["get", "color"], "line-width": 7.5, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "section-completed-line",
        type: "line",
        source: "sections",
        filter: ["==", ["get", "status"], "completed"],
        layout: { "line-cap": "round", "line-join": "round", visibility: layersRef.current.completed ? "visible" : "none" },
        paint: { "line-color": ["get", "color"], "line-width": 7.5, "line-opacity": 0.95 },
      });

      // Phone-coverage dead zones — precomputed per-carrier polygons (see
      // lib/map-data.ts COVERAGE_DATA), rendered above the trail/section lines
      // but below every POI/photo/mile-marker icon (matches web's own custom
      // Leaflet pane, z=350, sitting under its overlayPane=400).
      for (const tier of COVERAGE_HATCH_TIERS) await loadIcon(tier);
      const initialCoverageKey = carrierCoverageKey(carrierRef.current);
      map.addSource("coverage-deadzone", {
        type: "geojson",
        data: initialCoverageKey ? (COVERAGE_DATA[initialCoverageKey] as GeoJSON.GeoJSON) : EMPTY_FEATURE_COLLECTION,
      });
      map.addLayer({
        id: "coverage-deadzone-fill",
        type: "fill",
        source: "coverage-deadzone",
        layout: { visibility: layersRef.current.fccCoverage ? "visible" : "none" },
        paint: { "fill-pattern": COVERAGE_HATCH_PATTERN as unknown as string, "fill-opacity": 1 },
      });
      map.addLayer({
        id: "coverage-deadzone-outline",
        type: "line",
        source: "coverage-deadzone",
        layout: { visibility: layersRef.current.fccCoverage ? "visible" : "none" },
        paint: { "line-color": "#DC2626", "line-width": 2, "line-opacity": 1 },
      });
      map.on("click", "coverage-deadzone-fill", () => setCoverageInfoOpen(true));
      map.on("mouseenter", "coverage-deadzone-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "coverage-deadzone-fill", () => { map.getCanvas().style.cursor = ""; });

      for (const src of POI_SOURCES) {
        await loadIcon(src.icon);
        const data = src.id === "at-campsites" ? campsiteData(layersRef.current.campsitesNamedOnly) : src.data;
        map.addSource(src.id, { type: "geojson", data });
        const layerId = `${src.id}-icons`;
        map.addLayer({
          id: layerId,
          type: "symbol",
          source: src.id,
          minzoom: src.minzoom,
          layout: { "icon-image": src.icon, "icon-size": 0.41, "icon-allow-overlap": true, visibility: layersRef.current[src.layerKey] ? "visible" : "none" },
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

      // Resupply towns — placed at the trail mile where you leave for the town.
      // Painted above the POI icons: a town is a bigger planning landmark than
      // an individual privy or water source.
      await loadIcon("poi-town");
      // Leader line first so it draws beneath the town badge.
      map.addSource("at-town-links", { type: "geojson", data: TOWN_LINK_COLLECTION as GeoJSON.GeoJSON });
      map.addLayer({
        id: "at-town-links-line",
        type: "line",
        source: "at-town-links",
        minzoom: TOWN_MINZOOM,
        layout: { "line-cap": "round", visibility: layersRef.current.towns ? "visible" : "none" },
        paint: { "line-color": "#7C3AED", "line-width": 2, "line-opacity": 0.85, "line-dasharray": [2, 2] },
      });
      map.addSource("at-towns", { type: "geojson", data: TOWN_COLLECTION as GeoJSON.GeoJSON });
      map.addLayer({
        id: "at-town-icons",
        type: "symbol",
        source: "at-towns",
        minzoom: TOWN_MINZOOM,
        layout: { "icon-image": "poi-town", "icon-size": 0.42, "icon-allow-overlap": true, visibility: layersRef.current.towns ? "visible" : "none" },
      });
      map.on("click", "at-town-icons", (e) => {
        const props = e.features?.[0]?.properties as TownProperties | undefined;
        if (props) setSelectedTown(props);
      });
      map.on("mouseenter", "at-town-icons", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "at-town-icons", () => { map.getCanvas().style.cursor = ""; });

      // Photo markers — camera badges on top of the POI icons (matches web app).
      await loadIcon("photo-marker");
      map.addSource("at-photos", { type: "geojson", data: buildPhotoCollection(photosRef.current) as GeoJSON.GeoJSON });
      map.addLayer({
        id: "at-photo-icons",
        type: "symbol",
        source: "at-photos",
        layout: { "icon-image": "photo-marker", "icon-size": 0.5, "icon-allow-overlap": true, visibility: layersRef.current.photos ? "visible" : "none" },
      });
      map.on("click", "at-photo-icons", (e) => {
        const raw = e.features?.[0]?.properties?.photosJson;
        if (typeof raw !== "string") return;
        try {
          setSelectedPhotos(JSON.parse(raw) as MapPhotoResolved[]);
        } catch {
          /* malformed payload — ignore */
        }
      });
      map.on("mouseenter", "at-photo-icons", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "at-photo-icons", () => { map.getCanvas().style.cursor = ""; });

      // Mile/km markers added LAST so they sit on top of the POI/photo icons
      // instead of being covered by them (matches web's zIndexOffset:1000).
      // Both unit sets are mounted permanently (like the 3 tile styles above)
      // and only the active one is set visible — km markers sit at round-km
      // positions rather than the km-equivalent of round-mile positions
      // (matches web's own per-unit marker placement; see KM_MARKER_COLLECTION
      // in map-data.ts), so this is two distinct feature sets, not one
      // dataset with a swapped label.
      await loadSignIcon();
      const MARKER_SETS = [
        { unit: "mi" as const, source: "mile-markers", data: MILE_MARKER_COLLECTION, tiers: MILE_MARKER_TIERS },
        { unit: "km" as const, source: "km-markers", data: KM_MARKER_COLLECTION, tiers: KM_MARKER_TIERS },
      ];
      for (const { unit, source, data, tiers } of MARKER_SETS) {
        map.addSource(source, { type: "geojson", data: data as GeoJSON.GeoJSON });
        for (const { tier, minzoom } of tiers) {
          map.addLayer({
            id: `${unit}-marker-labels-${tier}`,
            type: "symbol",
            source,
            minzoom,
            filter: ["==", ["get", "tier"], tier],
            layout: {
              "icon-image": "mile-marker-sign",
              "icon-text-fit": "both",
              // [top, right, bottom, left] px around the digits — matches native.
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
              visibility: unit === distanceUnitRef.current ? "visible" : "none",
            },
            // White halo is invisible against the white sign box, but keeps the
            // digits legible in the fallback case where the box didn't render.
            paint: { "text-color": "#1F2937", "text-halo-color": "#FFFFFF", "text-halo-width": 1.5 },
          });
        }
      }
    };
    addLayers().catch((err) => console.error("[TrailMap] addLayers failed:", err));

    return () => {
      disposed = true;
      map.remove();
    };
    // Mount once — mapStyle/scheme changes are handled by the sync effect
    // below via visibility + paint, not a rebuild (a rebuild here would reset
    // zoom/pan, the same bug fixed on native).
  }, []);

  // Sync layer visibility + section/campsite data without recreating the map.
  // Each icon layer is added asynchronously (behind an `await loadIcon(...)`
  // in addLayers), so a toggle that fires mid-mount can easily hit a layer
  // that doesn't exist yet — map.setLayoutProperty throws in that case, which
  // used to abort the rest of this function (including the coverage-deadzone
  // visibility lines further down) rather than just skipping that one layer.
  // Guarding each call with getLayer() lets every other layer still apply and
  // the retry loop below picks up whatever was missed once it exists.
  useEffect(() => {
    const map = (window as unknown as { __trailMap?: maplibregl.Map }).__trailMap;
    if (!map) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const setVis = (id: string, visible: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    const apply = () => {
      if (cancelled) return;
      if (!map.getLayer("at-trail-line")) {
        timer = setTimeout(apply, 200);
        return;
      }
      setVis("section-planned-line", layers.planned);
      setVis("section-completed-line", layers.completed);
      setVis("at-shelters-icons", layers.shelters);
      setVis("at-campsites-icons", layers.campsites);
      setVis("at-parking-icons", layers.parking);
      setVis("at-water-icons", layers.water);
      setVis("at-privies-icons", layers.privies);
      setVis("at-photo-icons", layers.photos);
      setVis("at-town-icons", layers.towns);
      setVis("at-town-links-line", layers.towns);
      setVis("coverage-deadzone-fill", layers.fccCoverage);
      setVis("coverage-deadzone-outline", layers.fccCoverage);
      const campsiteSource = map.getSource("at-campsites") as maplibregl.GeoJSONSource | undefined;
      campsiteSource?.setData(campsiteData(layers.campsitesNamedOnly));
    };
    apply();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [layers]);

  // Swap the dead-zone polygon set when the selected carrier changes. carrier
  // starts null (fetchWebUser hasn't resolved yet) and flips to a real value
  // moments later — without cancelling the retry-until-source-exists timer
  // on cleanup, a stale `carrier=null` closure from the first run could fire
  // its setTimeout AFTER the real value already landed and clobber it back to
  // an empty FeatureCollection (the exact bug: dead zones render on native,
  // where there's no such polling window, but silently stayed empty on web).
  useEffect(() => {
    const map = (window as unknown as { __trailMap?: maplibregl.Map }).__trailMap;
    if (!map) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      if (cancelled) return;
      const source = map.getSource("coverage-deadzone") as maplibregl.GeoJSONSource | undefined;
      if (!source) {
        timer = setTimeout(apply, 200);
        return;
      }
      const key = carrierCoverageKey(carrier);
      source.setData(key ? (COVERAGE_DATA[key] as GeoJSON.GeoJSON) : EMPTY_FEATURE_COLLECTION);
    };
    apply();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [carrier]);

  // Keep the photo markers in sync as photos load / the active trail changes.
  useEffect(() => {
    const map = (window as unknown as { __trailMap?: maplibregl.Map }).__trailMap;
    if (!map) return;
    const apply = () => {
      const source = map.getSource("at-photos") as maplibregl.GeoJSONSource | undefined;
      if (!source) {
        setTimeout(apply, 200);
        return;
      }
      source.setData(buildPhotoCollection(photos) as GeoJSON.GeoJSON);
    };
    apply();
  }, [photos]);

  useEffect(() => {
    const map = (window as unknown as { __trailMap?: maplibregl.Map }).__trailMap;
    if (!map) return;
    const apply = () => {
      const source = map.getSource("sections") as maplibregl.GeoJSONSource | undefined;
      if (!source) {
        setTimeout(apply, 200);
        return;
      }
      source.setData(buildSectionLineCollection(sections) as GeoJSON.GeoJSON);
    };
    apply();
  }, [sections]);

  // Switch the active tile style (visibility only, nothing remounts) and
  // re-paint all 3 for a theme toggle, without a full map rebuild.
  useEffect(() => {
    const map = (window as unknown as { __trailMap?: maplibregl.Map }).__trailMap;
    if (!map) return;
    const apply = () => {
      if (!map.getLayer(`base-tiles-${MAP_STYLE_KEYS[0]}-layer`)) {
        setTimeout(apply, 200);
        return;
      }
      for (const key of MAP_STYLE_KEYS) {
        const layerId = `base-tiles-${key}-layer`;
        map.setLayoutProperty(layerId, "visibility", mapStyle === key ? "visible" : "none");
        const paint = tileRasterPaint(scheme, key);
        for (const [prop, value] of Object.entries(paint)) {
          map.setPaintProperty(layerId, prop as never, value);
        }
      }
    };
    apply();
  }, [scheme, mapStyle]);

  // Switch the active mile/km marker set (visibility only, nothing remounts)
  // when the user's distance unit changes.
  useEffect(() => {
    const map = (window as unknown as { __trailMap?: maplibregl.Map }).__trailMap;
    if (!map) return;
    const apply = () => {
      if (!map.getLayer(`mi-marker-labels-${MILE_MARKER_TIERS[0].tier}`)) {
        setTimeout(apply, 200);
        return;
      }
      for (const { tier } of MILE_MARKER_TIERS) {
        map.setLayoutProperty(`mi-marker-labels-${tier}`, "visibility", distanceUnit === "mi" ? "visible" : "none");
      }
      for (const { tier } of KM_MARKER_TIERS) {
        map.setLayoutProperty(`km-marker-labels-${tier}`, "visibility", distanceUnit === "km" ? "visible" : "none");
      }
    };
    apply();
  }, [distanceUnit]);

  return (
    <>
      <View ref={containerRef} style={{ flex: 1 }} />
      <MapScaleLegend zoom={viewState.zoom} latitude={viewState.latitude} />
      <PoiDetailSheet poi={selectedPoi} onClose={() => setSelectedPoi(null)} />
      <PhotoDetailSheet photos={selectedPhotos} onClose={() => setSelectedPhotos(null)} />
      <TownDetailSheet town={selectedTown} visible={selectedTown !== null} onClose={() => setSelectedTown(null)} />

      <CoverageInfoSheet
        visible={coverageInfoOpen}
        carrierLabel={carrierLabel(carrier)}
        onClose={() => setCoverageInfoOpen(false)}
      />
    </>
  );
}

function campsiteData(namedOnly: boolean): GeoJSON.GeoJSON {
  if (!namedOnly) return CAMPSITE_COLLECTION as GeoJSON.GeoJSON;
  return {
    ...CAMPSITE_COLLECTION,
    features: CAMPSITE_COLLECTION.features.filter((f) => f.properties.name),
  } as GeoJSON.GeoJSON;
}
