import { PositionDto } from '../../http/position.dto';

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
  customFields?: { label: string; value: string }[];
  updateCount?: number;
  questions?: QuestionDto[];
  surveyAnswered?: boolean;
  lat: number;
  lng: number;
  votesFor: number;
  votesAgainst: number;
  myVote: 'for' | 'against' | null;
  commentCount: number;
}

export interface QuestionDto {
  id: number;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'boolean' | 'choice' | 'rating';
  required: boolean;
  options?: { value: string; label: string }[];
  min?: number | null;
  max?: number | null;
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
  /** Pozycja gracza: serwer sprawdza jej wiarygodność i to, czy pinezka leży w jego kółku interakcji. */
  position: PositionDto;
  details: Record<string, unknown>;
  questions?: { key: string; label: string; type: string; required?: boolean; options?: { value: string; label: string }[]; min?: number | null; max?: number | null }[];
}

export interface SurveyResultDto {
  stop: PokestopDto;
  pokemon: PokemonDto;
}

export interface SurveyResultsDto {
  responseCount: number;
  questions: {
    questionId: number;
    key: string;
    label: string;
    type: QuestionDto['type'];
    answered: number;
    counts?: Record<string, number>;
    average?: number | null;
    texts?: string[];
  }[];
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

export interface TimelineEntryDto {
  kind: 'created' | 'update' | 'status';
  id: number;
  title: string;
  body: string;
  fromStatus?: 'open' | 'in_progress' | 'resolved' | 'rejected';
  toStatus?: 'open' | 'in_progress' | 'resolved' | 'rejected';
  author: string;
  createdAt: string;
  updatedAt: string | null;
  editable: boolean;
}
