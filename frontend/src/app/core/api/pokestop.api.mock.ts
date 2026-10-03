import { Injectable, inject } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import { Position } from '../game.model';
import { distanceMeters } from '../geo.utils';
import { ApiHttpError, TooFarError } from '../http/api-error';
import { Pokemon } from '../pokemon.model';
import { CatalogService } from '../catalog/catalog.service';
import { Bbox, CharacterId, CommentPage, NewReport, Pokestop, PokestopComment, PokestopPatch, PokestopStatus, QuestionResult, SurveyAnswers, SurveyQuestion, SurveyResult, SurveyResults, TimelineEntry, UpdateDraft, VoteContext, VoteResult, isTrustedType } from '../pokestop.model';
import { hasInteraction } from '../pokestop.utils';
import { compactAnswers, validateAnswers } from '../survey.utils';
import { PokestopApi } from './pokestop.api';
import { MockPlayerState } from './mock-player.state';
import { MOCK_STOPS, MOCK_SURVEY_RESPONSES, MOCK_TIMELINES } from './pokestop.mock-data';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** Exp za głos: ta sama wartość co w backend/config/default.yaml (game.exp.per_vote). */
const EXP_PER_VOTE = 10;

/**
 * Atrapa backendu w pamięci. Robi to, co zrobiłby serwer: nadaje ID, ustala autora, pilnuje zasięgu i jednego głosu,
 * przyznaje exp wybranemu pokemonowi i blokuje pokemona zastawionego na zgłoszeniu.
 */
@Injectable()
export class MockPokestopApi extends PokestopApi {
  private readonly range = inject(AppConfigService).config.game.interactionRangeM;
  private readonly player = inject(MockPlayerState);
  private readonly catalog = inject(CatalogService);
  private stops: Pokestop[] = clone(MOCK_STOPS);
  private readonly timelines = new Map<number, TimelineEntry[]>(Object.entries(clone(MOCK_TIMELINES)).map(([id, entries]) => [Number(id), entries]));
  private readonly createdAt = new Map<number, string>();
  private nextEntryId = 5000;
  private nextQuestionId = 9000;
  private readonly responses = new Map<number, SurveyAnswers[]>(Object.entries(clone(MOCK_SURVEY_RESPONSES)).map(([id, answers]) => [Number(id), answers]));

  constructor() {
    super();
    for (const stop of this.stops) this.withCounts(stop);
  }

  async list(area?: Bbox, status?: PokestopStatus): Promise<Pokestop[]> {
    const inArea = (s: Pokestop) => !area || (s.lng >= area.west && s.lng <= area.east && s.lat >= area.south && s.lat <= area.north);
    // Jak backend: odrzucone widzi tylko ten, kto o nie jawnie zapyta.
    const matchesStatus = (s: Pokestop) => (status ? s.status === status : s.status !== 'rejected');
    return clone(this.stops.filter((s) => inArea(s) && matchesStatus(s)));
  }

  async listInteractions(): Promise<Pokestop[]> {
    return clone(this.stops.filter(hasInteraction));
  }

  async get(id: number): Promise<Pokestop> {
    return clone(this.require(id));
  }

  async vote(id: number, vote: 'for' | 'against', { pokemonId, position }: VoteContext): Promise<VoteResult> {
    const stop = this.require(id);
    if (stop.mine) throw new ApiHttpError(403, 'own_pokestop', 'Nie możesz głosować na własne zgłoszenie.');
    if (stop.myVote) throw new ApiHttpError(409, 'already_voted', 'Już głosowałeś na tę pinezkę.');
    const pokemon = this.player.find(pokemonId);
    if (!pokemon) throw new ApiHttpError(404, 'not_found', 'Nie masz takiego pokemona.');
    this.requireInRange(position, stop);
    stop.myVote = vote;
    if (vote === 'for') stop.votesFor++;
    else stop.votesAgainst++;
    pokemon.exp += EXP_PER_VOTE;
    return { stop: clone(stop), pokemon: this.player.toPokemon(pokemon) };
  }

  async listComments(id: number, page: number, pageSize: number): Promise<CommentPage> {
    const newestFirst = [...this.require(id).comments].reverse();
    return { total: newestFirst.length, items: clone(newestFirst.slice((page - 1) * pageSize, page * pageSize)) };
  }

