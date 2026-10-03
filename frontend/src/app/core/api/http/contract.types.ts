/** Kształty odpowiedzi backendu używane przez frontend (wycinek docs/openapi.yaml). Rozszerzaj w miarę adaptacji. */
export interface PageDto<T> {
  count: number;
  results: T[];
}

export interface PokestopDto {
  id: number;
  type: 'report' | 'idea' | 'place' | 'ngo' | 'consultation';
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
  scenarioCode: string;
  character: string;
  icon: string;
  title: string;
  description?: string;
  author: string;
  mine: boolean;
  organization: string | null;
  photos?: { id: number; url: string }[];
  details?: Record<string, unknown>;
  lat: number;
  lng: number;
  votesFor: number;
  votesAgainst: number;
  myVote: 'for' | 'against' | null;
  commentCount: number;
}

export interface PlayerProgressDto {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}
