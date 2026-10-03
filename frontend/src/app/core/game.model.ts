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

/** Maksymalna odległość, z której można zaatakować (w metrach). Wartość tylko dla UI: egzekwuje ją backend. */
export const ATTACK_RANGE_M = 50;
