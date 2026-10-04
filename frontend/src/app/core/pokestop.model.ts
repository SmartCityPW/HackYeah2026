import { PlayerPosition } from './game.model';
import { Pokemon } from './pokemon.model';

export type PokestopType = 'report' | 'idea' | 'place' | 'ngo' | 'consultation';

/** Inicjatywy zaufanych podmiotów (organizacji i urzędów): na mapie wykrzyknik, a nagrodę za ankietę poznaje się dopiero po jej wypełnieniu. */
export function isTrustedType(type: PokestopType): boolean {
  return type === 'ngo' || type === 'consultation';
}

export type QuestionType = 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'boolean' | 'choice' | 'rating';

export interface QuestionOption {
  value: string;
  label: string;
}

/** Pytanie ankiety przy inicjatywie zaufanego podmiotu (tylko w szczegółach pinezki, nie na liście). */
export interface SurveyQuestion {
  id: number;
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: QuestionOption[];
  min: number | null;
  max: number | null;
}

/** Pytanie dodawane przez organizację przy tworzeniu inicjatywy. */
export interface NewQuestion {
  key: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: QuestionOption[];
  min?: number | null;
  max?: number | null;
}

export type SurveyAnswer = string | number | boolean | string[];
/** Klucz pytania -> odpowiedź. */
export type SurveyAnswers = Record<string, SurveyAnswer>;

/** Po wypełnieniu ankiety: zaktualizowana pinezka i nowy pokemon, którego mieszkaniec dostaje w nagrodę. */
export interface SurveyResult {
  stop: Pokestop;
  pokemon: Pokemon;
}

export interface QuestionResult {
  questionId: number;
  key: string;
  label: string;
  type: QuestionType;
  answered: number;
  /** Liczność odpowiedzi per opcja (albo `true`/`false`). */
  counts?: Record<string, number>;
  average?: number | null;
  texts?: string[];
}

/** Zbiorcze wyniki ankiety (widzi je organizator i administrator). */
export interface SurveyResults {
  responseCount: number;
  questions: QuestionResult[];
}
/** Kod postaci ze słownika (`CatalogService`). Zestaw postaci to dane, nie kod, więc to zwykły tekst. */
export type CharacterId = string;
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

/** Pole własne inicjatywy, dopisane przez organizatora (np. budżet, termin). */
export interface CustomField {
  label: string;
  value: string;
}

/** Wpis osi czasu: `created` (inicjatywa dodana), `update` (wpis organizatora) albo `status` (zmiana statusu). */
export interface TimelineEntry {
  kind: 'created' | 'update' | 'status';
  /** Dla `update` id do edycji i usuwania. */
  id: number;
  title: string;
  /** Treść wpisu organizatora albo notatka do zmiany statusu. */
  body: string;
  fromStatus?: PokestopStatus;
  toStatus?: PokestopStatus;
  /** Organizacja, `Administrator` albo `System`. */
  author: string;
  /** ISO 8601. */
  createdAt: string;
  updatedAt: string | null;
  /** Czy zalogowany użytkownik może wpis edytować lub usunąć (rozstrzyga serwer). */
  editable: boolean;
}

/** Wpis organizatora do dodania lub zmiany. */
export interface UpdateDraft {
  title: string;
  body: string;
}

/** Prowadzenie inicjatywy: status z komentarzem oraz treść i pola własne (tylko organizator-autor). */
export interface PokestopPatch {
  status?: PokestopStatus;
  note?: string;
  title?: string;
  description?: string;
  customFields?: CustomField[];
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
  /** Pola własne organizatora. */
  customFields?: CustomField[];
  /** Liczba wpisów organizatora na osi czasu. */
  updateCount?: number;
  /** Pytania ankiety (tylko szczegóły pinezki `ngo`/`consultation`). */
  questions?: SurveyQuestion[];
  /** Czy zalogowany użytkownik już wypełnił ankietę (tylko szczegóły pinezki). */
  surveyAnswered?: boolean;
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
  /** Pytania ankiety (tylko inicjatywy organizacji). */
  questions?: NewQuestion[];
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
  position: PlayerPosition;
}

export interface VoteResult {
  stop: Pokestop;
  /** Pokemon nagrodzony za ten głos, już po doliczeniu exp. */
  pokemon: Pokemon;
}

export interface PokestopTypeMeta {
  label: string;
  emoji: string;
  /** Kolor wypełnienia pinezki: token palety (zmienna CSS). Dwa typy dzielą barwę, więc rozróżnia je też ikona i kształt. */
  color: string;
  /** Etykiety przycisków głosowania: [za, przeciw]. */
  vote: [string, string];
}

export const POKESTOP_TYPES: Record<PokestopType, PokestopTypeMeta> = {
  report: { label: 'Zgłoszenie problemu', emoji: '🚧', color: 'var(--color-pink)', vote: ['Potwierdzam', 'Nie zgadzam się'] },
  idea: { label: 'Pomysł mieszkańca', emoji: '✨', color: 'var(--color-indigo)', vote: ['Popieram', 'Nie popieram'] },
  place: { label: 'Cool miejsce', emoji: '😎', color: 'var(--color-lavender)', vote: ['Polecam', 'Nie polecam'] },
  ngo: { label: 'Pomysł NGO', emoji: '🌱', color: 'var(--color-plum)', vote: ['Popieram', 'Nie popieram'] },
  consultation: { label: 'Konsultacje miejskie', emoji: '🏛️', color: 'var(--color-indigo)', vote: ['Jestem za', 'Jestem przeciw'] },
};

/**
 * Status niesie ikona (a nie sam kolor), bo paleta projektu ma tylko pięć barw. `bg` i `fg` to tokeny z styles.css;
 * pary mają kontrast co najmniej 4,5:1.
 */
export const STATUS_META: Record<PokestopStatus, { label: string; icon: string; bg: string; fg: string }> = {
  open: { label: 'Głosowanie trwa', icon: '🗳️', bg: 'var(--brand-strong)', fg: 'var(--on-strong)' },
  in_progress: { label: 'W realizacji', icon: '🔧', bg: 'var(--color-lavender)', fg: 'var(--color-plum)' },
  resolved: { label: 'Załatwione', icon: '✔', bg: 'var(--color-plum)', fg: 'var(--on-dark)' },
  rejected: { label: 'Odrzucone', icon: '✕', bg: 'var(--accent-strong)', fg: 'var(--on-strong)' },
};

/** Co dany status znaczy dla mieszkańca (rozwinięcie karty inicjatywy). */
export const STATUS_MEANING: Record<PokestopStatus, string> = {
  open: 'Inicjatywa czeka na głosy i uwagi mieszkańców. Nikt jeszcze nie zaczął jej realizować.',
  in_progress: 'Ktoś się nią zajmuje: trwa realizacja albo uzgodnienia. Szczegóły są na osi czasu poniżej.',
  resolved: 'Sprawa jest zamknięta: zrobiona albo rozstrzygnięta. Co dokładnie się stało, opisuje ostatni wpis na osi czasu.',
  rejected: 'Administrator odrzucił zgłoszenie, np. dlatego, że nie spełnia zasad serwisu.',
};
