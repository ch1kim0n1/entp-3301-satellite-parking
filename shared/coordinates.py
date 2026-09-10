import pyproj
from shapely.geometry import shape, mapping
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform as shapely_transform


def transform_geom(geom, src_crs, dst_crs):
    """Transform a shapely geometry or GeoJSON dict between CRSs."""
    if isinstance(geom, dict):
        geom = shape(geom)
    transformer = pyproj.Transformer.from_crs(src_crs, dst_crs, always_xy=True)
    return shapely_transform(transformer.transform, geom)


def crs_geom_to_pixel_geom(geom, dataset):
    """Project a geometry in the dataset CRS into image pixel coordinates."""
    inv = ~dataset.transform

    def _xy(x, y, z=None):
        px, py = inv * (x, y)
        return (px, py) if z is None else (px, py, z)

    return shapely_transform(_xy, geom)


def pixel_geom_to_wgs84(geom, dataset):
    """Project a geometry in image pixel coordinates back to WGS84."""
    def _xy(x, y, z=None):
        cx, cy = dataset.transform * (x + 0.5, y + 0.5)
        return (cx, cy) if z is None else (cx, cy, z)

    geom_crs = shapely_transform(_xy, geom)
    return transform_geom(geom_crs, dataset.crs, "EPSG:4326")


def wgs84_geom_to_pixel_geom(geom, dataset):
    """WGS84 GeoJSON -> dataset CRS -> pixel coords."""
    geom_crs = transform_geom(geom, "EPSG:4326", dataset.crs)
    return crs_geom_to_pixel_geom(geom_crs, dataset)


def pixel_geom_to_geojson(geom, dataset):
    """Pixel coords -> WGS84 GeoJSON dict."""
    return mapping(pixel_geom_to_wgs84(geom, dataset))
