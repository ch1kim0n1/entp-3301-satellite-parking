from pathlib import Path

import geopandas as gpd
import osmnx as ox
import pandas as pd
from shapely.geometry import Polygon, box, mapping, shape
from shapely.geometry.base import BaseGeometry

from shared.coordinates import transform_geom

CACHE_DIR = Path(__file__).resolve().parent / "data"
CACHE_DIR.mkdir(exist_ok=True)


def load_cached_parking_lots():
    """Return every mapped UTD parking/garage area for the interactive map."""
    path = CACHE_DIR / "utd_parking.geojson"
    if not path.exists():
        return []

    try:
        gdf = gpd.read_file(path)
    except Exception:
        return []

    lots = []
    for index, row in gdf.iterrows():
        geometry = row.geometry
        if geometry is None or geometry.is_empty:
            continue
        name = _clean_property(row.get("name"))
        short_name = _clean_property(row.get("short_name"))
        capacity = _clean_property(row.get("capacity"))
        parking_type = _clean_property(row.get("parking"))
        for polygon in _flatten(geometry):
            lots.append(
                {
                    "id": str(row.get("id", index)),
                    "name": name or short_name or f"Parking area {index}",
                    "short_name": short_name,
                    "capacity": capacity,
                    "kind": "garage" if parking_type == "multi-storey" else "outdoor",
                    "polygon": mapping(polygon),
                }
            )
    return lots


def _clean_property(value):
    """Turn pandas/NumPy missing scalar values into JSON-safe ``None``."""
    if value is None or pd.isna(value):
        return None
    return value.item() if hasattr(value, "item") else value


def load_parking_areas(aoi_wgs84: Polygon, spot_cell_size_m: float = 4.0, use_cache: bool = True):
    """Load parking spots for an AOI.

    Priority:
      1. amenity=parking_space features (real mapped spaces)
      2. amenity=parking lots, subdivided into a grid of cells
      3. cached UTD lots file if present
    """
    if use_cache:
        # The repository ships these two files, so prefer them before making an
        # Overpass request. This keeps the UTD demo usable without internet.
        cached_spaces = _load_cached_areas(aoi_wgs84, ("utd_parking_space.geojson",))
        if cached_spaces is not None:
            spots = _gdf_to_spots(cached_spaces)
            # The bundled UTD file has a handful of explicitly mapped spaces,
            # but that sparse coverage is not a useful per-lot overlay.  Use
            # it only when it can actually represent a parking area; otherwise
            # continue to the lot-grid fallback below.
            if len(spots) >= 25:
                return spots

        cached_lots = _load_cached_areas(aoi_wgs84, ("utd_parking.geojson",))
        if cached_lots is not None:
            return _gridify_lots(cached_lots, spot_cell_size_m, aoi_wgs84)

    spaces = _fetch_features(aoi_wgs84, {"amenity": ["parking_space"]})
    if len(spaces):
        return _gdf_to_spots(spaces)

    lots = _fetch_features(aoi_wgs84, {"amenity": ["parking"]})
    if len(lots):
        return _gridify_lots(lots, spot_cell_size_m, aoi_wgs84)

    return []


def _load_cached_areas(aoi_wgs84: Polygon, names: tuple[str, ...]):
    for name in names:
        path = CACHE_DIR / name
        if not path.exists():
            continue
        try:
            gdf = gpd.read_file(path)
        except Exception:
            continue
        gdf = gdf[gdf.intersects(aoi_wgs84)]
        if len(gdf):
            return gdf
    return None


def _fetch_features(polygon_wgs84: Polygon, tags: dict) -> gpd.GeoDataFrame:
    try:
        gdf = ox.features_from_polygon(polygon_wgs84, tags=tags)
    except Exception:
        return gpd.GeoDataFrame()
    if len(gdf) == 0:
        return gdf
    return gdf.to_crs("EPSG:4326")


def _gdf_to_spots(gdf: gpd.GeoDataFrame):
    spots = []
    for i, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        for poly in _flatten(geom):
            spots.append({"id": f"spot-{len(spots)}", "polygon": poly})
    return spots


def _gridify_lots(
    gdf: gpd.GeoDataFrame,
    cell_size_m: float,
    clip_to: Polygon | None = None,
):
    spots = []
    for i, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        for lot in _flatten(geom):
            if clip_to is not None:
                lot = lot.intersection(clip_to)
            if lot.is_empty:
                continue
            for cell in _grid_cells(lot, cell_size_m):
                spots.append({"id": f"lot-{i}-cell-{len(spots)}", "polygon": cell})
    return spots


def _flatten(geom: BaseGeometry):
    if geom.geom_type == "Polygon":
        yield geom
    elif geom.geom_type in ("MultiPolygon", "GeometryCollection"):
        for g in geom.geoms:
            if g.geom_type == "Polygon":
                yield g


def _grid_cells(lot_wgs84: Polygon, cell_size_m: float):
    local_crs = gpd.GeoSeries([lot_wgs84], crs="EPSG:4326").estimate_utm_crs()
    local = transform_geom(lot_wgs84, "EPSG:4326", local_crs)
    minx, miny, maxx, maxy = local.bounds
    x = minx
    while x < maxx:
        y = miny
        while y < maxy:
            cell = box(x, y, x + cell_size_m, y + cell_size_m)
            if cell.intersects(local):
                clipped = cell.intersection(local)
                if not clipped.is_empty and clipped.area > 0:
                    yield transform_geom(clipped, local_crs, "EPSG:4326")
            y += cell_size_m
        x += cell_size_m
