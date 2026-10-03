import { circleRing, distanceMeters, isWithin, offsetMeters } from './geo.utils';

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters({ lat: 50, lng: 19 }, { lat: 50, lng: 19 })).toBe(0);
  });

  it('measures about 111 km per degree of latitude', () => {
    const d = distanceMeters({ lat: 50, lng: 19 }, { lat: 51, lng: 19 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('offsetMeters', () => {
  it('moves the point by the requested distance', () => {
    const origin = { lat: 50.0617, lng: 19.9373 };
    expect(distanceMeters(origin, offsetMeters(origin, 30, 40))).toBeCloseTo(50, 0);
  });
});

describe('isWithin', () => {
  const user = { lat: 50.0617, lng: 19.9373 };

  it('accepts targets inside the radius and rejects those outside', () => {
    expect(isWithin(user, offsetMeters(user, 49, 0), 50)).toBe(true);
    expect(isWithin(user, offsetMeters(user, 0, 51), 50)).toBe(false);
  });
});

describe('circleRing', () => {
  it('is closed and keeps every vertex at the radius', () => {
    const center = { lat: 50.0617, lng: 19.9373 };
    const ring = circleRing(center, 50, 16);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    for (const [lng, lat] of ring) expect(distanceMeters(center, { lat, lng })).toBeCloseTo(50, 0);
  });
});
