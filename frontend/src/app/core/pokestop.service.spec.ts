import { TestBed } from '@angular/core/testing';
import { PokestopService } from './pokestop.service';

describe('PokestopService', () => {
  let service: PokestopService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PokestopService);
  });

  it('vote awards the stop character once and updates counters', () => {
    const stop = service.stops()[0];
    expect(service.vote(stop.id, 'for')).toBe(stop.character);
    expect(service.collection()[stop.character]).toBe(1);
    expect(service.stops()[0].votesFor).toBe(stop.votesFor + 1);
    expect(service.vote(stop.id, 'against')).toBeNull();
    expect(service.collection()[stop.character]).toBe(1);
  });

  it('addReport creates a report stop with a new id', () => {
    const before = service.stops().length;
    const stop = service.addReport({ title: 'Test', description: '', character: 'lamp', lat: 50, lng: 19 });
    expect(service.stops().length).toBe(before + 1);
    expect(stop.type).toBe('report');
    expect(service.stops().filter((s) => s.id === stop.id).length).toBe(1);
  });
});
