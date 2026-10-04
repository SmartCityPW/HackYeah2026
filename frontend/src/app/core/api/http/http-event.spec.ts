import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from '../../config/testing';
import { API_PROVIDERS } from '../api-providers';
import { EventApi } from '../event.api';
import { MockEventApi } from '../event.api.mock';
import { HttpEventApi } from './http-event.api';

const BASE = TEST_CONFIG.api.baseUrl;
const EVENT = {
  id: 4, organization: 'Fundacja', organizationId: 1, title: 'Piknik', description: '', address: null, lat: 50, lng: 19, startsAt: '2026-10-10T08:00:00+02:00',
  endsAt: '2026-10-12T20:00:00+02:00', dailyFrom: '10:00', dailyTo: '18:00', rewardCharacter: 'gold_bike', capacity: null, ageMin: null, ageMax: null,
  status: 'scheduled', phase: 'ongoing', activeNow: true, nextWindowStart: null, participantCount: 3, checkedIn: false, mine: false,
};
const POKEMON = { id: 9, character: 'gold_bike', typeCode: 'transport', nickname: null, level: 1, exp: 0, expIntoLevel: 0, expForNextLevel: 100, power: 40, isStaked: false };

describe('EventApi', () => {
  function setup(mode: 'mock' | 'http') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { pokestops: mode, game: 'mock', account: 'mock', scenarios: 'mock', catalog: 'mock' } } }),
        ...API_PROVIDERS,
      ],
    });
    return { http: TestBed.inject(HttpTestingController), api: TestBed.inject(EventApi) };
  }

  it('follows api.mode.pokestops', () => {
    expect(setup('mock').api).toBeInstanceOf(MockEventApi);
    TestBed.resetTestingModule();
    expect(setup('http').api).toBeInstanceOf(HttpEventApi);
  });

  it('lists events of an area and window with query parameters', async () => {
    const { http, api } = setup('http');
    const result = api.list({ west: 19, south: 50, east: 20, north: 51 }, { from: '2026-10-01T00:00:00Z', organizationId: 1 });
    const req = http.expectOne((r) => r.url === `${BASE}/events`);
    expect(req.request.params.get('bbox')).toBe('19,50,20,51');
    expect(req.request.params.get('from')).toBe('2026-10-01T00:00:00Z');
    expect(req.request.params.get('organizationId')).toBe('1');
    req.flush({ count: 1, results: [EVENT] });
    expect(await result).toEqual([EVENT]);
  });

  it('creates an event with the contract body and cancels it with PATCH', async () => {
    const { http, api } = setup('http');
    const draft = { title: 'Piknik', description: '', lat: 50, lng: 19, startsAt: EVENT.startsAt, endsAt: EVENT.endsAt, dailyFrom: '10:00', dailyTo: '18:00', rewardCharacter: 'gold_bike' };
    const created = api.create(draft);
    const post = http.expectOne(`${BASE}/events`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(draft);
    post.flush(EVENT);
    await created;

    const cancelled = api.cancel(4);
    const patch = http.expectOne(`${BASE}/events/4`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'cancelled' });
    patch.flush({ ...EVENT, status: 'cancelled', phase: 'cancelled' });
    expect((await cancelled).phase).toBe('cancelled');
  });

  it('checks in with the player position and maps the reward pokemon', async () => {
    const { http, api } = setup('http');
    const result = api.checkIn(4, { lat: 50.0001, lng: 19.0002 });
    const req = http.expectOne(`${BASE}/events/4/check-in`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ position: { lat: 50.0001, lng: 19.0002 } });
    req.flush({ event: { ...EVENT, checkedIn: true }, pokemon: POKEMON });
    const { event, pokemon } = await result;
    expect(event.checkedIn).toBe(true);
    expect(pokemon).toMatchObject({ id: 9, character: 'gold_bike', power: 40 });
  });

  it('turns a refused check-in into a typed error', async () => {
    const { http, api } = setup('http');
    const result = api.checkIn(4, { lat: 50, lng: 19 });
    http.expectOne(`${BASE}/events/4/check-in`).flush({ code: 'outside_time_window', message: 'Nagrodę odbierzesz od 11.10 10:00' }, { status: 409, statusText: 'Conflict' });
    await expect(result).rejects.toMatchObject({ status: 409, code: 'outside_time_window', message: 'Nagrodę odbierzesz od 11.10 10:00' });
  });
});
