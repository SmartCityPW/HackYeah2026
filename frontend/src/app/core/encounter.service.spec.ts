import { TestBed } from '@angular/core/testing';
import { GameApi } from './api/game.api';
import { MockGameApi } from './api/game.api.mock';
import { EncounterService } from './encounter.service';
import { GeolocationService } from './geolocation.service';
import { ProgressService } from './progress.service';

const RYNEK: [number, number] = [19.9373, 50.0617];

describe('EncounterService', () => {
  let service: EncounterService;
  let geo: GeolocationService;
  let progress: ProgressService;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [{ provide: GameApi, useClass: MockGameApi }] });
    geo = TestBed.inject(GeolocationService);
    progress = TestBed.inject(ProgressService);
    service = TestBed.inject(EncounterService);
    geo.simulate(RYNEK);
    await service.refresh();
    await progress.refresh();
  });

  it('does not attack without a known position', async () => {
    geo.simulate(null);
    expect(await service.attack(service.encounters()[0].id)).toBeNull();
  });

  it('reports too_far from a distant position and keeps the enemy', async () => {
    geo.simulate([19.95, 50.07]);
    const far = service.encounters()[0];
    const result = await service.attack(far.id);
    expect(result?.outcome).toBe('too_far');
    expect(service.encounters().some((e) => e.id === far.id)).toBe(true);
  });

  it('wins when close, removes the enemy and adds XP', async () => {
    const near = service.encounters()[0];
    const xpBefore = progress.progress().xp;
    const result = await service.attack(near.id);
    expect(result?.outcome).toBe('won');
    expect(service.encounters().some((e) => e.id === near.id)).toBe(false);
    expect(progress.progress().xp).toBe(xpBefore + near.xpReward);
  });
});
