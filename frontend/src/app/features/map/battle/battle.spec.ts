import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from '../../../core/api/api-providers';
import { provideTestConfig, TEST_CONFIG } from '../../../core/config/testing';
import { EncounterService } from '../../../core/encounter.service';
import { AttackResult, Encounter } from '../../../core/game.model';
import { ApiHttpError } from '../../../core/http/api-error';
import { PokemonService } from '../../../core/pokemon.service';
import { Battle } from './battle';

const GAME = TEST_CONFIG.game; // dwell 3 s, grace 2 s, drużyna do 3, mnożnik 1,2, animacja starcia 0 ms
const enemy: Encounter = {
  id: 7, name: 'Korek Komunikacyjny', emoji: '🚗', level: 3, typeCode: 'transport', power: 60, description: '',
  actionLabel: 'Rozładuj korek', xpReward: 40, lat: 50, lng: 19, expiresAt: '2099-01-01T00:00:00Z',
};

const won: AttackResult = {
  outcome: 'won', enemyPower: 60, pokemonPowerTotal: 90,
  pokemons: [{ pokemonId: 1, powerUsed: 40, typeMultiplierApplied: 1.2, expGained: 40 }],
  awardedCharacter: 'bin', xpGained: 40, progress: { level: 2, xp: 160, xpIntoLevel: 60, xpForNextLevel: 100 },
};
const lost: AttackResult = { outcome: 'lost', enemyPower: 60, pokemonPowerTotal: 20, pokemons: [{ pokemonId: 2, powerUsed: 20, typeMultiplierApplied: 1 }] };

async function setup(options: { attack?: () => Promise<unknown>; devTools?: boolean; inRange?: boolean } = {}) {
  const attack = vi.fn(options.attack ?? (async () => won));
  TestBed.configureTestingModule({
    providers: [
      provideTestConfig({ dev: { tools: options.devTools ?? true } }),
      ...API_PROVIDERS,
      { provide: EncounterService, useValue: { attack } },
    ],
  });
  await TestBed.inject(PokemonService).refresh(); // atrapa: 3 pokemony (rowerzysta 150 exp, latarnia 40, drzewo 0)
  const fixture = TestBed.createComponent(Battle);
  fixture.componentRef.setInput('encounter', enemy);
  fixture.componentRef.setInput('inRange', options.inRange ?? true);
  const events = { closed: vi.fn(), interrupted: vi.fn(), failed: vi.fn() };
  fixture.componentInstance.closed.subscribe(events.closed);
  fixture.componentInstance.interrupted.subscribe(events.interrupted);
  fixture.componentInstance.failed.subscribe(events.failed);
  fixture.detectChanges();
  return { fixture, attack, events, el: fixture.nativeElement as HTMLElement };
}

const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ');
const tick = async (fixture: ComponentFixture<Battle>, seconds: number) => {
  await vi.advanceTimersByTimeAsync(seconds * 1000);
  fixture.detectChanges();
};
const click = (fixture: ComponentFixture<Battle>, selector: string, index = 0) => {
  (fixture.nativeElement.querySelectorAll(selector)[index] as HTMLButtonElement).click();
  fixture.detectChanges();
};
/** Przechodzi akcję na miejscu, żeby dojść do wyboru drużyny. */
const toTeamStep = (fixture: ComponentFixture<Battle>) => tick(fixture, GAME.actionDwellSeconds);

