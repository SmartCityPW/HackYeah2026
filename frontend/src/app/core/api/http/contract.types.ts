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

export interface PokemonDto {
  id: number;
  character: string;
  typeCode: string;
  nickname: string | null;
  level: number;
  exp: number;
  expIntoLevel: number;
  expForNextLevel: number;
  power: number;
  isStaked: boolean;
}

export interface VoteResultDto {
  stop: PokestopDto;
  pokemon: PokemonDto;
}

export interface CommentDto {
  id: number;
  parentCommentId?: number | null;
  author: string;
  text: string;
  mine: boolean;
  replies?: CommentDto[];
}

export interface MeDto {
  id: number;
  displayName: string;
  role: 'resident' | 'org' | 'admin';
  isGuest: boolean;
  organization: {
    id: number;
    name: string;
    kind: 'ngo' | 'foundation' | 'association' | 'city_office' | 'district_council' | 'municipality' | 'other';
    krs: string | null;
    contactPerson: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    verificationStatus: 'pending' | 'verified' | 'suspended';
  } | null;
}

/** Ciało POST /pokestops (wycinek `NewPokestop` z docs/openapi.yaml). */
export interface NewPokestopDto {
  scenarioCode: string;
  title: string;
  description: string;
  character?: string;
  stakedPokemonId?: number;
  lat: number;
  lng: number;
  /** Pozycja gracza: serwer sprawdza, czy pinezka leży w jego kółku interakcji. */
  position: { lat: number; lng: number };
  details: Record<string, unknown>;
}

export interface EncounterDto {
  id: number;
  name: string;
  emoji: string;
  level: number;
  typeCode: string;
  power: number;
  description?: string;
  actionLabel: string;
  xpReward: number;
  lat: number;
  lng: number;
  expiresAt: string;
}

export interface AttackPokemonResultDto {
  pokemonId: number;
  powerUsed: number;
  typeMultiplierApplied: number;
  expGained?: number;
}

/** Wynik ataku (`outcome` rozróżnia trzy kształty z openapi.yaml: won, lost, too_far). */
export type AttackResultDto =
  | {
      outcome: 'won';
      enemyPower: number;
      pokemonPowerTotal: number;
      pokemons: AttackPokemonResultDto[];
      awardedCharacter?: string | null;
      xpGained: number;
      progress: PlayerProgressDto;
    }
  | { outcome: 'lost'; enemyPower: number; pokemonPowerTotal: number; pokemons: AttackPokemonResultDto[] }
  | { outcome: 'too_far'; distanceM: number };
