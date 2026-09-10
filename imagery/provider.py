from abc import ABC, abstractmethod
from rasterio.io import DatasetReader
import rasterio


class ImageryProvider(ABC):
    @abstractmethod
    def get_image(self, polygon_wgs84) -> DatasetReader:
        """Return an open rasterio DatasetReader for the requested AOI."""
        ...


class StaticTestProvider(ImageryProvider):
    def __init__(self, path: str):
        self.path = path

    def get_image(self, polygon_wgs84) -> DatasetReader:
        return rasterio.open(self.path)
