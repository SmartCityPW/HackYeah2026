"""Geografia bez zależności od GDAL: odległość (haversine) i prostokąt widoku mapy (bbox)."""
from __future__ import annotations

import math
from dataclasses import dataclass

EARTH_RADIUS_M = 6_371_000


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Odległość w metrach między dwoma punktami."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi, dlmb = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


@dataclass(frozen=True)
class BBox:
    min_lng: float
    min_lat: float
    max_lng: float
    max_lat: float


def parse_bbox(raw: str) -> BBox:
    """Parsuje 'minLng,minLat,maxLng,maxLat'. Rzuca ValueError przy błędnym formacie."""
    try:
        min_lng, min_lat, max_lng, max_lat = (float(x) for x in raw.split(','))
    except ValueError as exc:
        raise ValueError('bbox: oczekiwano czterech liczb "minLng,minLat,maxLng,maxLat"') from exc
    if not (-90 <= min_lat <= max_lat <= 90 and -180 <= min_lng <= max_lng <= 180):
        raise ValueError('bbox: współrzędne poza zakresem albo odwrócone')
    return BBox(min_lng, min_lat, max_lng, max_lat)
