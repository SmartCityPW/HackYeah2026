import { distanceMeters } from './geo.utils';

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
