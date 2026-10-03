import { Encounter, Pokemon, TYPE_MULTIPLIER } from './game.model';

export interface TeamMemberPower {
  pokemon: Pokemon;
  multiplier: number;
  /** Moc po mnożniku typu. */
  effective: number;
}

export interface TeamPower {
  members: TeamMemberPower[];
  total: number;
  /** Czy (wg podglądu) drużyna przewyższa moc przeciwnika. Rozstrzyga i tak serwer. */
  beatsEnemy: boolean;
}

/** Mnożnik typu dla pokemona w walce z danym przeciwnikiem. */
export function typeMultiplier(pokemon: Pokemon, enemy: Encounter): number {
  return pokemon.typeCode === enemy.typeCode ? TYPE_MULTIPLIER : 1;
}

/** Podgląd mocy drużyny przeciw przeciwnikowi (ta sama reguła co na serwerze: suma > moc przeciwnika). */
export function teamPower(team: Pokemon[], enemy: Encounter): TeamPower {
  const members = team.map((pokemon) => {
    const multiplier = typeMultiplier(pokemon, enemy);
    return { pokemon, multiplier, effective: Math.round(pokemon.power * multiplier) };
  });
  const total = Math.round(team.reduce((sum, p) => sum + p.power * typeMultiplier(p, enemy), 0));
  return { members, total, beatsEnemy: team.length > 0 && total > enemy.power };
}
