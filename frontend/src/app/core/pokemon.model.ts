import { TypeCode } from './game.model';
import { CharacterId } from './pokestop.model';

/** Pojedynczy egzemplarz pokemona użytkownika (GET /me/pokemons). Poziom i moc liczy serwer. */
export interface Pokemon {
  id: number;
  character: CharacterId;
  typeCode: TypeCode;
  nickname: string | null;
  level: number;
  exp: number;
  /** Exp zdobyte w obecnym poziomie i potrzebne do następnego (do paska postępu). */
  expIntoLevel: number;
  expForNextLevel: number;
  power: number;
  /** Zostawiony na własnym zgłoszeniu lub pomyśle: niedostępny do walki i do kolejnego zastawu. */
  isStaked: boolean;
}
