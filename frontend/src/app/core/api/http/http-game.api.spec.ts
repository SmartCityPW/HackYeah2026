import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from '../../config/testing';
import { ApiHttpError, TooFarError, describeError, toApiError } from '../../http/api-error';
import { HttpErrorResponse } from '@angular/common/http';
import { GameApi } from '../game.api';
import { API_PROVIDERS } from '../api-providers';
import { HttpGameApi } from './http-game.api';

const BASE = TEST_CONFIG.api.baseUrl;

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { pokestops: 'mock', game: 'http', account: 'mock', scenarios: 'mock', catalog: 'mock' } } }),
      ...API_PROVIDERS,
    ],
  });
  return { http: TestBed.inject(HttpTestingController), api: TestBed.inject(GameApi) };
}

const encounterDto = {
  id: 7, name: 'Korek Komunikacyjny', emoji: '🚗', level: 3, typeCode: 'transport', power: 60, actionLabel: 'Rozładuj korek',
  xpReward: 40, lat: 50.0617, lng: 19.9373, expiresAt: '2026-10-03T20:00:00Z',
};

describe('HttpGameApi', () => {
  it('uses the HTTP implementation when api.mode.game is "http"', () => {
    expect(setup().api).toBeInstanceOf(HttpGameApi);
  });

  it('asks for enemies in the player circle with position and radius, and fills in a missing description', async () => {
    const { http, api } = setup();
    const result = api.listEncounters({ lat: 50.0617, lng: 19.9373 }, 50);
    const req = http.expectOne((r) => r.url === `${BASE}/encounters`);
    expect(req.request.params.get('lat')).toBe('50.0617');
    expect(req.request.params.get('lng')).toBe('19.9373');
    expect(req.request.params.get('radius')).toBe('50');
    req.flush([encounterDto]);
    expect(await result).toEqual([{ ...encounterDto, description: '' }]);
  });

  it('attacks with the position and the chosen team and maps a win', async () => {
    const { http, api } = setup();
    const result = api.attack(7, { lat: 50.0617, lng: 19.9373 }, [1, 2]);
    const req = http.expectOne(`${BASE}/encounters/7/attack`);
    expect(req.request.body).toEqual({ lat: 50.0617, lng: 19.9373, pokemonIds: [1, 2] });
    req.flush({
      outcome: 'won', enemyPower: 60, pokemonPowerTotal: 90, pokemons: [{ pokemonId: 1, powerUsed: 40, typeMultiplierApplied: 1.2, expGained: 40 }],
      awardedCharacter: null, xpGained: 40, progress: { level: 2, xp: 160, xpIntoLevel: 60, xpForNextLevel: 100 },
    });
    expect(await result).toMatchObject({ outcome: 'won', awardedCharacter: null, xpGained: 40 });
  });

  it('passes a loss and a too_far outcome through unchanged', async () => {
    const { http, api } = setup();
    const lost = api.attack(7, { lat: 1, lng: 2 }, [1]);
    http.expectOne(`${BASE}/encounters/7/attack`).flush({ outcome: 'lost', enemyPower: 60, pokemonPowerTotal: 20, pokemons: [] });
    expect((await lost).outcome).toBe('lost');

    const far = api.attack(7, { lat: 1, lng: 2 }, [1]);
    http.expectOne(`${BASE}/encounters/7/attack`).flush({ outcome: 'too_far', distanceM: 120 });
    expect(await far).toEqual({ outcome: 'too_far', distanceM: 120 });
  });

  it('reads the player progress', async () => {
    const { http, api } = setup();
    const result = api.getProgress();
    http.expectOne(`${BASE}/me/progress`).flush({ level: 1, xp: 0, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect((await result).level).toBe(1);
  });
});

describe('too_far error', () => {
  const response = (body: unknown) => new HttpErrorResponse({ status: 422, error: body });

  it('keeps the distance and the radius the server computed and reads them back to the user', () => {
    const error = toApiError(response({ code: 'too_far', message: 'Podejdź bliżej', distanceM: 112, radiusM: 50 }));
    expect(error).toBeInstanceOf(TooFarError);
    expect(error).toMatchObject({ status: 422, code: 'too_far', distanceM: 112, radiusM: 50 });
    expect(describeError(error)).toBe('Za daleko: 112 m. Podejdź na mniej niż 50 m.');
  });

  it('a too_far without the numbers is still an ordinary readable error', () => {
    const error = toApiError(response({ code: 'too_far', message: 'Jesteś za daleko' }));
    expect(error).not.toBeInstanceOf(TooFarError);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect(describeError(error)).toBe('Jesteś za daleko');
  });
});
