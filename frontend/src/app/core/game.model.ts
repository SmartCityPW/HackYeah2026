import { CharacterId } from './pokestop.model';

/** Typ postaci i przeciwnika: pokemon tego samego typu co przeciwnik bije mocniej (mnożnik z konfiguracji). Kody jak w backendzie. */
export type TypeCode = 'transport' | 'clean' | 'green' | 'energy' | 'air' | 'infra';

/** Typ niesie ikona i nazwa (paleta ma tylko pięć barw, więc nie kolor). */
export const TYPES: Record<TypeCode, { label: string; emoji: string }> = {
  transport: { label: 'Transport', emoji: '🚦' },
  clean: { label: 'Czystość', emoji: '🧹' },
  green: { label: 'Zieleń', emoji: '🌿' },
  energy: { label: 'Energia', emoji: '💡' },
  air: { label: 'Powietrze', emoji: '🌫️' },
  infra: { label: 'Infrastruktura', emoji: '🧱' },
};

/**
 * Przeciwnik na mapie. Stoi w miejscu (backend dzieli teren na kwadraty i losuje przeciwników na kwadrat), więc wracając
 * w to samo miejsce gracz spotyka tych samych, a gracze stojący obok siebie widzą tych samych. Generuje go backend.
 */
export interface Encounter {
  id: number;
  name: string;
  emoji: string;
  level: number;
  typeCode: TypeCode;
  /** Moc, którą muszą przewyższyć wybrane pokemony (po mnożniku typu). */
  power: number;
  description: string;
  /** Co trzeba zrobić na miejscu, żeby go pokonać. */
  actionLabel: string;
  xpReward: number;
  lat: number;
  lng: number;
  /** ISO 8601: kiedy przeciwnik znika z mapy. */
  expiresAt: string;
}

export interface PlayerProgress {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export interface Position {
  lat: number;
  lng: number;
}

export interface AttackPokemonResult {
  pokemonId: number;
  /** Moc pokemona przed mnożnikiem. */
  powerUsed: number;
  typeMultiplierApplied: number;
  /** Tylko przy wygranej. */
  expGained?: number;
}

/**
 * Wynik ataku. O zwycięstwie decyduje wyłącznie backend (sprawdza odległość, liczy moc drużyny od nowa),
 * a klient tylko wysyła pozycję i wybrane pokemony, po czym wyświetla odpowiedź.
 */
export type AttackResult =
  | {
      outcome: 'won';
      enemyPower: number;
      pokemonPowerTotal: number;
      pokemons: AttackPokemonResult[];
      awardedCharacter: CharacterId | null;
      xpGained: number;
      progress: PlayerProgress;
    }
  | { outcome: 'lost'; enemyPower: number; pokemonPowerTotal: number; pokemons: AttackPokemonResult[] }
  | { outcome: 'too_far'; distanceM: number };
