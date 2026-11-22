"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Button } from "../kit/Button";
import { Notice } from "../kit/Notice";
import { Progress } from "../kit/Progress";
import { Skeleton } from "../kit/Skeleton";
import { StatusTag } from "../kit/StatusTag";

type MapLibreMap = import("maplibre-gl").Map;
type MapLibreDraw = import("maplibre-gl-draw");

type DrawEventMap = MapLibreMap & {
  on: (event: "draw.create" | "draw.update" | "draw.delete", listener: () => void) => unknown;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type Spot = {
  id: string;
  polygon: GeoJSONPolygon;
  occupied: boolean | null;
  confidence: number;
};

type AnalyzeResponse = {
  capture_time: string | null;
  analyzed_at: string;
  image_id: string;
  imagery_source: string;
  imagery_is_current: boolean;
  spots: Spot[];
  detected_vehicles: number;
  is_demo?: boolean;
  feature_collection: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: { spot_id: string; occupied: boolean | null; confidence: number };
      geometry: GeoJSONPolygon;
    }>;
  };
};

type GarageAvailability = {
  source: "live_utd_feed" | "saved_utd_snapshot" | "simulated_demo";
  is_live: boolean;
  fetched_at: string;
  garages: Array<{
    id: string;
    available_spaces: number;
    last_checked: string | null;
  }>;
};

type ParkingLotProperties = {
  lot_id: string;
  name: string;
  short_name: string | null;
  capacity: string | number | null;
  kind: "garage" | "outdoor";
};

type ParkingLotFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: ParkingLotProperties;
    geometry: GeoJSONPolygon;
  }>;
};

type ParkingLotFeature = ParkingLotFeatureCollection["features"][number];
type SlotFeature = AnalyzeResponse["feature_collection"]["features"][number];

const UTD_CENTER: [number, number] = [-96.75, 32.985];
const UTD_CAMPUS_BOUNDS: [[number, number], [number, number]] = [
  [-96.762, 32.977],
  [-96.738, 32.9975],
];
const UTD_NAVIGATION_BOUNDS: [[number, number], [number, number]] = [
  [-96.765, 32.9755],
  [-96.736, 32.999],
];
const UTD_CAMPUS_BOUNDARY: GeoJSONPolygon = {
  type: "Polygon",
  coordinates: [[
    [-96.762, 32.977],
    [-96.738, 32.977],
    [-96.738, 32.9975],
    [-96.762, 32.9975],
    [-96.762, 32.977],
  ]],
};
const UTD_CAMPUS_MASK = {
  type: "FeatureCollection" as const,
  features: [{
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
        [...UTD_CAMPUS_BOUNDARY.coordinates[0]].reverse(),
      ],
    },
  }],
};
const UTD_SAMPLE_LOT: GeoJSONPolygon = {
  type: "Polygon",
  coordinates: [[
    [-96.7546, 32.9927],
    [-96.7540, 32.9927],
    [-96.7540, 32.9922],
    [-96.7546, 32.9922],
    [-96.7546, 32.9927],
  ]],
};

function AnimatedNumber({ value }: { value: number }) {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (latest) => Math.round(latest).toString());
  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.24, ease: "linear" });
    return () => controls.stop();
  }, [value, motionValue]);
  return <motion.span>{text}</motion.span>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-sunken px-3 py-2">
      <div className="font-mono text-label-mono uppercase text-text-muted">{label}</div>
      <div className={`text-h2 font-medium tabular-nums ${tone}`}><AnimatedNumber value={value} /></div>
    </div>
  );
}

