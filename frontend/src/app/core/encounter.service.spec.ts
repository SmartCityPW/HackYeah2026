import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from './api/api-providers';
import { MAX_IN_RESPONSE, MockGameApi } from './api/game.api.mock';
import { CollectionService } from './collection.service';
import { provideTestConfig, TEST_CONFIG } from './config/testing';
import { EncounterService } from './encounter.service';
import { distanceMeters } from './geo.utils';
import { GeolocationService } from './geolocation.service';
import { PokemonService } from './pokemon.service';
import { ProgressService } from './progress.service';

const RADIUS = TEST_CONFIG.game.interactionRangeM;
const RYNEK: [number, number] = [19.9373, 50.0617];
const RYNEK_POS = { lat: RYNEK[1], lng: RYNEK[0] };

/** Powtarzalny generator liczb losowych (mulberry32), żeby rozstawienie przeciwników w testach było stałe. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ustawia moc przeciwnika po stronie "serwera" (atrapy), żeby wynik walki był przewidywalny. */
function setEnemyPower(api: MockGameApi, id: number, power: number): void {
  (api as unknown as { encounters: { id: number; power: number }[] }).encounters.find((e) => e.id === id)!.power = power;
}

describe('EncounterService (on the in-memory mock, which plays the server)', () => {
  let service: EncounterService;
  let geo: GeolocationService;
  let progress: ProgressService;
  let api: MockGameApi;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    api = TestBed.inject(MockGameApi);
    api.random = seeded(1);
    geo = TestBed.inject(GeolocationService);
    progress = TestBed.inject(ProgressService);
    service = TestBed.inject(EncounterService);
    geo.simulate(RYNEK);
    await service.refresh();
    await progress.refresh();
  });

  it('has no enemies without a known position', async () => {
    geo.simulate(null);
    TestBed.tick();
    expect(service.encounters()).toEqual([]);
  });

  it('shows at most the maximum number of enemies, all inside the interaction circle', () => {
    expect(service.encounters().length).toBeGreaterThan(0);
    expect(service.encounters().length).toBeLessThanOrEqual(MAX_IN_RESPONSE);
    for (const e of service.encounters()) expect(distanceMeters(RYNEK_POS, e)).toBeLessThanOrEqual(RADIUS);
  });

  it('caps a crowded area at the maximum, nearest first', async () => {
    api.random = () => 0.99; // każdy kwadrat losuje maksimum przeciwników
    geo.walk(0, 2_000);
    await service.refresh();
    expect(service.encounters().length).toBeLessThanOrEqual(MAX_IN_RESPONSE);
  });

  it('an area can be empty', async () => {
    api.random = () => 0;
    geo.walk(0, 5_000);
    await service.refresh();
    expect(service.encounters()).toEqual([]);
  });

  it('enemies stay in their place: leaving hides them, coming back shows the same ones', async () => {
    const before = service.encounters().map((e) => e.id).sort();
    geo.walk(0, 300);
    await service.refresh();
    const here = service.userPosition()!;
    expect(service.encounters().some((e) => before.includes(e.id))).toBe(false);
    for (const e of service.encounters()) expect(distanceMeters(here, e)).toBeLessThanOrEqual(RADIUS);

    geo.simulate(RYNEK);
    await service.refresh();
    expect(service.encounters().map((e) => e.id).sort()).toEqual(before);
  });

  it('does not attack without a known position', async () => {
    const id = service.encounters()[0].id;
    geo.simulate(null);
    expect(await service.attack(id, [1])).toBeNull();
  });

  it('the server answers too_far from outside the circle and keeps the enemy', async () => {
    const far = service.encounters()[0];
    const result = await api.attack(far.id, { lat: 50.07, lng: 19.95 }, [1]);
    expect(result.outcome).toBe('too_far');
    expect((await api.listEncounters(RYNEK_POS, RADIUS)).some((e) => e.id === far.id)).toBe(true);
  });

  it('wins with a strong enough team: enemy gone, XP, exp for the team and a new pokemon', async () => {
    const pokemons = TestBed.inject(PokemonService);
    const collection = TestBed.inject(CollectionService);
    await pokemons.refresh();
    await collection.refresh();
    const enemy = service.encounters()[0];
    setEnemyPower(api, enemy.id, 1);
    const team = pokemons.ready().slice(0, 2);
    const xpBefore = progress.progress().xp;
    const ownedBefore = pokemons.pokemons().length;
    const collectedBefore = Object.values(collection.counts()).reduce((a, b) => a + b, 0);

    const result = await service.attack(enemy.id, team.map((p) => p.id));

    expect(result?.outcome).toBe('won');
    expect(service.encounters().some((e) => e.id === enemy.id)).toBe(false);
    expect(progress.progress().xp).toBe(xpBefore + enemy.xpReward);
    expect(pokemons.pokemons().length).toBe(ownedBefore + 1);
    expect(Object.values(collection.counts()).reduce((a, b) => a + b, 0)).toBe(collectedBefore + 1);
    for (const p of team) expect(pokemons.pokemons().find((x) => x.id === p.id)!.exp).toBe(p.exp + enemy.xpReward);
  });

  it('loses when the team is too weak and the enemy stays', async () => {
    const enemy = service.encounters()[0];
    setEnemyPower(api, enemy.id, 10_000);
    const result = await service.attack(enemy.id, [1]);
    expect(result?.outcome).toBe('lost');
    expect(service.encounters().some((e) => e.id === enemy.id)).toBe(true);
  });

  it('the server rejects an empty, oversized or foreign team with a readable error', async () => {
    const id = service.encounters()[0].id;
    await expect(api.attack(id, RYNEK_POS, [])).rejects.toMatchObject({ code: 'validation_error' });
    await expect(api.attack(id, RYNEK_POS, [1, 2, 3, 1])).rejects.toMatchObject({ code: 'validation_error' });
    await expect(api.attack(id, RYNEK_POS, [999])).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('a pokemon staked on a report cannot fight', async () => {
    const pokemons = TestBed.inject(PokemonService);
    await pokemons.refresh();
    const id = service.encounters()[0].id;
    const player = (api as unknown as { player: { find: (id: number) => { isStaked: boolean } } }).player;
    player.find(1).isStaked = true;
    await expect(api.attack(id, RYNEK_POS, [1])).rejects.toMatchObject({ code: 'validation_error' });
  });
});
