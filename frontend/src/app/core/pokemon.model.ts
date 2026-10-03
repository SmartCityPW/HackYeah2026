import { CharacterId } from './pokestop.model';

/** Pojedynczy egzemplarz pokemona użytkownika (GET /me/pokemons). Poziom i moc liczy serwer. */
export interface Pokemon {
  id: number;
  character: CharacterId;
  nickname: string | null;
  level: number;
  exp: number;
  power: number;
  /** Zostawiony na własnym zgłoszeniu lub pomyśle: niedostępny do walki i do kolejnego zastawu. */
  isStaked: boolean;
}
