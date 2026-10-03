import { teamPower, typeMultiplier } from './battle.utils';
import { Encounter, Pokemon } from './game.model';

const enemy = { typeCode: 'transport', power: 50 } as Encounter;
const pokemon = (id: number, power: number, typeCode: Pokemon['typeCode']): Pokemon =>
  ({ id, character: 'cyclist', typeCode, level: 1, exp: 0, power, isStaked: false });

describe('typeMultiplier', () => {
  it('gives 1.2 only for a matching type', () => {
    expect(typeMultiplier(pokemon(1, 10, 'transport'), enemy)).toBe(1.2);
    expect(typeMultiplier(pokemon(1, 10, 'green'), enemy)).toBe(1);
  });
});

describe('teamPower', () => {
  it('sums effective power and needs to exceed the enemy', () => {
    const team = [pokemon(1, 25, 'transport'), pokemon(2, 20, 'green')];
    const result = teamPower(team, enemy);
    expect(result.total).toBe(50);
    expect(result.beatsEnemy).toBe(false);
    expect(teamPower([...team, pokemon(3, 1, 'air')], enemy).beatsEnemy).toBe(true);
  });

  it('an empty team never wins', () => {
    expect(teamPower([], { ...enemy, power: 0 } as Encounter).beatsEnemy).toBe(false);
  });
});