describe('Battle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('action on the spot', () => {
    it('counts down only while the player stands in the circle, then moves on to choosing the team', async () => {
      const { fixture, el } = await setup();
      expect(text(el)).toContain('Akcja na miejscu');
      expect(text(el)).toContain('Rozładuj korek');
      await tick(fixture, 1);
      expect(text(el)).toContain(`${GAME.actionDwellSeconds - 1} s`);
      await tick(fixture, GAME.actionDwellSeconds - 1);
      expect(text(el)).toContain('Wybierz drużynę');
    });

    it('does not count while the player is outside the circle, and interrupts the fight after the grace period', async () => {
      const { fixture, events, el } = await setup({ inRange: false });
      await tick(fixture, 1);
      expect(text(el)).toContain(`Wróć w ciągu ${GAME.leaveGraceSeconds} s`);
      expect(text(el)).toContain(`${GAME.actionDwellSeconds} s`); // odliczanie akcji stoi
      expect(events.interrupted).not.toHaveBeenCalled();
      await tick(fixture, GAME.leaveGraceSeconds);
      expect(events.interrupted).toHaveBeenCalledTimes(1);
    });

    it('coming back in time cancels the interruption and resumes the countdown', async () => {
      const { fixture, events, el } = await setup({ inRange: false });
      await tick(fixture, 1);
      fixture.componentRef.setInput('inRange', true);
      await tick(fixture, 1);
      expect(text(el)).not.toContain('Wróć w ciągu');
      await tick(fixture, GAME.leaveGraceSeconds + 5);
      expect(events.interrupted).not.toHaveBeenCalled();
    });

    it('lets the developer skip the countdown, and nobody else', async () => {
      const dev = await setup({ devTools: true });
      expect(text(dev.el)).toContain('Pomiń odliczanie');
      click(dev.fixture, '.skip');
      expect(text(dev.el)).toContain('Wybierz drużynę');

      TestBed.resetTestingModule();
      const user = await setup({ devTools: false });
      expect(user.el.querySelector('.skip')).toBeNull();
    });

    it('fleeing closes the battle', async () => {
      const { fixture, events } = await setup();
      click(fixture, '.flee');
      expect(events.closed).toHaveBeenCalled();
    });
  });

  describe('choosing the team', () => {
    it('offers the strongest pokemon first, previews the power with the type bonus and needs a pick to attack', async () => {
      const { fixture, el } = await setup();
      await toTeamStep(fixture);
      const names = [...el.querySelectorAll('.pokemon strong')].map((n) => n.textContent);
      expect(names[0]).toBe('Rowerzysta'); // 150 exp, poziom 2, moc 24
      expect((el.querySelector('.btn.fight') as HTMLButtonElement).disabled).toBe(true);
      expect(text(el)).toContain('Wybierz od 1 do 3 Spryciaków');

      click(fixture, '.pokemon', 0);
      expect(text(el)).toContain('bonus typu'); // rowerzysta (transport) kontra korek (transport)
      expect(text(el)).toContain('Za słabo');   // 24 × 1,2 = 29 < 60
      expect((el.querySelector('.btn.fight') as HTMLButtonElement).disabled).toBe(false);
    });

    it('does not take more than the configured team size and lets the player take a pick back', async () => {
      const { fixture, el } = await setup();
      await toTeamStep(fixture);
      TestBed.inject(PokemonService); // trzy pokemony w atrapie, więc dobieramy czwartego sztucznie przez zmniejszenie limitu
      const cards = () => [...el.querySelectorAll('.pokemon')] as HTMLButtonElement[];
      cards().forEach((c) => c.click());
      fixture.detectChanges();
      expect(text(el)).toContain(`${GAME.maxTeamSize}/${GAME.maxTeamSize}`);
      cards()[0].click();
      fixture.detectChanges();
      expect(text(el)).toContain(`${GAME.maxTeamSize - 1}/${GAME.maxTeamSize}`);
    });
  });

  describe('the clash', () => {
    it('sends the chosen pokemon, shows the rewards after a win and goes back to the map', async () => {
      const { fixture, attack, events, el } = await setup();
      await toTeamStep(fixture);
      click(fixture, '.pokemon', 0);
      click(fixture, '.btn.fight');
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      expect(attack).toHaveBeenCalledWith(7, [1]);
      expect(text(el)).toContain('Wygrana');
      expect(text(el)).toContain('+40 exp');
      expect(text(el)).toContain('+40 XP');
      expect(text(el)).toContain('Nowy Spryciak');
      click(fixture, '.btn.go');
      expect(events.closed).toHaveBeenCalled();
    });

    it('after a loss the player can try again with another team and the enemy is still there', async () => {
      const { fixture, el } = await setup({ attack: async () => lost });
      await toTeamStep(fixture);
      click(fixture, '.pokemon', 1);
      click(fixture, '.btn.fight');
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(text(el)).toContain('Przegrana');
      expect(text(el)).toContain('Przeciwnik wciąż tu jest');

      click(fixture, '.btn.go'); // "Spróbuj innym składem"
      expect(text(el)).toContain('Wybierz drużynę');
    });

    it.each([
      ['the server says too far', async () => ({ outcome: 'too_far', distanceM: 73 }), 'Za daleko: 73 m od przeciwnika.'],
      ['the position is unknown', async () => null, 'Nie znamy Twojej pozycji. Włącz lokalizację.'],
      ['the server refuses the team', async () => { throw new ApiHttpError(422, 'validation_error', 'Ten pokemon nie może walczyć'); }, 'Ten pokemon nie może walczyć'],
    ])('reports a failed attack when %s', async (_name, attack, message) => {
      const { fixture, events } = await setup({ attack });
      await toTeamStep(fixture);
      click(fixture, '.pokemon', 0);
      click(fixture, '.btn.fight');
      await vi.advanceTimersByTimeAsync(0);
      expect(events.failed).toHaveBeenCalledWith(message);
    });
  });
});
