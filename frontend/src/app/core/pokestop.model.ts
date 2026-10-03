export type PokestopType = 'report' | 'ngo' | 'consultation';

export type CharacterId = 'cyclist' | 'bin' | 'tree' | 'train' | 'lamp';

export interface Pokestop {
  id: number;
  type: PokestopType;
  /** Postać (pokemon), którą widać na mapie i którą dostaje się za udział. */
  character: CharacterId;
  title: string;
  description: string;
  author: string;
  lat: number;
  lng: number;
  votesFor: number;
  votesAgainst: number;
  myVote: 'for' | 'against' | null;
}

export const POKESTOP_TYPES: Record<PokestopType, { label: string; emoji: string; color: string }> = {
  report: { label: 'Zgłoszenie mieszkańca', emoji: '🚧', color: '#f59e0b' },
  ngo: { label: 'Pomysł NGO', emoji: '🌱', color: '#10b981' },
  consultation: { label: 'Konsultacje miejskie', emoji: '🏛️', color: '#6366f1' },
};

export const CHARACTERS: Record<CharacterId, { label: string; emoji: string; category: string }> = {
  cyclist: { label: 'Rowerzysta', emoji: '🚴', category: 'Rowery i ścieżki' },
  bin: { label: 'Stworek Kosz', emoji: '🗑️', category: 'Czystość i śmieci' },
  tree: { label: 'Drzewo', emoji: '🌳', category: 'Zieleń' },
  train: { label: 'Pociąg', emoji: '🚆', category: 'Komunikacja' },
  lamp: { label: 'Latarnia', emoji: '💡', category: 'Oświetlenie' },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];

export interface NewReport {
  title: string;
  description: string;
  character: CharacterId;
  lat: number;
  lng: number;
}
