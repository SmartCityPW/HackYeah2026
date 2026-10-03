/** Losowy przeciwnik na mapie. Generuje go backend, frontend tylko go wyświetla. */
export interface Encounter {
  id: number;
  name: string;
  emoji: string;
  level: number;
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

/**
 * Wynik ataku. O zwycięstwie decyduje wyłącznie backend (sprawdza odległość i wiarygodność pozycji),
 * a klient tylko wysyła swoją pozycję i wyświetla odpowiedź.
 */
export type AttackResult =
  | { outcome: 'won'; xpGained: number; progress: PlayerProgress }
  | { outcome: 'too_far'; distanceM: number };

/**
 * Promień kółka interakcji wokół gracza (w metrach, jak w Pokémon GO). Tylko w nim można walczyć z przeciwnikami
 * i głosować/komentować pinezki. Na mapie ma stały rozmiar w metrach (nie w pikselach), więc przybliżanie mapy
 * nie powiększa zasięgu: żeby dosięgnąć czegoś dalej, trzeba podejść. Wartość dla UI: zasięg ataku egzekwuje backend.
 */
export const INTERACTION_RADIUS_M = 50;

/** Ilu przeciwników może naraz krążyć w kółku gracza (backend losuje liczbę z tego zakresu). */
export const MIN_ENEMIES_IN_RANGE = 0;
export const MAX_ENEMIES_IN_RANGE = 5;

/** Serwer odrzucił akcję, bo gracz stoi poza kółkiem interakcji (kod błędu API `too_far`). */
export class TooFarError extends Error {
  constructor(readonly distanceM: number) {
    super(`Za daleko: ${distanceM} m`);
  }
}
