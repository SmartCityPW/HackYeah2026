export type PokestopType = 'report' | 'ngo' | 'consultation';
export type CharacterId = 'cyclist' | 'bin' | 'tree' | 'train' | 'lamp';
export type PokestopStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';

export interface PokestopComment {
  id: number;
  author: string;
  text: string;
  mine: boolean;
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
  lat: number;
  lng: number;
}

export interface VoteResult {
  stop: Pokestop;
  /** Postać zdobyta za ten głos (null, gdy użytkownik już wcześniej głosował). */
  awarded: CharacterId | null;
}

export const POKESTOP_TYPES: Record<PokestopType, { label: string; emoji: string; color: string }> = {
  report: { label: 'Zgłoszenie mieszkańca', emoji: '🚧', color: '#f59e0b' },
  ngo: { label: 'Pomysł NGO', emoji: '🌱', color: '#10b981' },
  consultation: { label: 'Konsultacje miejskie', emoji: '🏛️', color: '#6366f1' },
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
