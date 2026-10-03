import { Position } from './game.model';

const EARTH_RADIUS_M = 6_371_000;
const METERS_PER_DEG_LAT = 111_320;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Odległość w metrach między dwoma punktami (wzór haversine). */
export function distanceMeters(a: Position, b: Position): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Przesunięcie o `dn` metrów na północ i `de` metrów na wschód (przybliżenie wystarczające na setki metrów). */
export function offsetMeters(origin: Position, dn: number, de: number): Position {
  return {
    lat: origin.lat + dn / METERS_PER_DEG_LAT,
    lng: origin.lng + de / (METERS_PER_DEG_LAT * Math.cos(rad(origin.lat))),
  };
}

/** Czy cel leży w kółku o promieniu `radiusM` wokół gracza. */
export function isWithin(user: Position, target: Position, radiusM: number): boolean {
  return distanceMeters(user, target) <= radiusM;
}

/** Wielokąt przybliżający okrąg o promieniu `radiusM` (pierścień GeoJSON [lng, lat], zamknięty). */
export function circleRing(center: Position, radiusM: number, steps = 64): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const p = offsetMeters(center, radiusM * Math.cos(a), radiusM * Math.sin(a));
    ring.push([p.lng, p.lat]);
  }
  return ring;
}
