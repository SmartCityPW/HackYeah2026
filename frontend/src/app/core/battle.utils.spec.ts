import { teamPower, typeMultiplier } from './battle.utils';
import { Encounter } from './game.model';
import { Pokemon } from './pokemon.model';

const MULTIPLIER = 1.2; // game.typeMultiplier z konfiguracji
const enemy = { typeCode: 'transport', power: 50 } as Encounter;
const pokemon = (id: number, power: number, typeCode: Pokemon['typeCode']): Pokemon => ({
  id, character: 'cyclist', typeCode, nickname: null, level: 1, exp: 0, expIntoLevel: 0, expForNextLevel: 100, power, isStaked: false,
});

describe('typeMultiplier', () => {
  it('gives the configured multiplier only for a matching type', () => {
    expect(typeMultiplier(pokemon(1, 10, 'transport'), enemy, MULTIPLIER)).toBe(1.2);
    expect(typeMultiplier(pokemon(1, 10, 'green'), enemy, MULTIPLIER)).toBe(1);
    expect(typeMultiplier(pokemon(1, 10, 'transport'), enemy, 1.5)).toBe(1.5);
  });
});

describe('teamPower', () => {
  it('sums effective power and needs to exceed the enemy', () => {
    const team = [pokemon(1, 25, 'transport'), pokemon(2, 20, 'green')];
    const result = teamPower(team, enemy, MULTIPLIER);
    expect(result.total).toBe(50);
    expect(result.beatsEnemy).toBe(false);
    expect(teamPower([...team, pokemon(3, 1, 'air')], enemy, MULTIPLIER).beatsEnemy).toBe(true);
  });

  it('shows each member with its multiplier', () => {
    const [first, second] = teamPower([pokemon(1, 25, 'transport'), pokemon(2, 20, 'green')], enemy, MULTIPLIER).members;
    expect([first.multiplier, first.effective, second.multiplier, second.effective]).toEqual([1.2, 30, 1, 20]);
  });

  it('an empty team never wins', () => {
    expect(teamPower([], { ...enemy, power: 0 } as Encounter, MULTIPLIER).beatsEnemy).toBe(false);
  });
});
