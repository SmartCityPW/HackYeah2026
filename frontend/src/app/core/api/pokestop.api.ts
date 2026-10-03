import { Position } from '../game.model';
import { Pokemon } from '../pokemon.model';
import { Bbox, CharacterId, CommentPage, NewReport, Pokestop, PokestopComment, PokestopStatus, VoteContext, VoteResult } from '../pokestop.model';

/**
 * Kontrakt z backendem. Frontend zależy tylko od tej klasy: mock (`MockPokestopApi`)
 * podmieniamy na implementację HTTP jedną wartością `api.mode.pokestops` w app-config.yaml.
 *
 * Odpowiadające endpointy:
 *   list             GET   /pokestops?bbox=&status=            (bez `bbox`: wszystkie strony)
 *   listInteractions GET   /me/interactions
 *   get              GET   /pokestops/{id}
 *   vote             POST  /pokestops/{id}/vote                { vote, pokemonId, position }
 *   listComments     GET   /pokestops/{id}/comments?page=
 *   comment          POST  /pokestops/{id}/comments            { text, parentCommentId? }
 *   create           POST  /pokestops                          { ..., lat, lng, position }
 *   setStatus        PATCH /pokestops/{id}                     { status }   (administrator)
 *   listCollection   GET   /me/collection
 *   listPokemons     GET   /me/pokemons
 */
export abstract class PokestopApi {
  /**
   * Pinezki z podanego obszaru mapy albo, bez argumentu, wszystkie (strony pobierane do końca).
   * Odrzucone backend zwraca tylko administratorowi i tylko na jawne `status`.
   */
  abstract list(area?: Bbox, status?: PokestopStatus): Promise<Pokestop[]>;
  /** Pinezki, z którymi użytkownik miał styczność (zgłosił, zagłosował, skomentował). */
  abstract listInteractions(): Promise<Pokestop[]>;
  abstract get(id: number): Promise<Pokestop>;
  abstract vote(id: number, vote: 'for' | 'against', context: VoteContext): Promise<VoteResult>;
  abstract listComments(id: number, page: number, pageSize: number): Promise<CommentPage>;
  abstract comment(id: number, text: string, parentId?: number): Promise<PokestopComment>;
  /**
   * Pinezkę można postawić tylko w kółku interakcji gracza: `position` to pozycja gracza, a `report.lat/lng` miejsce pinezki.
   * Poza kółkiem backend odpowiada `TooFarError`.
   */
  abstract create(report: NewReport, position: Position): Promise<Pokestop>;
  abstract setStatus(id: number, status: PokestopStatus): Promise<Pokestop>;
  abstract listCollection(): Promise<Record<CharacterId, number>>;
  /** Pokemony użytkownika. `availableOnly` pomija zastawione na zgłoszeniach (do wyboru zastawu). */
  abstract listPokemons(availableOnly?: boolean): Promise<Pokemon[]>;
}
