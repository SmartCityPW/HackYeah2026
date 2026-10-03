import { TestBed } from '@angular/core/testing';
import { GameApi } from './api/game.api';
import { MockGameApi } from './api/game.api.mock';
import { EncounterService } from './encounter.service';
import { INTERACTION_RADIUS_M, MAX_ENEMIES_IN_RANGE } from './game.model';
import { distanceMeters } from './geo.utils';
import { GeolocationService } from './geolocation.service';
import { ProgressService } from './progress.service';

const RYNEK: [number, number] = [19.9373, 50.0617];
const RYNEK_POS = { lat: RYNEK[1], lng: RYNEK[0] };

describe('EncounterService', () => {
  let service: EncounterService;
  let geo: GeolocationService;
  let progress: ProgressService;
  let api: MockGameApi;

  beforeEach(async () => {
    api = new MockGameApi();
    api.random = () => 0.99; // zawsze maksymalna liczba przeciwników
    TestBed.configureTestingModule({ providers: [{ provide: GameApi, useValue: api }] });
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

  it('spawns at most the maximum number of enemies, all inside the interaction circle', () => {
    expect(service.encounters().length).toBe(MAX_ENEMIES_IN_RANGE);
    for (const e of service.encounters()) expect(distanceMeters(RYNEK_POS, e)).toBeLessThanOrEqual(INTERACTION_RADIUS_M);
  });

  it('spawns nobody when the server rolls the minimum', async () => {
    api.random = () => 0;
    geo.walk(0, 500);
    await service.refresh();
    expect(service.encounters()).toEqual([]);
  });

  it('drops enemies left behind and spawns new ones around the new position', async () => {
    const before = service.encounters().map((e) => e.id);
    geo.walk(0, 300);
    await service.refresh();
    const here = service.userPosition()!;
    expect(service.encounters().some((e) => before.includes(e.id))).toBe(false);
    for (const e of service.encounters()) expect(distanceMeters(here, e)).toBeLessThanOrEqual(INTERACTION_RADIUS_M);
  });

  it('does not attack without a known position', async () => {
    const id = service.encounters()[0].id;
    geo.simulate(null);
    expect(await service.attack(id)).toBeNull();
  });

  it('server answers too_far from outside the circle and keeps the enemy', async () => {
    const far = service.encounters()[0];
    const result = await api.attack(far.id, { lat: 50.07, lng: 19.95 });
    expect(result.outcome).toBe('too_far');
    expect((await api.listEncounters(RYNEK_POS, INTERACTION_RADIUS_M)).some((e) => e.id === far.id)).toBe(true);
  });

  it('wins inside the circle, removes the enemy and adds XP', async () => {
    const near = service.encounters()[0];
    const xpBefore = progress.progress().xp;
    const result = await service.attack(near.id);
    expect(result?.outcome).toBe('won');
    expect(service.encounters().some((e) => e.id === near.id)).toBe(false);
    expect(progress.progress().xp).toBe(xpBefore + near.xpReward);
  });
});
