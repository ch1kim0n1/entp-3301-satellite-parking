from pathlib import Path
from typing import Any, Iterable

import geopandas as gpd
import osmnx as ox
from shapely.geometry import Polygon, box, shape
from shapely.geometry.base import BaseGeometry

from shared.coordinates import transform_geom

CACHE_DIR = Path(__file__).resolve().parent / "data"
CACHE_DIR.mkdir(exist_ok=True)


def load_parking_areas(aoi_wgs84: Polygon, spot_cell_size_m: float = 4.0, use_cache: bool = True):
    """Load parking spots for an AOI.

    Priority:
      1. amenity=parking_space features (real mapped spaces)
      2. amenity=parking lots, subdivided into a grid of cells
      3. cached UTD lots file if present
    """
    if use_cache:
        cached = _load_cached_areas(aoi_wgs84)
        if cached is not None:
            return _spots_from_cache(cached, spot_cell_size_m)

    spaces = _fetch_features(aoi_wgs84, {"amenity": ["parking_space"]})
    if len(spaces):
        return _gdf_to_spots(spaces)

    lots = _fetch_features(aoi_wgs84, {"amenity": ["parking"]})
    if len(lots):
        return _gridify_lots(lots, spot_cell_size_m)

    return []


def _load_cached_areas(aoi_wgs84: Polygon):
    for name in ("utd_parking_spaces.geojson", "utd_parking_lots.geojson"):
        path = CACHE_DIR / name
        if not path.exists():
            continue
        gdf = gpd.read_file(path)
        gdf = gdf[gdf.intersects(aoi_wgs84)]
        if len(gdf):
            return gdf
    return None


def _spots_from_cache(gdf, spot_cell_size_m: float):
    if "parking_space" in (gdf.get("amenity") or ""):
        return _gdf_to_spots(gdf)
    return _gridify_lots(gdf, spot_cell_size_m)


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


def _gridify_lots(gdf: gpd.GeoDataFrame, cell_size_m: float):
    spots = []
    for i, row in gdf.iterrows():
        geom = row.geometry
        if geom is None or geom.is_empty:
            continue
        for lot in _flatten(geom):
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
