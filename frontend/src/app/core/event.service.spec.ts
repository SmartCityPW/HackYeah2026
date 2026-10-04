import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from './api/api-providers';
import { provideTestConfig } from './config/testing';
import { EventService } from './event.service';
import { GameEvent, NewEvent } from './event.model';
import { ApiHttpError, TooFarError } from './http/api-error';

/** 12:00 w Warszawie (CEST): w godzinach dziennych 08:00-22:00 pikniku. */
const NOON = new Date('2026-10-10T10:00:00Z');
const AFTER_HOURS = new Date('2026-10-10T21:00:00Z'); // 23:00 w Warszawie: po godzinach dziennych

describe('EventService (atrapa wydarzeń działa jak backend)', () => {
  let service: EventService;
  const event = (id: number) => service.events().find((e) => e.id === id)!;
  const here = (e: GameEvent) => ({ lat: e.lat, lng: e.lng });

  async function setup(now: Date) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    service = TestBed.inject(EventService);
    await service.loadArea({ west: 19, south: 50, east: 20, north: 51 });
  }

  afterEach(() => vi.useRealTimers());

  it('lists running and upcoming events with the announcement data (organizer, reward, period)', async () => {
    await setup(NOON);
    expect(service.visibleEvents().map((e) => e.title)).toEqual(['Piknik rowerowy przy Arenie', 'Dzień sprzątania skweru', 'Festiwal Lampionów']);
    const picnic = event(1);
    expect(picnic).toMatchObject({ organization: 'Fundacja Zielone Miasto', rewardCharacter: 'gold_bike', phase: 'ongoing', activeNow: true, dailyFrom: '08:00', dailyTo: '22:00' });
    expect(event(2)).toMatchObject({ phase: 'upcoming', activeNow: false });
  });

  it('gives the rare pokemon only on the spot and in time, once', async () => {
    await setup(NOON);
    const result = await service.checkIn(1, here(event(1)));
    expect(result.pokemon.character).toBe('gold_bike');
    expect(event(1)).toMatchObject({ checkedIn: true, participantCount: 13 });
    const again = (await service.checkIn(1, here(event(1))).catch((e) => e)) as ApiHttpError;
    expect(again.code).toBe('already_checked_in');
  });

  it('refuses from outside the interaction circle', async () => {
    await setup(NOON);
    const far = await service.checkIn(1, { lat: event(1).lat + 0.01, lng: event(1).lng }).catch((e) => e);
    expect(far).toBeInstanceOf(TooFarError);
    expect(event(1).checkedIn).toBe(false);
  });

  it('refuses before the start and tells when the reward can be collected', async () => {
    await setup(NOON);
    const early = (await service.checkIn(2, here(event(2))).catch((e) => e)) as ApiHttpError;
    expect(early.code).toBe('outside_time_window');
    expect(early.message).toContain('odbierzesz od');
  });

  it('refuses outside the daily hours even though the event is running', async () => {
    await setup(AFTER_HOURS);
    expect(event(1)).toMatchObject({ phase: 'ongoing', activeNow: false });
    expect(event(1).nextWindowStart).not.toBeNull();
    const closed = (await service.checkIn(1, here(event(1))).catch((e) => e)) as ApiHttpError;
    expect(closed.code).toBe('outside_time_window');
  });

  it('counts the participant against the capacity of a new event', async () => {
    await setup(NOON);
    // Limit miejsc egzekwuje serwer (test_events.py); atrapa ma jednego gracza, więc sprawdzamy tylko liczenie uczestników.
    const created = await service.create({ ...draft(), capacity: 1, startsAt: new Date(Date.now() - 3_600_000).toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString() });
    await service.checkIn(created.id, here(created));
    expect(event(created.id).participantCount).toBe(1);
  });

  it('creates an event only with a rare reward and a sane period', async () => {
    await setup(NOON);
    const common = (await service.create({ ...draft(), rewardCharacter: 'bicycle' }).catch((e) => e)) as ApiHttpError;
    expect(common.status).toBe(422);
    expect(common.fields['rewardCharacter']).toContain('rzadki');
    const reversed = (await service.create({ ...draft(), startsAt: '2026-10-12T12:00:00Z', endsAt: '2026-10-11T12:00:00Z' }).catch((e) => e)) as ApiHttpError;
    expect(reversed.fields['endsAt']).toBeTruthy();
    const half = (await service.create({ ...draft(), dailyFrom: '10:00' }).catch((e) => e)) as ApiHttpError;
    expect(half.fields['dailyFrom']).toBeTruthy();
    const ok = await service.create(draft());
    expect(ok).toMatchObject({ mine: true, rewardCharacter: 'giant_tree', organization: 'Fundacja Zielone Miasto', phase: 'ongoing' });
  });

  it('cancelling removes the event from the map and blocks collecting', async () => {
    await setup(NOON);
    await service.cancel(3);
    expect(service.visibleEvents().some((e) => e.id === 3)).toBe(false);
    const blocked = (await service.checkIn(3, here(event(3))).catch((e) => e)) as ApiHttpError;
    expect(blocked.code).toBe('event_cancelled');
  });
});

function draft(): NewEvent {
  return {
    title: 'Sadzenie drzew', description: 'Razem sadzimy', lat: 50.07, lng: 19.99, rewardCharacter: 'giant_tree',
    startsAt: new Date(Date.now() - 3_600_000).toISOString(), endsAt: new Date(Date.now() + 5 * 3_600_000).toISOString(),
  };
}
