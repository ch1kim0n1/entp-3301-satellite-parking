"""Fetch UTD parking lots and spaces from OpenStreetMap and cache locally."""

import geopandas as gpd
import osmnx as ox
from pathlib import Path
from shapely.geometry import box

from shared.coordinates import transform_geom

OUT_DIR = Path(__file__).resolve().parent / "data"
OUT_DIR.mkdir(exist_ok=True)

UTD_BBOX_WGS84 = box(-96.76, 32.975, -96.74, 32.995)


def main():
    for tag_name, tags in (
        ("parking_space", {"amenity": ["parking_space"]}),
        ("parking", {"amenity": ["parking"]}),
    ):
        try:
            gdf = ox.features_from_polygon(UTD_BBOX_WGS84, tags=tags)
        except Exception as exc:
            print(f"{tag_name}: failed ({exc})")
            continue
        if len(gdf) == 0:
            print(f"{tag_name}: no features")
            continue
        path = OUT_DIR / f"utd_{tag_name}.geojson"
        gdf.to_crs("EPSG:4326").to_file(path, driver="GeoJSON")
        print(f"saved {len(gdf)} features to {path}")


if __name__ == "__main__":
    main()
