import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from '../../config/testing';
import { PlayerPosition } from '../../game.model';
import { toPositionDto } from '../../http/position.dto';
import { EventApi } from '../event.api';
import { GameApi } from '../game.api';
import { PokestopApi } from '../pokestop.api';
import { API_PROVIDERS } from '../api-providers';

const BASE = TEST_CONFIG.api.baseUrl;
const GPS: PlayerPosition = { lat: 50.07, lng: 19.99, accuracyM: 8, takenAt: '2026-10-10T10:00:00.000Z', source: 'gps' };
const SIMULATED: PlayerPosition = { lat: 50.07, lng: 19.99, source: 'simulated' };

describe('pozycja gracza w żądaniach do backendu (weryfikuje ją serwer)', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { pokestops: 'http', game: 'http', account: 'mock', scenarios: 'mock', catalog: 'mock' } } }),
        ...API_PROVIDERS,
      ],
    });
    return TestBed.inject(HttpTestingController);
  }

  it('maps a GPS reading to PositionRequest and omits what a simulation does not have', () => {
    expect(toPositionDto(GPS)).toEqual({ lat: 50.07, lng: 19.99, accuracyM: 8, takenAt: '2026-10-10T10:00:00.000Z', source: 'gps' });
    expect(toPositionDto(SIMULATED)).toEqual({ lat: 50.07, lng: 19.99, source: 'simulated' });
    expect(toPositionDto({ lat: 1, lng: 2 })).toEqual({ lat: 1, lng: 2 });
  });

  it('sends accuracy, reading time and source with a vote', () => {
    const http = setup();
    void TestBed.inject(PokestopApi).vote(1, 'for', { pokemonId: 3, position: GPS });
    expect(http.expectOne(`${BASE}/pokestops/1/vote`).request.body).toEqual({ vote: 'for', pokemonId: 3, position: toPositionDto(GPS) });
  });

  it('sends the position with a survey and with an event check-in', () => {
    const http = setup();
    void TestBed.inject(PokestopApi).answerSurvey(2, { q: true }, SIMULATED);
    expect(http.expectOne(`${BASE}/pokestops/2/survey-responses`).request.body).toEqual({ position: toPositionDto(SIMULATED), answers: { q: true } });
    void TestBed.inject(EventApi).checkIn(4, GPS);
    expect(http.expectOne(`${BASE}/events/4/check-in`).request.body).toEqual({ position: toPositionDto(GPS) });
  });

  it('sends the position with a new pin', () => {
    const http = setup();
    void TestBed.inject(PokestopApi).create(
      { type: 'report', scenarioId: 'res-pothole', icon: '🕳️', photos: [], details: {}, title: 'Dziura', description: '', character: 'bench', stakedPokemonId: 1, lat: 50.07, lng: 19.99 },
      GPS,
    );
    expect(http.expectOne(`${BASE}/pokestops`).request.body.position).toEqual(toPositionDto(GPS));
  });

  it('puts the position into the query of the encounter list', () => {
    const http = setup();
    void TestBed.inject(GameApi).listEncounters(GPS, 50);
    const req = http.expectOne((r) => r.url === `${BASE}/encounters`);
    expect(Object.fromEntries(req.request.params.keys().map((k) => [k, req.request.params.get(k)]))).toEqual({
      lat: '50.07', lng: '19.99', radius: '50', accuracyM: '8', takenAt: '2026-10-10T10:00:00.000Z', source: 'gps',
    });
  });

  it('sends a flat attack body with clientTime and source', () => {
    const http = setup();
    void TestBed.inject(GameApi).attack(7, GPS, [1, 2]);
    expect(http.expectOne(`${BASE}/encounters/7/attack`).request.body).toEqual({
      lat: 50.07, lng: 19.99, pokemonIds: [1, 2], accuracyM: 8, clientTime: '2026-10-10T10:00:00.000Z', source: 'gps',
    });
  });
});