export default function Home() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<MapLibreDraw | null>(null);
  const [selectedPolygon, setSelectedPolygon] = useState<GeoJSONPolygon | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [garageAvailability, setGarageAvailability] = useState<GarageAvailability | null>(null);
  const [garageError, setGarageError] = useState<string | null>(null);
  const [selectedLot, setSelectedLot] = useState<ParkingLotProperties | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLotFeature[]>([]);
  const [slotFeatures, setSlotFeatures] = useState<SlotFeature[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotFeature["properties"] | null>(null);
  const [mapViewport, setMapViewport] = useState({ width: 0, height: 0 });
  const [mapCamera, setMapCamera] = useState({ center: UTD_CENTER, zoom: 15 });

  const clearSpots = (clearResult = true) => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("spaces-fill")) map.removeLayer("spaces-fill");
    if (map.getLayer("spaces-outline")) map.removeLayer("spaces-outline");
    if (map.getSource("spaces")) map.removeSource("spaces");
    setSlotFeatures([]);
    setSelectedSlot(null);
    if (clearResult) setResult(null);
  };

  const renderSpots = (featureCollection: AnalyzeResponse["feature_collection"]) => {
    const map = mapRef.current;
    if (!map) {
      setSlotFeatures(featureCollection.features);
      return;
    }
    clearSpots(false);
    setSlotFeatures(featureCollection.features);
    map.addSource("spaces", { type: "geojson", data: featureCollection });
    map.addLayer({
      id: "spaces-fill",
      type: "fill",
      source: "spaces",
      paint: {
        "fill-color": [
          "case",
          ["==", ["get", "occupied"], null], "#9ca3af",
          ["==", ["get", "occupied"], true], "#ef4444",
          ["==", ["get", "occupied"], false], "#22c55e",
          "#9ca3af",
        ],
        "fill-opacity": 0.55,
      },
    });
    map.addLayer({
      id: "spaces-outline",
      type: "line",
      source: "spaces",
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "occupied"], null], "#6b7280",
          ["==", ["get", "occupied"], true], "#dc2626",
          ["==", ["get", "occupied"], false], "#16a34a",
          "#6b7280",
        ],
        "line-width": 2,
      },
    });
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        const { default: MapboxDraw } = await import("maplibre-gl-draw");
        if (!mounted || !mapEl.current || mapRef.current) return;

        let parkingLots: ParkingLotFeatureCollection = { type: "FeatureCollection", features: [] };
        try {
          const response = await fetch(`${API_URL}/parking-lots`);
          if (!response.ok) throw new Error("Parking lots are unavailable");
          parkingLots = await response.json();
          setParkingLots(parkingLots.features);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Parking lots are unavailable");
        }
        if (!mounted || !mapEl.current || mapRef.current) return;

        const map = new maplibregl.Map({
          container: mapEl.current,
          style: {
            version: 8,
            sources: {
              satellite: {
                type: "raster",
                tiles: [
                  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                ],
                tileSize: 256,
                attribution: "Esri World Imagery",
              },
              "utd-campus-mask": {
                type: "geojson",
                data: UTD_CAMPUS_MASK,
              },
            },
            layers: [
              { id: "satellite", type: "raster", source: "satellite" },
              {
                id: "utd-campus-blackout",
                type: "fill",
                source: "utd-campus-mask",
                paint: { "fill-color": "#030712", "fill-opacity": 0.82 },
              },
              {
                id: "utd-campus-boundary",
                type: "line",
                source: "utd-campus-mask",
                paint: { "line-color": "#f59e0b", "line-width": 3, "line-opacity": 0.95 },
              },
            ],
          },
          center: UTD_CENTER,
          zoom: 14,
          minZoom: 12.5,
          // Zooming beyond 19 only magnifies the raster imagery; it does not
          // reveal more parking detail. Keep the useful upper limit instead.
          maxZoom: 19,
          maxBounds: UTD_NAVIGATION_BOUNDS,
        });
        map.on("error", (e) => console.error("map error", e));
        mapRef.current = map;
        const syncCamera = () => {
          const center = map.getCenter();
          setMapCamera({ center: [center.lng, center.lat], zoom: map.getZoom() });
        };
        map.on("move", syncCamera);
        map.on("load", () => {
          // Frame the complete parking footprint at launch, with room for the
          // left controls and a small campus-context margin on the other sides.
          const leftPadding = Math.min(420, Math.max(48, map.getContainer().clientWidth * 0.24));
          map.fitBounds(UTD_CAMPUS_BOUNDS, {
            padding: { top: 64, right: 64, bottom: 64, left: leftPadding },
            maxZoom: 14.2,
            duration: 0,
          });
        });

        const draw = new MapboxDraw({
          displayControlsDefault: false,
          controls: { polygon: true, trash: true },
          // Keep the map in selection mode: an outdoor/garage overlay must be
          // clickable without accidentally starting a custom polygon.
          defaultMode: "simple_select",
        });
        drawRef.current = draw;
        map.addControl(draw as unknown as import("maplibre-gl").IControl, "top-left");
        map.addControl(new maplibregl.NavigationControl(), "bottom-right");

        const syncPolygon = () => {
          const feats = draw.getAll();
          const poly = feats.features.find((f) => f.geometry.type === "Polygon");
          setSelectedPolygon(poly ? (poly.geometry as GeoJSONPolygon) : null);
        };

        const drawEventMap = map as DrawEventMap;
        drawEventMap.on("draw.create", syncPolygon);
        drawEventMap.on("draw.update", syncPolygon);
        drawEventMap.on("draw.delete", () => {
          setSelectedPolygon(null);
          clearSpots();
        });

      } catch (err) {
        console.error("map init failed", err);
        setError(err instanceof Error ? err.message : "Map init failed");
      }
    };

    init();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  const loadGarageAvailability = async () => {
    try {
      const response = await fetch(`${API_URL}/garage-availability`);
      if (!response.ok) throw new Error("Garage availability is unavailable");
      setGarageAvailability(await response.json());
      setGarageError(null);
    } catch (err) {
      setGarageError(err instanceof Error ? err.message : "Garage availability is unavailable");
    }
  };

  useEffect(() => {
    const requestId = window.setTimeout(() => {
      void loadGarageAvailability();
    }, 0);
    return () => window.clearTimeout(requestId);
  }, []);

  useEffect(() => {
    const syncViewport = () => {
      const bounds = mapEl.current?.getBoundingClientRect();
      if (bounds) setMapViewport({ width: bounds.width, height: bounds.height });
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const analyze = async (polygon = selectedPolygon, quiet = false) => {
    if (!polygon) return;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geometry: polygon,
          provider: "static_test",
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data: AnalyzeResponse = await res.json();
      renderSpots(data.feature_collection);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  // Demo mode: re-poll so simulated spaces and garage counts keep moving.
  const isDemo = result?.is_demo || garageAvailability?.source === "simulated_demo";
  useEffect(() => {
    if (!isDemo) return;
    const id = window.setInterval(() => {
      void loadGarageAvailability();
      if (result?.is_demo && selectedPolygon) void analyze(selectedPolygon, true);
    }, 20000);
    return () => window.clearInterval(id);
    // analyze only reads setters; the polygon is passed explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, result?.is_demo, selectedPolygon]);

  const total = result?.spots.length ?? 0;
  const occupied = result?.spots.filter((s) => s.occupied === true).length ?? 0;
  const free = result?.spots.filter((s) => s.occupied === false).length ?? 0;
  const uncertain = total - occupied - free;
  const occupancyRate = occupied + free ? Math.round((occupied / (occupied + free)) * 100) : 0;

  const selectParkingLot = (feature: ParkingLotFeature) => {
    const coordinates = feature.geometry.coordinates[0];
    const longitudes = coordinates.map(([longitude]) => longitude);
    const latitudes = coordinates.map(([, latitude]) => latitude);
    mapRef.current?.fitBounds(
      [[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]],
      { padding: 96, maxZoom: 19, duration: 700 },
    );
    setSelectedLot(feature.properties);
    setSelectedPolygon(feature.geometry);
    clearSpots();
    setError(null);
  };

  const openLotSlots = (feature: ParkingLotFeature) => {
    selectParkingLot(feature);
    void analyze(feature.geometry);
  };

  const mapPoint = ([longitude, latitude]: [number, number]) => {
    const worldSize = 512 * 2 ** mapCamera.zoom;
    const project = (lng: number, lat: number) => [
      ((lng + 180) / 360) * worldSize,
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * worldSize,
    ];
    const [centerX, centerY] = project(mapCamera.center[0], mapCamera.center[1]);
    const [x, y] = project(longitude, latitude);
    return [mapViewport.width / 2 + x - centerX, mapViewport.height / 2 + y - centerY];
  };

  const polygonPath = (polygon: GeoJSONPolygon) => polygon.coordinates[0]
    .map((coordinate, index) => {
      const [x, y] = mapPoint(coordinate as [number, number]);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ") + " Z";

  const polygonBounds = (polygon: GeoJSONPolygon) => {
    const points = polygon.coordinates[0].map((coordinate) => mapPoint(coordinate as [number, number]));
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
  };

  const lotPath = (feature: ParkingLotFeature) => polygonPath(feature.geometry);
  const lotBounds = (feature: ParkingLotFeature) => polygonBounds(feature.geometry);

  const cellStatus = (occupiedState: boolean | null) =>
    occupiedState === true
      ? { tag: "error", label: "Occupied", fill: "var(--color-error)" }
      : occupiedState === false
        ? { tag: "success", label: "Free", fill: "var(--color-success)" }
        : { tag: "warning", label: "Uncertain", fill: "var(--color-text-muted)" };

  const eyebrow = "font-mono text-label-mono uppercase text-text-muted";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-canvas">
      <div ref={mapEl} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-canvas/15" />
      {mapViewport.width > 0 && (
        <>
          <svg
            aria-label="UTD parking zones"
            className="absolute inset-0 z-[1] h-full w-full"
            viewBox={`0 0 ${mapViewport.width} ${mapViewport.height}`}
            style={{ pointerEvents: "none" }}
          >
            {parkingLots.map((feature) => {
              const isGarage = feature.properties.kind === "garage";
              const isSelected = selectedLot?.lot_id === feature.properties.lot_id;
              return (
                <path
                  key={feature.properties.lot_id}
                  className="cell-path"
                  d={lotPath(feature)}
                  fill={isGarage ? "var(--color-series-3)" : "var(--color-warning)"}
                  fillOpacity={isSelected ? 0.62 : 0.4}
                  stroke={isGarage ? "var(--color-series-3)" : "var(--color-warning)"}
                  strokeWidth={isSelected ? 3 : 2}
                >
                  <title>{`${feature.properties.name} (${isGarage ? "garage" : "outdoor lot"})`}</title>
                </path>
              );
            })}
          </svg>
          <div className="contents">
            {parkingLots.map((feature) => {
              const bounds = lotBounds(feature);
              return (
                <button
                  key={feature.properties.lot_id}
                  type="button"
                  aria-label={`Select ${feature.properties.name}`}
                  className="absolute z-[2] cursor-pointer border-0 bg-transparent p-0"
                  style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
                  onClick={() => selectParkingLot(feature)}
                  onDoubleClick={() => openLotSlots(feature)}
                />
              );
            })}
          </div>
          {slotFeatures.length > 0 && (
            <>
              <svg
                aria-label="Individual parking spaces"
                className="absolute inset-0 z-[3] h-full w-full"
                viewBox={`0 0 ${mapViewport.width} ${mapViewport.height}`}
                style={{ pointerEvents: "none" }}
              >
                {slotFeatures.map((slot) => {
                  const status = cellStatus(slot.properties.occupied);
                  return (
                    <path
                      key={slot.properties.spot_id}
                      className="cell-path"
                      d={polygonPath(slot.geometry)}
                      fill={status.fill}
                      fillOpacity={0.72}
                      stroke="var(--color-text-primary)"
                      strokeOpacity={0.55}
                      strokeWidth="1"
                    >
                      <title>{`Space ${slot.properties.spot_id}: ${status.label}`}</title>
                    </path>
                  );
                })}
              </svg>
              <div className="contents">
                {slotFeatures.map((slot) => {
                  const bounds = polygonBounds(slot.geometry);
                  return (
                    <button
                      key={slot.properties.spot_id}
                      type="button"
                      aria-label={`Select space ${slot.properties.spot_id}`}
                      className="absolute z-[4] cursor-pointer border-0 bg-transparent p-0"
                      style={{ left: bounds.left, top: bounds.top, width: Math.max(bounds.width, 6), height: Math.max(bounds.height, 6) }}
                      onClick={() => setSelectedSlot(slot.properties)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      <motion.aside
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="absolute left-6 top-6 z-10 flex max-h-[calc(100vh-3rem)] w-[min(380px,calc(100vw-3rem))] flex-col gap-4 overflow-y-auto rounded-[var(--radius-card)] border border-border-default bg-surface p-5"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className={eyebrow}>UTD campus</p>
            <h1 className="mt-1 font-display text-h2 font-medium text-text-primary">Parking map</h1>
          </div>
          <StatusTag status={isDemo ? "warning" : "success"}>{isDemo ? "Demo mode" : "Ready"}</StatusTag>
        </header>
        <p className="text-small text-text-secondary">Click a zone to zoom in; double-click to reveal individual spaces.</p>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            busy={loading}
            busyLabel="Analyzing…"
            disabled={!selectedPolygon}
            onClick={() => void analyze()}
          >
            Analyze parking lot
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedPolygon(UTD_SAMPLE_LOT);
              clearSpots();
              setError(null);
              const sampleRing = UTD_SAMPLE_LOT.coordinates[0];
              const lngs = sampleRing.map(([lng]) => lng);
              const lats = sampleRing.map(([, lat]) => lat);
              mapRef.current?.fitBounds(
                [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                { padding: { top: 96, right: 340, bottom: 96, left: 460 }, maxZoom: 19, duration: 700 },
              );
            }}
          >
            Load sample lot
          </Button>
        </div>

        <ul className="grid grid-cols-3 gap-2 border-y border-border-default py-3 text-caption text-text-secondary">
          <li className="flex items-center gap-2"><span className="size-2.5 rounded-[var(--radius-dot)] bg-warning" />Outdoor lots</li>
          <li className="flex items-center gap-2"><span className="size-2.5 rounded-[var(--radius-dot)] bg-series-3" />Garages</li>
          <li className="flex items-center gap-2"><span className="size-2.5 rounded-[var(--radius-dot)] bg-text-secondary" />Space grid</li>
        </ul>

        <AnimatePresence initial={false}>
          {result?.is_demo && (
            <motion.div key="demo" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <Notice tone="warning" title="Demo mode: simulated data" live="status">
                Occupancy and garage counts are simulated for demonstration. They are not a real detection or a live feed.
              </Notice>
            </motion.div>
          )}
          {selectedLot && (
            <motion.div key={`lot-${selectedLot.lot_id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="rounded-lg border border-border-default border-l-2 border-l-border-strong bg-sunken p-3">
              <p className={eyebrow}>Selected zone</p>
              <p className="mt-1 text-body-ui font-medium text-text-primary">{selectedLot.name}</p>
              {selectedLot.kind === "garage" ? (
                <p className="mt-1 text-small text-text-secondary">
                  <span className="font-medium text-success">{garageAvailability?.garages.find((garage) => garage.id === selectedLot.short_name)?.available_spaces ?? "—"} free</span> spaces in the garage feed.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-small text-text-secondary">
                    Double-click this zone to display its individual spaces.
                    {!result?.is_demo && " Current occupancy requires fresh aerial imagery."}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-3 !min-h-9 !px-3 !py-1"
                    onClick={() => {
                      const feature = parkingLots.find((lot) => lot.properties.lot_id === selectedLot.lot_id);
                      if (feature) openLotSlots(feature);
                    }}
                  >
                    Show individual spaces
                  </Button>
                </>
              )}
            </motion.div>
          )}
          {selectedSlot && (
            <motion.div key={`slot-${selectedSlot.spot_id}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="rounded-lg border border-border-default border-l-2 border-l-border-strong bg-sunken p-3">
              <p className={eyebrow}>Selected space</p>
              <p className="mt-1 text-body-ui font-medium text-text-primary">Space {selectedSlot.spot_id}</p>
              <p className="mt-1 text-small text-text-secondary">
                {selectedSlot.occupied === null
                  ? "Current status unavailable. The bundled aerial image is historical."
                  : `${cellStatus(selectedSlot.occupied).label}${selectedSlot.confidence ? ` · ${Math.round(selectedSlot.confidence * 100)}% confidence` : ""}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="rounded-lg border border-border-default bg-sunken p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className={eyebrow}>Availability feed</p>
              <p className="text-body-ui font-medium text-text-primary">UTD garages</p>
            </div>
            <Button variant="quiet" className="!min-h-9 !px-3 !py-1 text-data" onClick={loadGarageAvailability}>
              Refresh
            </Button>
          </div>
          {garageAvailability ? (
            <>
              <StatusTag status={garageAvailability.is_live ? "success" : "warning"}>
                {garageAvailability.source === "simulated_demo" ? "Simulated demo data" : garageAvailability.is_live ? "Live UTD feed" : "Saved UTD snapshot"}
              </StatusTag>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {garageAvailability.garages.map((garage) => (
                  <div key={garage.id} className="rounded-lg border border-border-default bg-surface px-2 py-2 text-center">
                    <div className="text-caption font-medium text-text-muted">{garage.id}</div>
                    <div className="mt-0.5 text-body-ui font-medium tabular-nums text-success"><AnimatedNumber value={garage.available_spaces} /> free</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div role="status" aria-label="Loading garage availability" className="grid grid-cols-3 gap-2">
              <Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" />
            </div>
          )}
          {garageError && <p className="mt-2 text-small text-error">{garageError}</p>}
        </section>

        {error && <Notice tone="error" title="Something went wrong" live="alert">{error}</Notice>}

        {result ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Occupied" tone="text-error" value={occupied} />
              <Stat label="Free" tone="text-success" value={free} />
              <Stat label="Spaces" tone="text-text-primary" value={total} />
              {uncertain > 0 && <Stat label="Uncertain" tone="text-warning" value={uncertain} />}
            </div>
            {total > 0 && <Progress label="Occupancy" value={occupancyRate} />}
            {result.detected_vehicles === 0 && total > 0 && (
              <Notice tone="warning" title="No vehicles detected">
                The historic image shows no detectable vehicles, so space labels are uncertain rather than marked free.
              </Notice>
            )}
          </div>
        ) : (
          <Notice tone="data" title="Tip">Click a colored zone to inspect it, or draw a custom parking area.</Notice>
        )}
      </motion.aside>

      <AnimatePresence>
        {(result || loading) && (
          <motion.aside
            key="cells"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="absolute right-6 top-6 z-10 flex max-h-[60vh] w-[min(300px,calc(100vw-3rem))] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-default bg-surface"
          >
            <header className="border-b border-border-default bg-sunken px-4 py-3">
              <p className={eyebrow}>Space analysis</p>
              <h2 className="text-body-ui font-medium text-text-primary">Individual parking cells</h2>
            </header>
            <div className="overflow-y-auto px-3 py-3">
              {result ? (
                <ul className="flex flex-col gap-2">
                  {result.spots.slice(0, 80).map((spot, index) => {
                    const status = cellStatus(spot.occupied);
                    return (
                      <motion.li
                        key={spot.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, delay: Math.min(index, 14) * 0.02 }}
                        className="flex items-center justify-between rounded-lg border border-border-default bg-sunken px-3 py-2"
                      >
                        <span className="font-mono text-caption text-text-muted">{spot.id}</span>
                        <StatusTag status={status.tag} className="!px-2 !py-0.5">{status.label}</StatusTag>
                      </motion.li>
                    );
                  })}
                  {result.spots.length > 80 && (
                    <li className="px-2 py-1 text-center text-caption text-text-muted">
                      Showing the first 80 of {result.spots.length} spaces. Zoom in and select a cell on the map for details.
                    </li>
                  )}
                </ul>
              ) : (
                <div role="status" aria-label="Analyzing parking lot" className="flex flex-col gap-2">
                  {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11" />)}
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
