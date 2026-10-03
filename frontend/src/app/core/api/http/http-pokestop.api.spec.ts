import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from '../../config/testing';
import { ApiHttpError, TooFarError, describeError } from '../../http/api-error';
import { GameApi } from '../game.api';
import { PokestopApi } from '../pokestop.api';
import { MockGameApi } from '../game.api.mock';
import { MockPokestopApi } from '../pokestop.api.mock';
import { API_PROVIDERS } from '../api-providers';
import { AccountApi } from '../account.api';
import { MockAccountApi } from '../account.api.mock';
import { HttpAccountApi } from './http-account.api';
import { HttpGameApi } from './http-game.api';
import { HttpPokestopApi } from './http-pokestop.api';
import sample from './testing/backend-sample.json';

const BASE = TEST_CONFIG.api.baseUrl;

function setup(mode: 'mock' | 'http' = 'http') {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { pokestops: mode, game: mode, account: mode, scenarios: mode, catalog: 'mock' } } }),
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
    expect(TestBed.inject(AccountApi)).toBeInstanceOf(MockAccountApi);
  });

  it('uses the HTTP implementations when mode is "http"', () => {
    setup('http');
    expect(TestBed.inject(PokestopApi)).toBeInstanceOf(HttpPokestopApi);
    expect(TestBed.inject(GameApi)).toBeInstanceOf(HttpGameApi);
    expect(TestBed.inject(AccountApi)).toBeInstanceOf(HttpAccountApi);
  });
});

