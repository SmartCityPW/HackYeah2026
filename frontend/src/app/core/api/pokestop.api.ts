import { PlayerPosition } from '../game.model';
import { Pokemon } from '../pokemon.model';
import { Bbox, CharacterId, CommentPage, NewReport, Pokestop, PokestopComment, PokestopPatch, PokestopStatus, SurveyAnswers, SurveyResult, SurveyResults, TimelineEntry, UpdateDraft, VoteContext, VoteResult } from '../pokestop.model';

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
 *   manage           PATCH /pokestops/{id}                     { status?, note?, title?, description?, customFields? }  (organizator, administrator)
 *   listTimeline     GET   /pokestops/{id}/timeline
 *   addUpdate        POST  /pokestops/{id}/updates             { title, body }
 *   editUpdate       PATCH /pokestops/{id}/updates/{updateId}
 *   deleteUpdate     DELETE /pokestops/{id}/updates/{updateId}
 *   answerSurvey     POST  /pokestops/{id}/survey-responses    { position, answers }
 *   surveyResults    GET   /pokestops/{id}/survey-results      (organizator, administrator)
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
  abstract create(report: NewReport, position: PlayerPosition): Promise<Pokestop>;
  abstract setStatus(id: number, status: PokestopStatus): Promise<Pokestop>;
  /** Prowadzenie inicjatywy przez organizatora (status z komentarzem, treść, pola własne). */
  abstract manage(id: number, patch: PokestopPatch): Promise<Pokestop>;
  /** Losy inicjatywy, najnowsze pierwsze: wpisy organizatora i zmiany statusu. */
  abstract listTimeline(id: number): Promise<TimelineEntry[]>;
  abstract addUpdate(id: number, draft: UpdateDraft): Promise<TimelineEntry>;
  abstract editUpdate(id: number, updateId: number, draft: Partial<UpdateDraft>): Promise<TimelineEntry>;
  abstract deleteUpdate(id: number, updateId: number): Promise<void>;
  /** Ankieta przy inicjatywie zaufanego podmiotu. Tylko w kółku interakcji (inaczej `TooFarError`); nagroda: nowy pokemon. */
  abstract answerSurvey(id: number, answers: SurveyAnswers, position: PlayerPosition): Promise<SurveyResult>;
  abstract surveyResults(id: number): Promise<SurveyResults>;
  abstract listCollection(): Promise<Record<CharacterId, number>>;
  /** Pokemony użytkownika. `availableOnly` pomija zastawione na zgłoszeniach (do wyboru zastawu). */
  abstract listPokemons(availableOnly?: boolean): Promise<Pokemon[]>;
}