  async comment(id: number, text: string, parentId?: number): Promise<PokestopComment> {
    const stop = this.require(id);
    const all = this.stops.flatMap((s) => s.comments.flatMap((c) => [c, ...(c.replies ?? [])]));
    const created: PokestopComment = { id: Math.max(0, ...all.map((c) => c.id)) + 1, author: 'Zosia', text, mine: true, parentId: parentId ?? null, replies: [] };
    if (parentId) {
      const parent = stop.comments.find((c) => c.id === parentId);
      if (!parent) throw new ApiHttpError(422, 'validation_error', 'Można odpowiadać tylko na komentarz nadrzędny tej pinezki.');
      (parent.replies ??= []).push(created);
    } else {
      stop.comments.push(created);
    }
    return clone(created);
  }

  async create(report: NewReport, position: Position): Promise<Pokestop> {
    this.requireInRange(position, report);
    const staked = report.type === 'report' || report.type === 'idea';
    let character = report.character;
    if (staked) {
      const pokemon = this.player.find(report.stakedPokemonId ?? -1);
      if (!pokemon) throw new ApiHttpError(422, 'validation_error', 'Wybierz pokemona, którego zostawisz na zgłoszeniu.');
      if (pokemon.isStaked) throw new ApiHttpError(409, 'pokemon_unavailable', 'Ten pokemon jest już zastawiony. Wybierz innego.');
      pokemon.isStaked = true;
      character = pokemon.character;
    }
    const { stakedPokemonId: _staked, questions, ...rest } = clone(report);
    const stop: Pokestop = {
      ...rest,
      questions: questions?.map((item): SurveyQuestion => ({ ...item, id: this.nextQuestionId++, required: item.required ?? true, options: item.options ?? [], min: item.min ?? null, max: item.max ?? null })),
      surveyAnswered: false,
      character,
      id: Math.max(0, ...this.stops.map((s) => s.id)) + 1,
      status: 'open',
      author: report.organization ?? 'Zosia',
      mine: true,
      comments: [],
      votesFor: 0,
      votesAgainst: 0,
      myVote: null,
    };
    this.stops.push(stop);
    this.createdAt.set(stop.id, new Date().toISOString());
    return clone(stop);
  }

  async setStatus(id: number, status: PokestopStatus): Promise<Pokestop> {
    return this.manage(id, { status });
  }

  async manage(id: number, patch: PokestopPatch): Promise<Pokestop> {
    const stop = this.require(id);
    const { status, note, customFields, ...content } = patch;
    Object.assign(stop, content);
    if (customFields) stop.customFields = clone(customFields);
    if (status && status !== stop.status) {
      this.entries(id).push({ kind: 'status', id: this.nextEntryId++, title: '', body: note ?? '', fromStatus: stop.status, toStatus: status, author: stop.organization ?? 'Administrator', createdAt: new Date().toISOString(), updatedAt: null, editable: false });
      stop.status = status;
    }
    return this.withCounts(stop);
  }