describe('HttpPokestopApi (real backend responses captured from the running API)', () => {
  it('maps a real GET /pokestops page to frontend models', async () => {
    const { http } = setup();
    const api = TestBed.inject(PokestopApi);
    const result = api.list();
    const req = http.expectOne(`${BASE}/pokestops?pageSize=200&page=1`);
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

  it('asks only for the visible map area and follows pages until it has every result', async () => {
    const { http } = setup();
    const result = TestBed.inject(PokestopApi).list({ west: 19.93, south: 50.06, east: 19.94, north: 50.07 });
    const first = http.expectOne(`${BASE}/pokestops?pageSize=200&page=1&bbox=19.93,50.06,19.94,50.07`);
    first.flush({ count: 2, results: [sample.pokestopsPage.results[0]] });
    let second!: ReturnType<typeof http.expectOne>;
    await vi.waitFor(() => (second = http.expectOne(`${BASE}/pokestops?pageSize=200&page=2&bbox=19.93,50.06,19.94,50.07`)));
    second.flush({ count: 2, results: [{ ...sample.pokestopsPage.results[0], id: 2 }] });
    expect((await result).map((s) => s.id)).toEqual([1, 2]);
  });

  it('asks for rejected stops only when a status is given (administrator)', async () => {
    const { http } = setup();
    const result = TestBed.inject(PokestopApi).list(undefined, 'rejected');
    http.expectOne(`${BASE}/pokestops?pageSize=200&page=1&status=rejected`).flush({ count: 0, results: [] });
    expect(await result).toEqual([]);
  });

  it('maps real pokemons and can ask only for the unstaked ones', async () => {
    const { http } = setup();
    const api = TestBed.inject(PokestopApi);
    const all = api.listPokemons();
    http.expectOne(`${BASE}/me/pokemons`).flush(sample.pokemons);
    expect(await all).toEqual([{ id: sample.pokemons[0].id, character: 'cyclist', typeCode: 'transport', nickname: null, level: 1, exp: 0, expIntoLevel: 0, expForNextLevel: 100, power: 20, isStaked: false }]);

    const free = api.listPokemons(true);
    http.expectOne(`${BASE}/me/pokemons?availableOnly=true`).flush([]);
    expect(await free).toEqual([]);
  });

  it('votes with the chosen pokemon and the user position, and maps the real result', async () => {
    const { http } = setup();
    const result = TestBed.inject(PokestopApi).vote(8, 'for', { pokemonId: 12, position: { lat: 50.0618, lng: 19.9373 } });
    const req = http.expectOne(`${BASE}/pokestops/8/vote`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ vote: 'for', pokemonId: 12, position: { lat: 50.0618, lng: 19.9373 } });
    req.flush(sample.voteResult);
    const { stop, pokemon } = await result;
    expect(stop).toMatchObject({ id: 8, votesFor: 1, myVote: 'for', mine: false });
    expect(pokemon).toMatchObject({ id: 12, character: 'cyclist', isStaked: false });
  });

  it('surfaces the server message when the vote is refused (too far, already voted)', async () => {
    const { http } = setup();
    const api = TestBed.inject(PokestopApi);
    const far = api.vote(8, 'for', { pokemonId: 12, position: { lat: 50.07, lng: 19.93 } });
    http.expectOne(`${BASE}/pokestops/8/vote`).flush(sample.errors.tooFar, { status: 422, statusText: 'Unprocessable' });
    const error = (await far.catch((e) => e)) as TooFarError;
    expect(error).toBeInstanceOf(TooFarError);
    expect([error.status, error.code, error.distanceM, error.radiusM]).toEqual([422, 'too_far', 1112, 50]);
    expect(describeError(error)).toBe('Za daleko: 1112 m. Podejdź na mniej niż 50 m.');
  });

  it('maps a real comment page with replies and posts a reply under its parent', async () => {
    const { http } = setup();
    const api = TestBed.inject(PokestopApi);
    const page = api.listComments(8, 1, 10);
    http.expectOne(`${BASE}/pokestops/8/comments?page=1&pageSize=10`).flush(sample.commentsPage);
    const { total, items } = await page;
    expect(total).toBe(1);
    expect(items[0]).toMatchObject({ id: 3, parentId: null, mine: true, text: 'Pierwszy komentarz' });
    expect(items[0].replies?.[0]).toMatchObject({ id: 4, parentId: 3, author: 'Gość-2e3e' });

    const reply = api.comment(8, 'Dzięki', 3);
    const req = http.expectOne(`${BASE}/pokestops/8/comments`);
    expect(req.request.body).toEqual({ text: 'Dzięki', parentCommentId: 3 });
    req.flush({ id: 5, parentCommentId: 3, author: 'Ja', text: 'Dzięki', mine: true });
    expect(await reply).toMatchObject({ id: 5, parentId: 3 });
  });

  it('a report stakes a pokemon and lets the server pick the character', async () => {
    const { http } = setup();
    const result = TestBed.inject(PokestopApi).create({
      type: 'report', scenarioId: 'res-pothole', icon: '🕳️', photos: [], details: {}, title: 'Dziura próbna', description: 'x',
      character: 'cyclist', stakedPokemonId: 11, lat: 50.0617, lng: 19.9373,
    }, { lat: 50.0618, lng: 19.9373 });
    const req = http.expectOne(`${BASE}/pokestops`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      scenarioCode: 'res-pothole', title: 'Dziura próbna', description: 'x', stakedPokemonId: 11, lat: 50.0617, lng: 19.9373,
      position: { lat: 50.0618, lng: 19.9373 }, details: {},
    });
    req.flush(sample.createdStop);
    expect(await result).toMatchObject({ id: 8, mine: true, character: 'cyclist' });
  });

  it('a place sends the chosen character and no stake', async () => {
    const { http } = setup();
    void TestBed.inject(PokestopApi).create({ type: 'place', scenarioId: 'place-food', icon: '☕', photos: [], details: { rating: '5' }, title: 'Kawiarnia', description: '', character: 'bin', lat: 1, lng: 2 }, { lat: 1, lng: 2 });
    const body = http.expectOne(`${BASE}/pokestops`).request.body;
    expect(body).toMatchObject({ character: 'bin', details: { rating: '5' } });
    expect(body).not.toHaveProperty('stakedPokemonId');
  });

  it('keeps the moderation verdict readable when a report is refused', async () => {
    const { http } = setup();
    const result = TestBed.inject(PokestopApi).create({ type: 'report', scenarioId: 'res-pothole', icon: '🕳️', photos: [], details: {}, title: 'x [odrzuć]', description: '', character: 'cyclist', stakedPokemonId: 11, lat: 1, lng: 2 }, { lat: 1, lng: 2 });
    http.expectOne(`${BASE}/pokestops`).flush(sample.errors.moderationRejected, { status: 422, statusText: 'Unprocessable' });
    const error = (await result.catch((e) => e)) as ApiHttpError;
    expect([error.status, error.code]).toEqual([422, 'moderation_rejected']);
    expect(describeError(error)).toBe(sample.errors.moderationRejected.message);
  });
});

describe('HttpAccountApi', () => {
  it('maps the real GET /me', async () => {
    const { http } = setup();
    const result = TestBed.inject(AccountApi).me();
    http.expectOne(`${BASE}/me`).flush(sample.me);
    expect(await result).toEqual({ id: sample.me.id, displayName: sample.me.displayName, role: 'resident', isGuest: true, organization: null });
  });

  it('the mock account has no remote profile', async () => {
    setup('mock');
    expect(await TestBed.inject(AccountApi).me()).toBeNull();
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
