import { CharacterId } from './pokestop.model';

/** Typ postaci i przeciwnika: pokemon tego samego typu co przeciwnik bije mocniej (TYPE_MULTIPLIER). */
export type TypeCode = 'transport' | 'clean' | 'green' | 'energy' | 'air' | 'infra';

export const TYPES: Record<TypeCode, { label: string; emoji: string }> = {
  transport: { label: 'Transport', emoji: '🚦' },
  clean: { label: 'Czystość', emoji: '🧹' },
  green: { label: 'Zieleń', emoji: '🌿' },
  energy: { label: 'Energia', emoji: '💡' },
  air: { label: 'Powietrze', emoji: '🌫️' },
  infra: { label: 'Infrastruktura', emoji: '🧱' },
};

/** Losowy przeciwnik na mapie. Generuje go backend, frontend tylko go wyświetla. */
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

/** Posiadany egzemplarz postaci (GET /me/pokemons). Poziom i moc wylicza serwer z `exp`. */
export interface Pokemon {
  id: number;
  character: CharacterId;
  typeCode: TypeCode;
  level: number;
  exp: number;
  /** Exp zdobyte w obecnym poziomie i potrzebne do następnego (jak `PlayerProgress`). */
  expIntoLevel: number;
  expForNextLevel: number;
  power: number;
  /** Zostawiony na własnym zgłoszeniu: niedostępny do walki. */
  isStaked: boolean;
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

/** Ilu pokemonów można najwyżej wystawić do jednej walki. */
export const MAX_BATTLE_TEAM = 3;
/** Mnożnik mocy pokemona, którego typ = typ przeciwnika. */
export const TYPE_MULTIPLIER = 1.2;
/** "Akcja na miejscu": tyle sekund trzeba wytrwać w kółku przy przeciwniku, zanim można wybrać drużynę. */
export const ACTION_DWELL_S = 20;

/**
 * Promień kółka interakcji wokół gracza (w metrach, jak w Pokémon GO). Tylko w nim można walczyć z przeciwnikami
 * i głosować/komentować pinezki. Na mapie ma stały rozmiar w metrach (nie w pikselach), więc przybliżanie mapy
 * nie powiększa zasięgu: żeby dosięgnąć czegoś dalej, trzeba podejść. Wartość dla UI: zasięg ataku egzekwuje backend.
 */
export const INTERACTION_RADIUS_M = 50;

/**
 * Najwyżej tylu przeciwników (najbliższych) serwer pokazuje w kółku gracza; może ich też nie być wcale.
 * Przeciwnicy są przypisani do miejsc (kwadraty terenu), więc pojawiają się i znikają z kółka wraz z ruchem gracza.
 */
export const MAX_ENEMIES_IN_RANGE = 5;

/** Serwer odrzucił akcję, bo gracz stoi poza kółkiem interakcji (kod błędu API `too_far`). */
export class TooFarError extends Error {
  constructor(readonly distanceM: number) {
    super(`Za daleko: ${distanceM} m`);
  }
}
