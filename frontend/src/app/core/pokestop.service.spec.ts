import { TestBed } from '@angular/core/testing';
import { PokestopApi } from './api/pokestop.api';
import { MockPokestopApi } from './api/pokestop.api.mock';
import { CollectionService } from './collection.service';
import { TooFarError } from './game.model';
import { offsetMeters } from './geo.utils';
import { GeolocationService } from './geolocation.service';
import { PokestopService } from './pokestop.service';

describe('PokestopService', () => {
  let service: PokestopService;
  let collection: CollectionService;
  let geo: GeolocationService;
  /** Stawia symulowanego gracza `meters` metrów na wschód od punktu. */
  const standNear = (p: { lat: number; lng: number }, meters = 0) => {
    const at = offsetMeters(p, 0, meters);
    geo.simulate([at.lng, at.lat]);
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PokestopApi, useClass: MockPokestopApi }] });
    service = TestBed.inject(PokestopService);
    collection = TestBed.inject(CollectionService);
    geo = TestBed.inject(GeolocationService);
    await service.refresh();
    await collection.refresh();
  });

  it('vote awards the stop character once and updates counters', async () => {
    const stop = service.stops().find((s) => s.myVote === null)!;
    const before = collection.counts()[stop.character];
    standNear(stop);

    expect(await service.vote(stop.id, 'for')).toBe(stop.character);
    expect(collection.counts()[stop.character]).toBe(before + 1);
    expect(service.stops().find((s) => s.id === stop.id)!.votesFor).toBe(stop.votesFor + 1);

    expect(await service.vote(stop.id, 'against')).toBeNull();
    expect(collection.counts()[stop.character]).toBe(before + 1);
  });

  it('addReport creates an own stop with a fresh id', async () => {
    const before = service.stops().length;
    standNear({ lat: 50, lng: 19 }, 20);
    const stop = await service.addReport({ type: 'report', scenarioId: 'res-lamp', icon: '💡', photos: [], details: {}, title: 'Test', description: '', character: 'lamp', lat: 50, lng: 19 });
    expect(service.stops().length).toBe(before + 1);
    expect(stop.mine).toBe(true);
    expect(service.stops().filter((s) => s.id === stop.id).length).toBe(1);
  });

  it('rejected stops disappear from the map but stay in the list for moderation', async () => {
    const id = service.stops()[0].id;
    await service.setStatus(id, 'rejected');
    expect(service.visibleStops().some((s) => s.id === id)).toBe(false);
    expect(service.stops().some((s) => s.id === id)).toBe(true);
  });

  it('a comment counts as an interaction', async () => {
    const stop = service.stops().find((s) => !s.mine && s.myVote === null && !s.comments.some((c) => c.mine))!;
    expect(service.interactions().some((s) => s.id === stop.id)).toBe(false);
    standNear(stop);
    await service.comment(stop.id, 'Popieram!');
    expect(service.interactions().some((s) => s.id === stop.id)).toBe(true);
  });

  it('rejects votes, comments and reports from outside the interaction circle', async () => {
    const stop = service.stops().find((s) => s.myVote === null)!;
    standNear(stop, 80);
    await expect(service.vote(stop.id, 'for')).rejects.toBeInstanceOf(TooFarError);
    await expect(service.comment(stop.id, 'Hej')).rejects.toBeInstanceOf(TooFarError);
    await expect(
      service.addReport({ type: 'report', scenarioId: 'res-lamp', icon: '💡', photos: [], details: {}, title: 'Test', description: '', character: 'lamp', lat: stop.lat, lng: stop.lng }),
    ).rejects.toBeInstanceOf(TooFarError);
    expect(service.stops().find((s) => s.id === stop.id)!.myVote).toBeNull();
  });
});
