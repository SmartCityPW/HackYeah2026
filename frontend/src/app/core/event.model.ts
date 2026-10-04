import { Pokemon } from './pokemon.model';
import { CharacterId } from './pokestop.model';

/** Etap życia wydarzenia: przed startem, w okresie trwania, po zakończeniu albo odwołane. */
export type EventPhase = 'upcoming' | 'ongoing' | 'ended' | 'cancelled';

/**
 * Wydarzenie "cool thing" zaufanego podmiotu. Uczestnik, który przyjdzie na miejsce w czasie trwania, dostaje rzadkiego pokemona
 * (`rewardCharacter`). Nazwa `GameEvent`, żeby nie mylić z `Event` z DOM.
 */
export interface GameEvent {
  id: number;
  organization: string;
  organizationId: number;
  title: string;
  description: string;
  address: string | null;
  lat: number;
  lng: number;
  /** ISO 8601: początek i koniec całego okresu (może obejmować wiele dni). */
  startsAt: string;
  endsAt: string;
  /** Godziny dzienne odbioru nagrody ("10:00"-"18:00", czas lokalny) albo null = przez cały okres. */
  dailyFrom: string | null;
  dailyTo: string | null;
  /** Rzadki gatunek, który dostaje uczestnik. */
  rewardCharacter: CharacterId;
  capacity: number | null;
  ageMin: number | null;
  ageMax: number | null;
  status: 'scheduled' | 'cancelled';
  phase: EventPhase;
  /** Czy w tej chwili można odebrać nagrodę (okres i godziny dzienne); drugim warunkiem jest kółko interakcji. Rozstrzyga serwer. */
  activeNow: boolean;
  /** Od kiedy najbliżej można odebrać nagrodę (null, gdy już można albo wydarzenie się skończyło lub odwołano). */
  nextWindowStart: string | null;
  participantCount: number;
  /** Czy zalogowany użytkownik już odebrał nagrodę. */
  checkedIn: boolean;
  /** Czy zalogowany użytkownik może zarządzać wydarzeniem (organizator, administrator). */
  mine: boolean;
}

/** Dane z formularza organizatora (miejsce wskazuje mapa). */
export interface NewEvent {
  title: string;
  description: string;
  address?: string;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string;
  dailyFrom?: string | null;
  dailyTo?: string | null;
  rewardCharacter: CharacterId;
  capacity?: number | null;
  ageMin?: number | null;
  ageMax?: number | null;
}

export interface CheckInResult {
  event: GameEvent;
  /** Nowy pokemon, którego gatunek jest nagrodą wydarzenia. */
  pokemon: Pokemon;
}

export interface EventQuery {
  /** Okno czasu (ISO); domyślnie od teraz na 14 dni. */
  from?: string;
  to?: string;
  /** Backend: tylko wydarzenia tej organizacji (z odwołanymi, jeśli to organizacja zalogowanego). */
  organizationId?: number;
  /** Lista do zarządzania: własne wydarzenia z odwołanymi (atrapa nie zna id organizacji konta, więc nie polega na `organizationId`). */
  managed?: boolean;
}
