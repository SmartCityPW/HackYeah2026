import { TypeCode } from '../game.model';

/** Postać (gatunek Spryciaka) z `GET /catalog`. Źródło prawdy: backend/config/seed/reference.yaml. */
export interface CatalogCharacter {
  code: string;
  label: string;
  emoji: string;
  categoryLabel: string;
  typeCode: TypeCode;
  /** Model 3D (glTF) względem katalogu public/; null = postać zastępcza. */
  modelPath: string | null;
  isStarter: boolean;
  /** Tylko za udział w wydarzeniu (nie wypada z walk ani ankiet). */
  isEventExclusive: boolean;
  basePower: number;
  powerGrowth: number;
}

export interface CatalogType {
  code: TypeCode;
  name: string;
  emoji: string;
}

export interface Catalog {
  characters: CatalogCharacter[];
  types: CatalogType[];
}
