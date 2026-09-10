"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Chip,
  ProgressBar,
  Separator,
  Spinner,
} from "@heroui/react";
import { motion } from "framer-motion";

type MapLibreMap = import("maplibre-gl").Map;
type MapLibreDraw = import("maplibre-gl-draw");

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type Spot = {
  id: string;
  polygon: GeoJSONPolygon;
  occupied: boolean;
  confidence: number;
};

type AnalyzeResponse = {
  capture_time: string;
  image_id: string;
  spots: Spot[];
  feature_collection: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: { spot_id: string; occupied: boolean; confidence: number };
      geometry: GeoJSONPolygon;
    }>;
  };
};

const UTD_CENTER: [number, number] = [-96.75, 32.985];

export default function Home() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const drawRef = useRef<MapLibreDraw | null>(null);
  const [selectedPolygon, setSelectedPolygon] = useState<GeoJSONPolygon | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearSpots = () => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("spaces-fill")) map.removeLayer("spaces-fill");
    if (map.getLayer("spaces-outline")) map.removeLayer("spaces-outline");
    if (map.getSource("spaces")) map.removeSource("spaces");
    setResult(null);
  };

  const renderSpots = (featureCollection: AnalyzeResponse["feature_collection"]) => {
    const map = mapRef.current;
    if (!map) return;
    clearSpots();
    map.addSource("spaces", { type: "geojson", data: featureCollection });
    map.addLayer({
      id: "spaces-fill",
      type: "fill",
      source: "spaces",
      paint: {
        "fill-color": [
          "case",
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
      const maplibregl = await import("maplibre-gl");
      const { default: MapboxDraw } = await import("maplibre-gl-draw");
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
          },
          layers: [
            { id: "satellite", type: "raster", source: "satellite" },
          ],
        },
        center: UTD_CENTER,
        zoom: 16,
      });
      mapRef.current = map;

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: "draw_polygon",
      });
      drawRef.current = draw;
      map.addControl(draw as unknown as import("maplibre-gl").IControl, "top-left");

      const syncPolygon = () => {
        const feats = draw.getAll();
        const poly = feats.features.find((f) => f.geometry.type === "Polygon");
        setSelectedPolygon(poly ? (poly.geometry as GeoJSONPolygon) : null);
      };

      (map as any).on("draw.create", syncPolygon);
      (map as any).on("draw.update", syncPolygon);
      (map as any).on("draw.delete", () => {
        setSelectedPolygon(null);
        clearSpots();
      });
    };

    init();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  const analyze = async () => {
    if (!selectedPolygon) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geometry: selectedPolygon,
          provider: "static_test",
        }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data: AnalyzeResponse = await res.json();
      setResult(data);
      renderSpots(data.feature_collection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      setLoading(false);
    }
  };

  const total = result?.spots.length ?? 0;
  const occupied = result?.spots.filter((s) => s.occupied).length ?? 0;
  const free = total - occupied;
  const occupancyRate = total ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <div ref={mapEl} className="absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute left-4 top-4 z-10 w-[420px]"
      >
        <Card className="bg-background/80 backdrop-blur-md border border-default-200/50">
          <Card.Header className="flex flex-col items-start gap-1">
            <Card.Title className="text-xl font-bold tracking-tight">
              Satellite Parking
            </Card.Title>
            <Card.Description>
              Draw a parking lot polygon, then analyze occupancy.
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <Button
              variant="primary"
              onPress={analyze}
              isDisabled={!selectedPolygon || loading}
              fullWidth
            >
              {loading ? <Spinner size="sm" /> : "Analyze parking lot"}
            </Button>

            {error && (
              <Chip color="danger" variant="soft" className="text-xs">
                {error}
              </Chip>
            )}

            <Separator />

            <div className="flex flex-wrap gap-2">
              <Chip color="danger" variant="soft">
                {occupied} occupied
              </Chip>
              <Chip color="success" variant="soft">
                {free} free
              </Chip>
              <Chip color="default" variant="soft">
                {total} spaces
              </Chip>
            </div>

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
          </Card.Content>
        </Card>
      </motion.div>

      {result && (
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute right-4 top-4 z-10 w-[380px] max-h-[80vh]"
        >
          <Card className="bg-background/80 backdrop-blur-md border border-default-200/50 h-full">
            <Card.Header>
              <Card.Title>Spots</Card.Title>
            </Card.Header>
            <Card.Content className="overflow-y-auto">
              <div className="flex flex-col gap-2">
                {result.spots.map((spot) => (
                  <div
                    key={spot.id}
                    className="flex items-center justify-between rounded-lg border border-default-200/40 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-default-500">
                      {spot.id}
                    </span>
                    <Chip
                      size="sm"
                      color={spot.occupied ? "danger" : "success"}
                      variant="soft"
                    >
                      {spot.occupied ? "Occupied" : "Free"}
                    </Chip>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
