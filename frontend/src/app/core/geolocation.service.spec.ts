import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from './config/testing';
import { GeolocationService } from './geolocation.service';

type PositionCallback = (pos: GeolocationPosition) => void;

const reading = (lat: number, lng: number, accuracy: number, timestamp: number): GeolocationPosition =>
  ({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp }) as GeolocationPosition;

describe('GeolocationService (pozycja z danymi do weryfikacji przez serwer)', () => {
  let watchCallback: PositionCallback | undefined;
  let currentCallbacks: { ok: PositionCallback; fail: () => void; options: PositionOptions } | undefined;
  let nextFresh: GeolocationPosition | null = null;

  beforeEach(() => {
    watchCallback = undefined;
    currentCallbacks = undefined;
    nextFresh = null;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: (ok: PositionCallback) => {
          watchCallback = ok;
          return 1;
        },
        clearWatch: () => undefined,
        getCurrentPosition: (ok: PositionCallback, fail: () => void, options: PositionOptions) => {
          currentCallbacks = { ok, fail, options };
          if (nextFresh) ok(nextFresh);
          else fail();
        },
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation');
    history.replaceState({}, '', '/');
  });

  const setup = (dev = true) => {
    TestBed.configureTestingModule({ providers: [provideTestConfig({ dev: { tools: dev } })] });
    return TestBed.inject(GeolocationService);
  };

  it('reports a real GPS reading with its accuracy, time and source', () => {
    const geo = setup();
    geo.start();
    watchCallback!(reading(50.07, 19.99, 12, Date.parse('2026-10-10T10:00:00Z')));
    expect(geo.latLng()).toEqual({ lat: 50.07, lng: 19.99, accuracyM: 12, takenAt: '2026-10-10T10:00:00.000Z', source: 'gps' });
    expect(geo.isSimulated()).toBe(false);
  });

  it('marks a simulated position as simulated, without accuracy or reading time', () => {
    const geo = setup();
    geo.start();
    watchCallback!(reading(50.07, 19.99, 12, Date.now()));
    geo.simulate([19.9917, 50.0676]);
    expect(geo.latLng()).toEqual({ lat: 50.0676, lng: 19.9917, source: 'simulated' });
    expect(geo.isSimulated()).toBe(true);
    geo.walk(10, 0);
    expect(geo.latLng()?.source).toBe('simulated');
  });

  it('asks the browser for a fresh reading before an action, with the age and timeout from the configuration', async () => {
    const geo = setup();
    geo.start();
    watchCallback!(reading(50.07, 19.99, 30, Date.now() - 600_000)); // stary odczyt (nieruchome urządzenie)
    nextFresh = reading(50.0701, 19.9901, 7, Date.now());
    const fresh = await geo.fresh();
    expect(fresh).toMatchObject({ lat: 50.0701, lng: 19.9901, accuracyM: 7, source: 'gps' });
    expect(Date.now() - Date.parse(fresh!.takenAt!)).toBeLessThan(5_000);
    expect(currentCallbacks!.options).toMatchObject({
      enableHighAccuracy: true, maximumAge: TEST_CONFIG.game.gpsMaxAgeSeconds * 1000, timeout: TEST_CONFIG.game.gpsTimeoutSeconds * 1000,
    });
  });

  it('falls back to the last known position when the browser cannot give a fresh one', async () => {
    const geo = setup();
    geo.start();
    watchCallback!(reading(50.07, 19.99, 12, Date.parse('2026-10-10T10:00:00Z')));
    nextFresh = null;
    expect((await geo.fresh())?.lat).toBe(50.07);
  });

  it('returns the simulated position at once without asking the browser', async () => {
    const geo = setup();
    geo.simulate([19.99, 50.07]);
    expect(await geo.fresh()).toEqual({ lat: 50.07, lng: 19.99, source: 'simulated' });
    expect(currentCallbacks).toBeUndefined();
  });

  it('knows nothing without a GPS and without simulation', async () => {
    const geo = setup();
    expect(geo.latLng()).toBeNull();
    nextFresh = null;
    expect(await geo.fresh()).toBeNull();
  });

  describe('?gps=lat,lng (mock location for tests, dev tools only)', () => {
    it('starts with a simulated position from the address', () => {
      history.replaceState({}, '', '/?gps=50.0676,19.9917');
      const geo = setup();
      geo.start();
      expect(geo.latLng()).toEqual({ lat: 50.0676, lng: 19.9917, source: 'simulated' });
    });

    it('is ignored outside dev tools', () => {
      history.replaceState({}, '', '/?gps=50.0676,19.9917');
      const geo = setup(false);
      geo.start();
      expect(geo.latLng()).toBeNull();
    });

    it('ignores garbage and out-of-range values', () => {
      for (const bad of ['abc', '50', '91,19', '50,181', ',']) {
        TestBed.resetTestingModule();
        history.replaceState({}, '', `/?gps=${bad}`);
        const geo = setup();
        geo.start();
        expect(geo.latLng(), bad).toBeNull();
      }
    });
  });
});
