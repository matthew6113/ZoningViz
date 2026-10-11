import "maplibre-gl/dist/maplibre-gl.css";
import { coverageNote, loadDistrict, zoningCoverage, type ParcelTileProps } from "@zoningviz/jurisdictions/sf";
import type { Geometry } from "geojson";
import { LngLatBounds, Map as MapLibreMap, type MapGeoJSONFeature, type PaddingOptions } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { prefetchLot } from "../data/loadLot";
import type { Handoff } from "../scene/Scene";
import type { MapView } from "../state/url";
import { feetPerPixel } from "./geo";
import { SearchBox, type SearchHit } from "./search";
import { LAYER, legend, lotFilter, mapLayers, SOURCE } from "./style";
import { BASEMAP_STYLE, checkTiles, setUpMapLibre, TILES_URL, type TilesStatus } from "./tiles";

// Map screen: pick a lot by hovering, clicking or searching; the map flies to it
// and hands over to the 3D scene at the same scale.

const CITY_VIEW: MapView = { lon: -122.4425, lat: 37.7598, zoom: 12.3 };
const LOT_ZOOM = 19; // when only a point is known (search results, examples)
const MAX_FLY_ZOOM = 19.5;
const FLIGHT_MS = 1200;

export interface Example {
  id: string;
  label: string;
  note: string;
  /** Lot centroid; absent for synthetic fixtures, which open without a flight. */
  at?: [number, number];
}

export const EXAMPLES: Example[] = [
  { id: "4025007", label: "667 Hampshire St", note: "RH-2, mid-block", at: [-122.40779, 37.76102] },
  { id: "4025006", label: "2550 19th St", note: "RH-2 corner lot: you pick the front", at: [-122.40787, 37.76079] },
  { id: "4276045", label: "1391 Hampshire St", note: "RH-2 across two height districts", at: [-122.40674, 37.75021] },
  { id: "0044030", label: "766–772 Francisco St", note: "RH-2 condo lot in an R-4 district", at: [-122.41787, 37.80438] },
  { id: "2687029", label: "124 Clarendon Ave", note: "RH-1(D): side yards", at: [-122.45195, 37.75864] },
  { id: "1646023", label: "752 4th Ave", note: "RH-1", at: [-122.46134, 37.77465] },
  { id: "0982019", label: "2120 Lyon St", note: "RH-3: no front height plane", at: [-122.44576, 37.79064] },
  { id: "fixture-a", label: "Fixture A", note: "synthetic 25 × 100 ft RH-2 lot (SPEC.md)" },
];

interface Props {
  /** True while a lot is open on top of the map. */
  hidden: boolean;
  view: MapView | null;
  reducedMotion: boolean;
  onMove: (view: MapView) => void;
  onOpen: (blklot: string, handoff: Handoff | null) => void;
}

interface Popup {
  x: number;
  y: number;
  title: string;
  text: string;
}

