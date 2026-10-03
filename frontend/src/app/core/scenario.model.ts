import { CharacterId, PokestopType } from './pokestop.model';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'tags'
  | 'date'
  | 'photos'
  | 'character'
  /** Wybór jednej opcji w formie "chipów". */
  | 'choice'
  /** Ocena 1–5 gwiazdek. */
  | 'rating';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: FieldOption[];
  unit?: string;
  min?: number;
  max?: number;
  /** Pole pokazujemy tylko, gdy inne pole ma daną wartość. */
  showIf?: { key: string; equals: unknown };
}

export interface ScenarioSection {
  title: string;
  fields: FieldDef[];
}

export type Audience = 'resident' | 'org';

/** Kategorie menu "Zgłoś" dla mieszkańca. */
export type ScenarioCategory = 'problem' | 'initiative' | 'place';

export interface Scenario {
  id: string;
  audience: Audience;
  /** Kategoria w menu "Zgłoś" (tylko scenariusze mieszkańca). */
  category?: ScenarioCategory;
  /** Jakiego rodzaju pinezka powstaje ze zgłoszenia. */
  pokestopType: PokestopType;
  label: string;
  emoji: string;
  description: string;
  /** Domyślna postać na mapie (organizacja może ją zmienić polem typu `character`). */
  character: CharacterId;
  defaultTitle?: string;
  sections: ScenarioSection[];
}

export type FieldValues = Record<string, unknown>;

/** Pola o tych kluczach trafiają do głównych właściwości pokestopu, reszta do `details`. */
export const BASE_KEYS = ['title', 'description', 'photos', 'character'] as const;
