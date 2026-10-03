export type PokestopType = 'report' | 'ngo' | 'consultation';

export interface Pokestop {
  id: number;
  type: PokestopType;
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