export function MapScreen({ hidden, view, reducedMotion, onMove, onOpen }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hovered = useRef<string | null>(null);
  const flying = useRef(false);
  const latest = useRef({ onMove, onOpen, reducedMotion, view });
  latest.current = { onMove, onOpen, reducedMotion, view };

  const [tiles, setTiles] = useState<TilesStatus | null>(null);
  const [tint, setTint] = useState(true);
  const [hover, setHover] = useState<ParcelTileProps | null>(null);
  const [popup, setPopup] = useState<Popup | null>(null);

  // Create the map once.
  useEffect(() => {
    setUpMapLibre();
    const tilesCheck = checkTiles();
    const start = latest.current.view ?? CITY_VIEW;
    const map = new MapLibreMap({
      container: container.current!,
      style: BASEMAP_STYLE,
      center: [start.lon, start.lat],
      zoom: start.zoom,
      minZoom: 10,
      maxZoom: 20,
      maxBounds: [
        [-122.75, 37.6],
        [-122.2, 37.92],
      ],
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
      // Browser tests read pixels back (see Scene.tsx); real visitors skip the copy.
      canvasContextAttributes: { preserveDrawingBuffer: navigator.webdriver === true },
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    (window as unknown as { __zoningMap?: MapLibreMap }).__zoningMap = map;

    map.on("load", async () => {
      const status = await tilesCheck;
      setTiles(status);
      if (!status.ok || !map.getStyle()) return;
      map.addSource(SOURCE, { type: "vector", url: `pmtiles://${TILES_URL}` });
      // Under the basemap's labels, so street names stay readable.
      const firstLabel = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
      for (const layer of mapLayers(true)) map.addLayer(layer, firstLabel);
      map.once("idle", () => container.current?.setAttribute("data-ready", "true"));
    });

    map.on("mousemove", LAYER.fill, (e) => {
      const feature = e.features?.[0];
      if (!feature || flying.current) return;
      const props = feature.properties as ParcelTileProps;
      tooltip.current?.style.setProperty("transform", `translate(${e.point.x + 14}px, ${e.point.y + 14}px)`);
      if (props.blklot !== hovered.current) {
        hovered.current = props.blklot;
        map.setFilter(LAYER.hover, lotFilter(props.blklot));
        setHover(props);
      }
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER.fill, () => {
      hovered.current = null;
      map.setFilter(LAYER.hover, lotFilter(null));
      setHover(null);
      map.getCanvas().style.cursor = "";
    });
    map.on("click", (e) => {
      const feature = map.getLayer(LAYER.fill) ? map.queryRenderedFeatures(e.point, { layers: [LAYER.fill] })[0] : undefined;
      if (!feature || flying.current) return setPopup(null);
      const props = feature.properties as ParcelTileProps;
      const coverage = zoningCoverage(props.zoning);
      // Lots with no zoning on the parcel record are looked up from the zoning layer when they open.
      if (coverage.kind === "covered" || coverage.kind === "unknown") {
        select(props.blklot, { bounds: boundsOf(feature) });
      } else {
        setPopup({ x: e.point.x, y: e.point.y, title: props.address ?? `Block/lot ${props.blklot}`, text: coverageNote(coverage)! });
      }
    });
    map.on("moveend", () => {
      if (flying.current) return;
      const center = map.getCenter();
      latest.current.onMove({ lon: center.lng, lat: center.lat, zoom: map.getZoom() });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once; handlers read `latest`
  }, []);

  // Coming back from a lot: the map may have been laid out while hidden.
  useEffect(() => {
    if (!hidden) mapRef.current?.resize();
  }, [hidden]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer(LAYER.tint)) map.setLayoutProperty(LAYER.tint, "visibility", tint ? "visible" : "none");
  }, [tint]);

  /** Flies to a lot and hands over to the scene. */
  function select(blklot: string, target: { bounds?: LngLatBounds; center?: [number, number] }) {
    const map = mapRef.current;
    prefetchLot(blklot);
    setPopup(null);
    if (!map) return latest.current.onOpen(blklot, null);
    if (map.getLayer(LAYER.selected)) map.setFilter(LAYER.selected, lotFilter(blklot));
    const padding = scenePadding(map);
    let center = target.center;
    let zoom = LOT_ZOOM;
    if (target.bounds) {
      // Only the zoom comes from fitting the bounds; flyTo's padding places the center.
      const camera = map.cameraForBounds(target.bounds, { padding: lotPadding(map, padding), maxZoom: MAX_FLY_ZOOM });
      center = target.bounds.getCenter().toArray() as [number, number];
      zoom = Math.min(camera?.zoom ?? LOT_ZOOM, MAX_FLY_ZOOM);
    }
    const done = () => latest.current.onOpen(blklot, { ftPerPx: feetPerPixel(map.getCenter().lat, map.getZoom()) });
    if (latest.current.reducedMotion) {
      map.jumpTo({ center: center!, zoom, bearing: 0, pitch: 0, padding });
      return done();
    }
    flying.current = true;
    hovered.current = null;
    setHover(null);
    map.flyTo({ center: center!, zoom, bearing: 0, pitch: 0, padding, duration: FLIGHT_MS, essential: true });
    map.once("moveend", () => {
      flying.current = false;
      const c = map.getCenter();
      latest.current.onMove({ lon: c.lng, lat: c.lat, zoom: map.getZoom() });
      done();
    });
  }

  function onSearch(hit: SearchHit) {
    if (hit.kind === "blklot") return select(hit.blklot, {});
    const { match } = hit;
    if (!match.blklot) {
      setPopup({ x: 24, y: 24, title: match.label, text: "The address list has no block/lot for this address." });
      return;
    }
    select(match.blklot, { center: [match.lon, match.lat] });
  }

  const hoverCoverage = hover ? zoningCoverage(hover.zoning) : null;
  return (
    <div className="map-screen" data-hidden={hidden || undefined} aria-hidden={hidden || undefined} inert={hidden || undefined}>
      <div ref={container} className="map" data-testid="map" />
      <div ref={tooltip} className="map-tooltip" role="status" hidden={!hover} data-testid="map-tooltip">
        {hover && (
          <>
            <strong>{hover.address ?? "No street address"}</strong>
            <span>
              Block/lot {hover.blklot} · {hover.zoning ?? "zoning not on record"}
              {hoverCoverage?.kind === "covered" && <> · {loadDistrict(hoverCoverage.code)?.name}</>}
            </span>
            <em>
              {hoverCoverage?.kind === "covered"
                ? "Click to see its envelope"
                : hoverCoverage?.kind === "unknown"
                  ? "Click to look up its zoning"
                  : coverageNote(hoverCoverage!)}
            </em>
          </>
        )}
      </div>
      {popup && (
        <div className="map-popup" style={{ left: popup.x, top: popup.y }} role="dialog" aria-label={popup.title} data-testid="map-popup">
          <strong>{popup.title}</strong>
          <p>{popup.text}</p>
          <button type="button" className="link" onClick={() => setPopup(null)}>
            Close
          </button>
        </div>
      )}
      <section className="map-panel" aria-label="Find a lot">
        <h1>Zoning Envelope Visualizer</h1>
        <p className="muted">Pick a San Francisco lot to watch each zoning rule carve the space above it down to what the code allows.</p>
        <SearchBox onPick={onSearch} />
        {tiles && !tiles.ok && (
          <p className="notice" data-testid="tiles-missing">
            The parcel map isn't built yet: run <code>pnpm build-tiles</code> (needs tippecanoe) and reload. Search still works.
          </p>
        )}
        <div className="map-tools">
          <button type="button" aria-pressed={tint} onClick={() => setTint((on) => !on)}>
            Zoning colors
          </button>
        </div>
        {tint && (
          <ul className="legend" data-testid="legend">
            {legend().map((entry) => (
              <li key={entry.label}>
                <span className="swatch" style={{ background: entry.color }} aria-hidden /> {entry.label}
              </li>
            ))}
          </ul>
        )}
        <details className="examples">
          <summary>Try one</summary>
          <ul>
            {EXAMPLES.map((ex) => (
              <li key={ex.id}>
                <a
                  href={`?parcel=${ex.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    select(ex.id, ex.at ? { center: ex.at } : {});
                  }}
                >
                  {ex.label}
                </a>{" "}
                <span className="muted">{ex.note}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}

/** Keeps the lot where the scene canvas will be: the left two-thirds on wide screens. */
function scenePadding(map: MapLibreMap): PaddingOptions {
  const { clientWidth: width } = map.getContainer();
  const side = width >= 900 ? Math.max(320, width / 3) : 0;
  return { top: 0, bottom: 0, left: 0, right: side };
}

/** Room around the lot, so its neighbors and the street show too. */
function lotPadding(map: MapLibreMap, base: PaddingOptions): PaddingOptions {
  const { clientWidth: width, clientHeight: height } = map.getContainer();
  const side = base.right ?? 0;
  const free = width - side;
  return { top: height * 0.32, bottom: height * 0.32, left: free * 0.32, right: side + free * 0.32 };
}

function boundsOf(feature: MapGeoJSONFeature): LngLatBounds {
  const bounds = new LngLatBounds();
  const visit = (geometry: Geometry) => {
    if (geometry.type === "Polygon") geometry.coordinates.flat().forEach((p) => bounds.extend([p[0]!, p[1]!]));
    else if (geometry.type === "MultiPolygon") geometry.coordinates.flat(2).forEach((p) => bounds.extend([p[0]!, p[1]!]));
  };
  visit(feature.geometry);
  return bounds;
}