  async listTimeline(id: number): Promise<TimelineEntry[]> {
    const stop = this.require(id);
    const created: TimelineEntry = {
      kind: 'created', id: 0, title: 'Inicjatywa dodana', body: '', author: stop.organization ?? stop.author,
      createdAt: this.createdAt.get(id) ?? new Date(Date.now() - 45 * 24 * 3_600_000).toISOString(), updatedAt: null, editable: false,
    };
    return clone([...this.entries(id), created].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id));
  }

  async addUpdate(id: number, { title, body }: UpdateDraft): Promise<TimelineEntry> {
    const stop = this.require(id);
    const entry: TimelineEntry = { kind: 'update', id: this.nextEntryId++, title: this.requireTitle(title), body: body.trim(), author: stop.organization ?? 'Administrator', createdAt: new Date().toISOString(), updatedAt: null, editable: true };
    this.entries(id).push(entry);
    this.withCounts(stop);
    return clone(entry);
  }

  async editUpdate(id: number, updateId: number, draft: Partial<UpdateDraft>): Promise<TimelineEntry> {
    const entry = this.entries(id).find((e) => e.kind === 'update' && e.id === updateId);
    if (!entry) throw new ApiHttpError(404, 'not_found', 'Wpis nie istnieje.');
    if (draft.title !== undefined) entry.title = this.requireTitle(draft.title);
    if (draft.body !== undefined) entry.body = draft.body.trim();
    entry.updatedAt = new Date().toISOString();
    return clone(entry);
  }

  async deleteUpdate(id: number, updateId: number): Promise<void> {
    const entries = this.entries(id);
    const index = entries.findIndex((e) => e.kind === 'update' && e.id === updateId);
    if (index < 0) throw new ApiHttpError(404, 'not_found', 'Wpis nie istnieje.');
    entries.splice(index, 1);
    this.withCounts(this.require(id));
  }

  async answerSurvey(id: number, answers: SurveyAnswers, position: Position): Promise<SurveyResult> {
    const stop = this.require(id);
    if (!isTrustedType(stop.type) || !stop.questions?.length) throw new ApiHttpError(404, 'not_found', 'Ta inicjatywa nie ma ankiety.');
    if (stop.status === 'resolved') throw new ApiHttpError(409, 'survey_closed', 'Ta ankieta jest już zamknięta.');
    if (stop.surveyAnswered) throw new ApiHttpError(409, 'already_answered', 'Już wypełniłeś tę ankietę.');
    this.requireInRange(position, stop);
    const errors = validateAnswers(stop.questions, answers);
    if (Object.keys(errors).length) throw new ApiHttpError(422, 'validation_error', 'Błędne dane', errors);
    this.responses.set(id, [...(this.responses.get(id) ?? []), compactAnswers(answers)]);
    stop.surveyAnswered = true;
    return { stop: clone(stop), pokemon: this.player.toPokemon(this.player.add(stop.character)) };
  }

  async surveyResults(id: number): Promise<SurveyResults> {
    const stop = this.require(id);
    const responses = this.responses.get(id) ?? [];
    const questions = (stop.questions ?? []).map((q): QuestionResult => {
      const values = responses.map((r) => r[q.key]).filter((v) => v !== undefined);
      const base = { questionId: q.id, key: q.key, label: q.label, type: q.type, answered: values.length };
      if (q.type === 'boolean') return { ...base, counts: { true: values.filter((v) => v === true).length, false: values.filter((v) => v === false).length } };
      if (q.type === 'select' || q.type === 'choice' || q.type === 'multiselect') {
        const counts = Object.fromEntries(q.options.map((o) => [o.value, 0]));
        for (const v of values) for (const picked of Array.isArray(v) ? v : [v]) counts[String(picked)] = (counts[String(picked)] ?? 0) + 1;
        return { ...base, counts };
      }
      if (q.type === 'number' || q.type === 'rating') {
        const numbers = values.map(Number);
        return { ...base, average: numbers.length ? Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) / 100 : null };
      }
      return { ...base, texts: values.map(String).reverse() };
    });
    return { responseCount: responses.length, questions };
  }

  async listCollection(): Promise<Record<CharacterId, number>> {
    const counts: Record<CharacterId, number> = Object.fromEntries(this.catalog.characters().map((c) => [c.code, 0]));
    for (const p of this.player.pokemons) counts[p.character] = (counts[p.character] ?? 0) + 1;
    return counts;
  }

  async listPokemons(availableOnly = false): Promise<Pokemon[]> {
    return this.player.pokemons.filter((p) => !availableOnly || !p.isStaked).map((p) => this.player.toPokemon(p));
  }

  /** Jak serwer: głos i nowa pinezka tylko w kółku interakcji gracza (inaczej 422 `too_far` z odległością i promieniem). */
  private requireInRange(position: Position, target: Position): void {
    const distanceM = Math.round(distanceMeters(position, target));
    if (distanceM > this.range) throw new TooFarError(distanceM, this.range, `Jesteś za daleko (${distanceM} m), podejdź na mniej niż ${this.range} m`);
  }

  private entries(id: number): TimelineEntry[] {
    this.require(id);
    if (!this.timelines.has(id)) this.timelines.set(id, []);
    return this.timelines.get(id)!;
  }

  private requireTitle(title: string): string {
    const trimmed = title.trim();
    if (!trimmed) throw new ApiHttpError(422, 'validation_error', 'Tytuł wpisu jest wymagany.', { title: 'Tytuł jest wymagany' });
    return trimmed;
  }

  private withCounts(stop: Pokestop): Pokestop {
    stop.updateCount = this.entries(stop.id).filter((e) => e.kind === 'update').length;
    return clone(stop);
  }

  private require(id: number): Pokestop {
    const stop = this.stops.find((s) => s.id === id);
    if (!stop) throw new ApiHttpError(404, 'not_found', `Pinezka ${id} nie istnieje.`);
    return stop;
  }
}
