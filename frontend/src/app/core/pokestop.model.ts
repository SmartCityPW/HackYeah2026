import { Position } from './game.model';
import { Pokemon } from './pokemon.model';

export type PokestopType = 'report' | 'idea' | 'place' | 'ngo' | 'consultation';
export type CharacterId = 'cyclist' | 'bin' | 'tree' | 'train' | 'lamp';
export type PokestopStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';

export interface PokestopComment {
  id: number;
  author: string;
  text: string;
  mine: boolean;
  /** Id komentarza nadrzędnego; brak dla komentarzy najwyższego poziomu (wątki mają jeden poziom). */
  parentId?: number | null;
  replies?: PokestopComment[];
}

/** Strona komentarzy nadrzędnych (każdy z odpowiedziami). `total` to liczba komentarzy nadrzędnych w całej dyskusji. */
export interface CommentPage {
  total: number;
  items: PokestopComment[];
}

export interface Pokestop {
  id: number;
  type: PokestopType;
  /** Postać (pokemon), którą widać na mapie i którą dostaje się za udział. */
  character: CharacterId;
  status: PokestopStatus;
  scenarioId?: string;
  icon?: string;
  title: string;
  description: string;
  author: string;
  /** Czy autorem jest zalogowany użytkownik (ustala backend). */
  mine?: boolean;
  organization?: string;
  photos?: string[];
  details?: Record<string, unknown>;
  comments: PokestopComment[];
  /** Liczba komentarzy (lista z backendu nie zawiera ich treści, tylko licznik). */
  commentCount?: number;
  lat: number;
  lng: number;
  votesFor: number;
  votesAgainst: number;
  myVote: 'for' | 'against' | null;
}

export interface NewReport {
  type: PokestopType;
  scenarioId: string;
  icon: string;
  organization?: string;
  photos: string[];
  details: Record<string, unknown>;
  title: string;
  description: string;
  character: CharacterId;
  /** Własny pokemon zostawiany na zgłoszeniu (tylko `report` i `idea`). Serwer ustala wtedy `character` z jego gatunku. */
  stakedPokemonId?: number;
  lat: number;
  lng: number;
}

/** Współrzędne obszaru mapy: zachód, południe, wschód, północ (stopnie). */
export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Dane, które serwer musi dostać razem z głosem: kto dostaje exp i gdzie głosujący faktycznie stoi. */
export interface VoteContext {
  pokemonId: number;
  position: Position;
}

export interface VoteResult {
  stop: Pokestop;
  /** Pokemon nagrodzony za ten głos, już po doliczeniu exp. */
  pokemon: Pokemon;
}

export interface PokestopTypeMeta {
  label: string;
  emoji: string;
  color: string;
  /** Etykiety przycisków głosowania: [za, przeciw]. */
  vote: [string, string];
}

export const POKESTOP_TYPES: Record<PokestopType, PokestopTypeMeta> = {
  report: { label: 'Zgłoszenie problemu', emoji: '🚧', color: '#f59e0b', vote: ['Potwierdzam', 'Nie zgadzam się'] },
  idea: { label: 'Pomysł mieszkańca', emoji: '✨', color: '#0ea5e9', vote: ['Popieram', 'Nie popieram'] },
  place: { label: 'Cool miejsce', emoji: '😎', color: '#ec4899', vote: ['Polecam', 'Nie polecam'] },
  ngo: { label: 'Pomysł NGO', emoji: '🌱', color: '#10b981', vote: ['Popieram', 'Nie popieram'] },
  consultation: { label: 'Konsultacje miejskie', emoji: '🏛️', color: '#6366f1', vote: ['Jestem za', 'Jestem przeciw'] },
};

export const STATUS_META: Record<PokestopStatus, { label: string; color: string }> = {
  open: { label: 'Głosowanie trwa', color: '#2563eb' },
  in_progress: { label: 'W realizacji', color: '#d97706' },
  resolved: { label: 'Załatwione', color: '#059669' },
  rejected: { label: 'Odrzucone', color: '#dc2626' },
};

export const CHARACTERS: Record<CharacterId, { label: string; emoji: string; category: string }> = {
  cyclist: { label: 'Rowerzysta', emoji: '🚴', category: 'Rowery i ścieżki' },
  bin: { label: 'Stworek Kosz', emoji: '🗑️', category: 'Czystość i śmieci' },
  tree: { label: 'Drzewo', emoji: '🌳', category: 'Zieleń' },
  train: { label: 'Pociąg', emoji: '🚆', category: 'Komunikacja' },
  lamp: { label: 'Latarnia', emoji: '💡', category: 'Oświetlenie' },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
