import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from './api/api-providers';
import { PokestopApi } from './api/pokestop.api';
import { provideTestConfig } from './config/testing';
import { ApiHttpError } from './http/api-error';
import { PokemonService } from './pokemon.service';
import { Pokestop } from './pokestop.model';
import { PokestopService } from './pokestop.service';

const at = (stop: Pokestop) => ({ lat: stop.lat, lng: stop.lng });

describe('PokestopService (on the in-memory mock, which enforces the same rules as the backend)', () => {
  let service: PokestopService;
  let pokemons: PokemonService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    service = TestBed.inject(PokestopService);
    pokemons = TestBed.inject(PokemonService);
    await service.loadAll();
    await pokemons.refresh();
  });

  const votable = () => service.stops().find((s) => !s.mine && s.myVote === null)!;

  describe('voting', () => {
    it('gives exp to the chosen pokemon, counts the vote and refuses a second one', async () => {
      const stop = votable();
      const pokemon = pokemons.pokemons()[0];

      const rewarded = await service.vote(stop.id, 'for', { pokemonId: pokemon.id, position: at(stop) });

      expect(rewarded.id).toBe(pokemon.id);
      expect(rewarded.exp).toBeGreaterThan(pokemon.exp);
      expect(pokemons.pokemons().find((p) => p.id === pokemon.id)!.exp).toBe(rewarded.exp);
      expect(service.stops().find((s) => s.id === stop.id)).toMatchObject({ votesFor: stop.votesFor + 1, myVote: 'for' });

      const again = await service.vote(stop.id, 'against', { pokemonId: pokemon.id, position: at(stop) }).catch((e) => e);
      expect(again).toBeInstanceOf(ApiHttpError);
      expect((again as ApiHttpError).code).toBe('already_voted');
    });

    it('is refused from too far away and changes nothing', async () => {
      const stop = votable();
      const pokemon = pokemons.pokemons()[0];

      const error = (await service.vote(stop.id, 'for', { pokemonId: pokemon.id, position: { lat: stop.lat + 0.01, lng: stop.lng } }).catch((e) => e)) as ApiHttpError;

      expect([error.status, error.code]).toEqual([403, 'too_far']);
      expect(service.stops().find((s) => s.id === stop.id)!.myVote).toBeNull();
      expect(pokemons.pokemons()[0].exp).toBe(pokemon.exp);
    });

    it('is refused on the own report', async () => {
      const own = service.stops().find((s) => s.mine)!;
      const error = (await service.vote(own.id, 'for', { pokemonId: pokemons.pokemons()[0].id, position: at(own) }).catch((e) => e)) as ApiHttpError;
      expect(error.code).toBe('own_pokestop');
    });
  });

  describe('reporting', () => {
    const report = (stakedPokemonId?: number) => ({
      type: 'report' as const, scenarioId: 'res-lamp', icon: '💡', photos: [], details: {}, title: 'Test', description: '', character: 'lamp' as const,
      stakedPokemonId, lat: 50, lng: 19,
    });

    it('stakes the chosen pokemon, takes the character from it and makes it unavailable', async () => {
      const pokemon = pokemons.available()[0];
      const stop = await service.addReport(report(pokemon.id));

      expect(stop).toMatchObject({ mine: true, status: 'open', character: pokemon.character });
      expect(service.stops().filter((s) => s.id === stop.id).length).toBe(1);

      await pokemons.refresh();
      expect(pokemons.available().some((p) => p.id === pokemon.id)).toBe(false);
      expect(pokemons.pokemons().find((p) => p.id === pokemon.id)!.isStaked).toBe(true);

      const second = (await service.addReport(report(pokemon.id)).catch((e) => e)) as ApiHttpError;
      expect(second.code).toBe('pokemon_unavailable');
    });

    it('needs a pokemon to stake', async () => {
      const error = (await service.addReport(report()).catch((e) => e)) as ApiHttpError;
      expect([error.status, error.code]).toEqual([422, 'validation_error']);
    });

    it('a place needs no stake', async () => {
      const stop = await service.addReport({ ...report(), type: 'place', scenarioId: 'place-food', character: 'bin' });
      expect(stop.character).toBe('bin');
    });
  });

  describe('map area', () => {
    it('loads only the pins inside the visible area and keeps what it already had', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
      const fresh = TestBed.inject(PokestopService);

      await fresh.loadArea({ west: 19.93, south: 50.06, east: 19.94, north: 50.065 });
      const first = fresh.stops().map((s) => s.id);
      expect(first.length).toBeGreaterThan(0);
      expect(first.length).toBeLessThan(8);

      await fresh.loadArea({ west: 19.90, south: 50.05, east: 19.92, north: 50.07 });
      expect(fresh.stops().length).toBeGreaterThan(first.length);
      expect(first.every((id) => fresh.stops().some((s) => s.id === id))).toBe(true);
    });

    it('fetches a pin that was never loaded (link ?stop=ID) and says null when it does not exist', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
      const fresh = TestBed.inject(PokestopService);

      expect((await fresh.open(3))?.id).toBe(3);
      expect(fresh.stops().map((s) => s.id)).toEqual([3]);
      expect(await fresh.open(9999)).toBeNull();
    });
  });

  describe('moderation view', () => {
    it('rejected stops disappear from the map but stay in the list, and only an administrator query returns them', async () => {
      const id = service.stops()[0].id;
      await service.setStatus(id, 'rejected');
      expect(service.visibleStops().some((s) => s.id === id)).toBe(false);
      expect(service.stops().some((s) => s.id === id)).toBe(true);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
      const api = TestBed.inject(PokestopApi);
      await api.setStatus(id, 'rejected');
      expect((await api.list()).some((s) => s.id === id)).toBe(false);
      expect((await api.list(undefined, 'rejected')).map((s) => s.id)).toEqual([id]);
    });
  });

  describe('comments (page size 2 in the test config)', () => {
    it('pages through the discussion newest first', async () => {
      const stop = service.stops().find((s) => s.comments.length === 2)!;
      await service.comment(stop.id, 'Trzeci');
      await service.comment(stop.id, 'Czwarty');

      await service.loadComments(stop.id);
      let current = service.stops().find((s) => s.id === stop.id)!;
      expect(current.comments.map((c) => c.text)).toEqual(['Czwarty', 'Trzeci']);
      expect(service.hasMoreComments(current)).toBe(true);

      await service.loadMoreComments(stop.id);
      current = service.stops().find((s) => s.id === stop.id)!;
      expect(current.comments.length).toBe(4);
      expect(service.hasMoreComments(current)).toBe(false);
    });

    it('a new comment goes to the top and a reply nests under its parent', async () => {
      const stop = service.stops().find((s) => !s.mine && s.myVote === null && !s.comments.some((c) => c.mine))!;
      expect(service.interactions().some((s) => s.id === stop.id)).toBe(false);

      await service.comment(stop.id, 'Popieram!');
      let current = service.stops().find((s) => s.id === stop.id)!;
      const parent = current.comments[0];
      expect(parent).toMatchObject({ text: 'Popieram!', mine: true });
      expect(service.interactions().some((s) => s.id === stop.id)).toBe(true);

      await service.comment(stop.id, 'A tu odpowiedź', parent.id);
      current = service.stops().find((s) => s.id === stop.id)!;
      expect(current.comments.length).toBe(stop.comments.length + 1);
      expect(current.comments.find((c) => c.id === parent.id)!.replies).toMatchObject([{ text: 'A tu odpowiedź', parentId: parent.id }]);
    });

    it('refuses a reply to a comment of another pin', async () => {
      const [a, b] = service.stops().filter((s) => s.comments.length > 0);
      const error = (await service.comment(a.id, 'x', b.comments[0].id).catch((e) => e)) as ApiHttpError;
      expect(error.code).toBe('validation_error');
    });
  });
});

describe('PokestopService.merge with responses that carry only a comment count (like the real backend)', () => {
  it('does not wipe the comments that were already fetched when the list is refreshed', async () => {
    const stop = { id: 1, type: 'report', status: 'open', character: 'cyclist', title: 't', description: '', author: 'a', comments: [], commentCount: 2, lat: 1, lng: 1, votesFor: 0, votesAgainst: 0, myVote: null } as Pokestop;
    const api = {
      list: vi.fn().mockResolvedValue([stop]),
      listComments: vi.fn().mockResolvedValue({ total: 1, items: [{ id: 9, author: 'x', text: 'treść', mine: false, replies: [] }] }),
    };
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS, { provide: PokestopApi, useValue: api }] });
    const service = TestBed.inject(PokestopService);

    await service.loadArea({ west: 0, south: 0, east: 2, north: 2 });
    await service.loadComments(1);
    await service.loadArea({ west: 0, south: 0, east: 2, north: 2 });

    expect(service.stops()[0].comments.map((c) => c.text)).toEqual(['treść']);
    expect(service.stops()[0].commentCount).toBe(2);
  });
});
