"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  ProgressBar,
  Separator,
  Spinner,
} from "@heroui/react";
import { motion } from "framer-motion";

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
  source: "live_utd_feed" | "saved_utd_snapshot";
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

  const analyze = async (polygon = selectedPolygon) => {
    if (!polygon) return;
    setLoading(true);
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
      setLoading(false);
    }
  };

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

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <div ref={mapEl} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-slate-950/15" />
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
              return (
                <path
                  key={feature.properties.lot_id}
                  d={lotPath(feature)}
                  fill={isGarage ? "#a855f7" : "#fbbf24"}
                  fillOpacity="0.48"
                  stroke={isGarage ? "#6d28d9" : "#b45309"}
                  strokeWidth="3"
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
                  const status = slot.properties.occupied === true ? "occupied" : slot.properties.occupied === false ? "free" : "status unavailable";
                  const color = slot.properties.occupied === true ? "#ef4444" : slot.properties.occupied === false ? "#22c55e" : "#94a3b8";
                  return (
                    <path
                      key={slot.properties.spot_id}
                      d={polygonPath(slot.geometry)}
                      fill={color}
                      fillOpacity="0.7"
                      stroke="#f8fafc"
                      strokeWidth="1"
                    >
                      <title>{`Space ${slot.properties.spot_id}: ${status}`}</title>
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

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute left-6 top-6 z-10 w-[min(360px,calc(100vw-3rem))] max-h-[calc(100vh-3rem)] overflow-y-auto pr-1"
      >
        <Card className="overflow-hidden rounded-md border border-slate-700 bg-slate-950 text-slate-50 shadow-lg shadow-slate-950/50">
          <Card.Header className="relative flex flex-col items-start gap-3 border-b border-slate-700 bg-slate-900 px-4 py-4">
            <div className="flex w-full items-center justify-between gap-3">
              <div className="border-l-2 border-amber-400 pl-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">UTD campus</p>
                <Card.Title className="text-xl font-semibold tracking-tight text-white">Parking map</Card.Title>
              </div>
              <span className="border border-emerald-800 bg-emerald-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Ready</span>
            </div>
            <Card.Description className="text-sm text-slate-300">
              Click a zone to zoom in; double-click to reveal individual spaces.
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3 px-4 py-4">
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => void analyze()}
                isDisabled={!selectedPolygon || loading}
                className="flex-1 rounded-md bg-blue-600 font-semibold text-white shadow-none hover:bg-blue-500"
              >
                {loading ? <Spinner size="sm" /> : "Analyze parking lot"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setSelectedPolygon(UTD_SAMPLE_LOT);
                  clearSpots();
                  setError(null);
                }}
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
              >
                Load sample lot
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-slate-800 py-3 text-[11px] text-slate-300">
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-amber-400" />Outdoor lots</div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-purple-400" />Garages</div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 bg-slate-300" />Space grid</div>
            </div>

            {selectedLot && (
              <div className="border-l-2 border-blue-500 bg-slate-900 p-3 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Selected zone</p>
                <p className="mt-1 font-semibold text-white">{selectedLot.name}</p>
                {selectedLot.kind === "garage" ? (
                  <p className="mt-1 text-slate-300">
                    <span className="font-semibold text-emerald-300">{garageAvailability?.garages.find((garage) => garage.id === selectedLot.short_name)?.available_spaces ?? "—"} free</span> spaces in the garage feed.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-slate-300">
                      Double-click this zone to display its individual spaces. Current occupancy requires fresh aerial imagery.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 rounded-md border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                      onClick={() => {
                        const feature = parkingLots.find((lot) => lot.properties.lot_id === selectedLot.lot_id);
                        if (feature) openLotSlots(feature);
                      }}
                    >
                      Show individual spaces
                    </Button>
                  </>
                )}
              </div>
            )}

            {selectedSlot && (
              <div className="border-l-2 border-slate-400 bg-slate-900 p-3 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">Selected space</p>
                <p className="mt-1 font-semibold text-white">Space {selectedSlot.spot_id}</p>
                <p className="mt-1 text-slate-300">
                  {selectedSlot.occupied === true ? "Occupied" : selectedSlot.occupied === false ? "Free" : "Current status unavailable — the bundled aerial image is historical."}
                </p>
              </div>
            )}

            <div className="border border-slate-700 bg-slate-900 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Availability feed</p>
                  <span className="text-sm font-semibold text-white">UTD garages</span>
                </div>
                <Button size="sm" variant="ghost" className="rounded-md text-blue-300 hover:bg-slate-800" onClick={loadGarageAvailability}>
                  Refresh
                </Button>
              </div>
              {garageAvailability ? (
                <>
                  <span className={`inline-flex border px-2 py-1 text-[11px] font-medium ${garageAvailability.is_live ? "border-emerald-800 bg-emerald-950 text-emerald-300" : "border-amber-800 bg-amber-950 text-amber-300"}`}>
                    {garageAvailability.is_live ? "Live UTD feed" : "Saved UTD snapshot"}
                  </span>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {garageAvailability.garages.map((garage) => (
                      <div key={garage.id} className="border border-slate-700 bg-slate-950 px-2 py-2 text-center">
                        <div className="text-xs font-medium text-slate-400">{garage.id}</div>
                        <div className="mt-0.5 font-semibold text-emerald-300">{garage.available_spaces} free</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <span className="text-xs text-default-500">Loading official garage availability…</span>
              )}
              {garageError && <p className="mt-2 text-xs text-danger">{garageError}</p>}
            </div>

            {error && (
              <span className="border border-rose-800 bg-rose-950 px-2 py-1 text-xs text-rose-200">
                {error}
              </span>
            )}

            <Separator className="bg-slate-700" />

            {result ? (
              <div className="grid grid-cols-2 gap-2 border border-slate-700 bg-slate-900 p-2 text-xs font-medium">
                <span className="border border-rose-800 bg-rose-950 px-2 py-1.5 text-rose-200">{occupied} occupied</span>
                <span className="border border-emerald-800 bg-emerald-950 px-2 py-1.5 text-emerald-200">{free} free</span>
                <span className="border border-slate-600 bg-slate-800 px-2 py-1.5 text-slate-200">{total} spaces</span>
                {uncertain > 0 && (
                  <span className="border border-slate-600 bg-slate-800 px-2 py-1.5 text-slate-200">{uncertain} uncertain</span>
                )}
              </div>
            ) : (
              <div className="border-l-2 border-amber-500 bg-slate-900 px-3 py-2 text-xs text-slate-300">
                <span className="font-semibold text-amber-300">Tip:</span> click a colored zone to inspect it, or draw a custom parking area.
              </div>
            )}

            {total > 0 && (
              <ProgressBar
                value={occupancyRate}
                color="danger"
                aria-label="Occupancy"
                className="w-full"
              >
                <ProgressBar.Output>{occupancyRate}% occupied</ProgressBar.Output>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            )}

            {result?.detected_vehicles === 0 && total > 0 && (
              <p className="text-xs text-warning">
                No vehicles were detected in this historic image, so the space labels are uncertain rather than marked free.
              </p>
            )}
          </Card.Content>
        </Card>
      </motion.div>

      {result && (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-6 top-6 z-10 w-[min(300px,calc(100vw-3rem))] max-h-[60vh]"
        >
          <Card className="h-full overflow-hidden rounded-md border border-slate-700 bg-slate-950 text-slate-50 shadow-lg shadow-slate-950/50">
            <Card.Header className="border-b border-slate-700 bg-slate-900 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Space analysis</p>
              <Card.Title className="text-base text-white">Individual parking cells</Card.Title>
            </Card.Header>
            <Card.Content className="overflow-y-auto px-3 py-3">
              <div className="flex flex-col gap-2">
                {result.spots.slice(0, 80).map((spot) => (
                  <div
                    key={spot.id}
                    className="flex items-center justify-between border border-slate-700 bg-slate-900 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-slate-400">
                      {spot.id}
                    </span>
                    <span className={`border px-2 py-1 text-[11px] font-medium ${spot.occupied === true ? "border-rose-800 bg-rose-950 text-rose-200" : spot.occupied === false ? "border-emerald-800 bg-emerald-950 text-emerald-200" : "border-slate-600 bg-slate-800 text-slate-300"}`}>
                      {spot.occupied === true ? "Occupied" : spot.occupied === false ? "Free" : "Uncertain"}
                    </span>
                  </div>
                ))}
                {result.spots.length > 80 && (
                  <p className="px-2 py-1 text-center text-xs text-slate-400">Showing the first 80 of {result.spots.length} spaces. Zoom in and select a cell on the map for details.</p>
                )}
              </div>
            </Card.Content>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
