import { TestBed } from '@angular/core/testing';
import { AppConfigError } from './app-config';
import { APP_CONFIG_URL, AppConfigService } from './app-config.service';

const YAML = `
api: { baseUrl: "http://x/api", mode: { pokestops: http, game: mock, account: mock } }
auth: { storageKeyPrefix: t, autoGuest: false }
map: { styleUrl: s, workerUrl: w, center: { lat: 1, lng: 2 }, zoom: 3, pitch: 4, bearing: 5 }
game: { interactionRangeM: 50, simulatedGps: { lat: 1, lng: 2 } }
upload: { enabled: true, maxPhotos: 3, maxPhotoBytes: 100 }
ui: { toastMs: 10, commentsPageSize: 5, mapReloadDebounceMs: 0 }
dev: { tools: false }
`;

describe('AppConfigService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads and parses the YAML from the configured URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => YAML });
    vi.stubGlobal('fetch', fetchMock);
    TestBed.configureTestingModule({ providers: [{ provide: APP_CONFIG_URL, useValue: 'custom/place.yaml' }] });
    const service = TestBed.inject(AppConfigService);
    await service.load();
    expect(fetchMock).toHaveBeenCalledWith('custom/place.yaml');
    expect(service.config.api.mode.pokestops).toBe('http');
  });

  it('reports a failed download with the URL and status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const service = TestBed.inject(AppConfigService);
    await expect(service.load()).rejects.toThrowError(/config\/app-config\.yaml.*404/);
  });

  it('refuses to be read before it is loaded', () => {
    expect(() => TestBed.inject(AppConfigService).config).toThrowError(AppConfigError);
  });
});
