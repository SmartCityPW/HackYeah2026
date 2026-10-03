import { TestBed } from '@angular/core/testing';
import { MOCK_STOPS } from '../api/pokestop.mock-data';
import { TEST_CONFIG, provideTestConfig } from '../config/testing';
import { ORG_SCENARIOS, RESIDENT_SCENARIOS } from '../scenario.catalog';
import mockCatalog from './catalog.mock.json';
import { Catalog } from './catalog.model';
import { CatalogService } from './catalog.service';

const CATALOG = mockCatalog as Catalog;
const CODES = new Set(CATALOG.characters.map((c) => c.code));

describe('CatalogService', () => {
  afterEach(() => vi.unstubAllGlobals());

  function setup(mode: 'mock' | 'http') {
    TestBed.configureTestingModule({
      providers: [provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { ...TEST_CONFIG.api.mode, catalog: mode } } })],
    });
    return TestBed.inject(CatalogService);
  }

  it('uses the catalog generated from backend/config/seed/reference.yaml in mock mode', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const catalog = setup('mock');
    await catalog.load();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(catalog.characters()).toEqual(CATALOG.characters);
    expect(catalog.characters().filter((c) => c.isStarter)).toHaveLength(1);
  });

  it('loads GET /catalog in http mode', async () => {
    const remote: Catalog = { characters: [{ ...CATALOG.characters[0], code: 'sprytek', label: 'Sprytek' }], types: CATALOG.types };
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(remote), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const catalog = setup('http');
    await catalog.load();
    expect(fetchSpy).toHaveBeenCalledWith(`${TEST_CONFIG.api.baseUrl}/catalog`);
    expect(catalog.character('sprytek').label).toBe('Sprytek');
  });

  it('fails startup loudly when the backend catalog is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(setup('http').load()).rejects.toThrowError(/HTTP 503/);
  });

  it('describes an unknown character instead of crashing (e.g. a retired species on an old account)', () => {
    const unknown = setup('mock').character('wycofany');
    expect(unknown.label).toBe('wycofany');
    expect(unknown.modelPath).toBeNull();
  });
});

describe('character codes in frontend data', () => {
  // Zaszyty katalog scenariuszy i atrapy pinezek wskazują postacie kodem. Po wymianie zestawu w reference.yaml
  // (i `manage.py export_reference`) ten test pokaże, które wpisy trzeba przepiąć na nowe postacie.
  it('scenarios refer only to characters from the catalog', () => {
    const unknown = [...RESIDENT_SCENARIOS, ...ORG_SCENARIOS].filter((s) => !CODES.has(s.character)).map((s) => `${s.id}: ${s.character}`);
    expect(unknown).toEqual([]);
  });

  it('mock pins refer only to characters from the catalog', () => {
    const unknown = MOCK_STOPS.filter((s) => !CODES.has(s.character)).map((s) => `${s.id}: ${s.character}`);
    expect(unknown).toEqual([]);
  });
});
