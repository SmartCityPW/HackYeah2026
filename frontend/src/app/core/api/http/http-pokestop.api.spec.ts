import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from '../../config/testing';
import { ApiHttpError, NotAdaptedYet } from '../../http/api-error';
import { GameApi } from '../game.api';
import { PokestopApi } from '../pokestop.api';
import { MockGameApi } from '../game.api.mock';
import { MockPokestopApi } from '../pokestop.api.mock';
import { API_PROVIDERS } from '../api-providers';
import { HttpGameApi } from './http-game.api';
import { HttpPokestopApi } from './http-pokestop.api';
import sample from './testing/backend-sample.json';

const BASE = TEST_CONFIG.api.baseUrl;

function setup(mode: 'mock' | 'http' = 'http') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { pokestops: mode, game: mode } } }),
      ...API_PROVIDERS,
    ],
  });
  return { http: TestBed.inject(HttpTestingController) };
}

describe('API mode switch (api.mode in app-config.yaml)', () => {
  it('uses the in-memory mocks when mode is "mock"', () => {
    setup('mock');
    expect(TestBed.inject(PokestopApi)).toBeInstanceOf(MockPokestopApi);
    expect(TestBed.inject(GameApi)).toBeInstanceOf(MockGameApi);
  });

  it('uses the HTTP implementations when mode is "http"', () => {
    setup('http');
    expect(TestBed.inject(PokestopApi)).toBeInstanceOf(HttpPokestopApi);
    expect(TestBed.inject(GameApi)).toBeInstanceOf(HttpGameApi);
  });
});

describe('HttpPokestopApi (real backend responses captured from the running API)', () => {
  it('maps a real GET /pokestops page to frontend models', async () => {
    const { http } = setup();
    const api = TestBed.inject(PokestopApi);
    const result = api.list();
    const req = http.expectOne(`${BASE}/pokestops?pageSize=200`);
    expect(req.request.method).toBe('GET');
    req.flush(sample.pokestopsPage);

    const [stop] = await result;
    expect(stop).toMatchObject({
      id: 1, type: 'report', status: 'open', scenarioId: 'res-pothole', character: 'cyclist', icon: '🕳️',
      title: 'Dziura przy Rynku', mine: false, myVote: 'for', votesFor: 1, commentCount: 1, comments: [],
    });
    expect(stop.lat).toBeCloseTo(50.0617);
    expect(stop.organization).toBeUndefined();
  });

  it('reads the real collection response', async () => {
    const { http } = setup();
    const result = TestBed.inject(PokestopApi).listCollection();
    http.expectOne(`${BASE}/me/collection`).flush(sample.collection);
    expect((await result)['cyclist']).toBe(1);
  });

  it('sends a moderation note when rejecting', async () => {
    const { http } = setup();
    const result = TestBed.inject(PokestopApi).setStatus(1, 'rejected');
    const req = http.expectOne(`${BASE}/pokestops/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'rejected', note: 'Odrzucone przez administratora' });
    req.flush({ ...sample.pokestopsPage.results[0], status: 'rejected' });
    expect((await result).status).toBe('rejected');
  });

  it('turns backend errors into ApiHttpError with the contract code and fields', async () => {
    const { http } = setup();
    const result = TestBed.inject(PokestopApi).setStatus(1, 'rejected');
    http.expectOne(`${BASE}/pokestops/1`).flush(
      { code: 'validation_error', message: 'Błędne dane', fields: { note: 'Powód jest wymagany przy odrzuceniu' } },
      { status: 422, statusText: 'Unprocessable' },
    );
    const error = (await result.catch((e) => e)) as ApiHttpError;
    expect(error).toBeInstanceOf(ApiHttpError);
    expect([error.status, error.code, error.fields['note']]).toEqual([422, 'validation_error', 'Powód jest wymagany przy odrzuceniu']);
  });

  it('reports a clear message when the backend is unreachable', async () => {
    const { http } = setup();
    const result = TestBed.inject(PokestopApi).listCollection();
    http.expectOne(`${BASE}/me/collection`).error(new ProgressEvent('error'));
    expect(((await result.catch((e) => e)) as ApiHttpError).code).toBe('network_error');
  });

  it('says what is still to adapt instead of failing silently', async () => {
    setup();
    const api = TestBed.inject(PokestopApi);
    await expect(api.vote(1, 'for')).rejects.toBeInstanceOf(NotAdaptedYet);
    await expect(api.vote(1, 'for')).rejects.toThrowError(/pokemonId/);
    await expect(api.comment(1, 'x')).rejects.toThrowError(/comments/);
    await expect(api.create({} as never)).rejects.toThrowError(/stakedPokemonId/);
  });
});

describe('HttpGameApi', () => {
  it('reads real progress', async () => {
    const { http } = setup();
    const result = TestBed.inject(GameApi).getProgress();
    http.expectOne(`${BASE}/me/progress`).flush(sample.progress);
    expect(await result).toEqual({ level: 1, xp: 0, xpIntoLevel: 0, xpForNextLevel: 100 });
  });
});
