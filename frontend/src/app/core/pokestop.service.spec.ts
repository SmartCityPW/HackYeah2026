import { TestBed } from '@angular/core/testing';
import { PokestopApi } from './api/pokestop.api';
import { MockPokestopApi } from './api/pokestop.api.mock';
import { CollectionService } from './collection.service';
import { PokestopService } from './pokestop.service';

describe('PokestopService', () => {
  let service: PokestopService;
  let collection: CollectionService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PokestopApi, useClass: MockPokestopApi }] });
    service = TestBed.inject(PokestopService);
    collection = TestBed.inject(CollectionService);
    await service.refresh();
    await collection.refresh();
  });

  it('vote awards the stop character once and updates counters', async () => {
    const stop = service.stops().find((s) => s.myVote === null)!;
    const before = collection.counts()[stop.character];

    expect(await service.vote(stop.id, 'for')).toBe(stop.character);
    expect(collection.counts()[stop.character]).toBe(before + 1);
    expect(service.stops().find((s) => s.id === stop.id)!.votesFor).toBe(stop.votesFor + 1);

    expect(await service.vote(stop.id, 'against')).toBeNull();
    expect(collection.counts()[stop.character]).toBe(before + 1);
  });

  it('addReport creates an own stop with a fresh id', async () => {
    const before = service.stops().length;
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
    await service.comment(stop.id, 'Popieram!');
    expect(service.interactions().some((s) => s.id === stop.id)).toBe(true);
  });
});
