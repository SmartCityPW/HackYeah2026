import { Injectable, computed, inject, signal } from '@angular/core';
import { PokestopApi } from './api/pokestop.api';
import { AppConfigService } from './config/app-config.service';
import { Pokemon } from './pokemon.model';
import { PokemonService } from './pokemon.service';
import { ProgressService } from './progress.service';
import { Position } from './game.model';
import { Bbox, NewReport, Pokestop, PokestopStatus, VoteContext } from './pokestop.model';
import { hasInteraction } from './pokestop.utils';

/**
 * Stan pinezek po stronie klienta; operacje delegujemy do `PokestopApi` (mock lub HTTP).
 * `stops` to suma wszystkich dotąd pobranych pinezek: mapa dociąga je obszarami (`loadArea`),
 * a widoki niezwiązane z mapą pobierają to, czego potrzebują (`loadAll`, `loadInteractions`).
 */
@Injectable({ providedIn: 'root' })
export class PokestopService {
  private readonly api = inject(PokestopApi);
  private readonly pokemons = inject(PokemonService);
  private readonly progress = inject(ProgressService);
  private readonly commentsPageSize = inject(AppConfigService).config.ui.commentsPageSize;

  readonly stops = signal<Pokestop[]>([]);
  readonly loaded = signal(false);
  /** Na mapie nie pokazujemy odrzuconych zgłoszeń. */
  readonly visibleStops = computed(() => this.stops().filter((s) => s.status !== 'rejected'));
  /** Inicjatywy, z którymi użytkownik miał styczność (zgłosił, zagłosował, skomentował). */
  readonly interactions = computed(() => this.stops().filter(hasInteraction));
  /** Liczba komentarzy nadrzędnych w całej dyskusji pinezki (znana po pierwszym pobraniu komentarzy). */
  private readonly commentTotals = signal<Record<number, number>>({});

  /** Dociąga pinezki z widocznego obszaru mapy. */
  async loadArea(area: Bbox): Promise<void> {
    this.merge(await this.api.list(area));
    this.loaded.set(true);
  }

  /** Dla widoków bez mapy (moderacja, inicjatywy organizacji). Administrator dostaje też odrzucone. */
  async loadAll(includeRejected = false): Promise<void> {
    const [open, rejected] = await Promise.all([this.api.list(), includeRejected ? this.api.list(undefined, 'rejected') : []]);
    this.merge([...open, ...rejected]);
    this.loaded.set(true);
  }

  async loadInteractions(): Promise<void> {
    this.merge(await this.api.listInteractions());
    this.loaded.set(true);
  }

  /** Pinezka z pamięci podręcznej albo, gdy jej jeszcze nie pobrano (np. link `?stop=ID`), z serwera. */
  async open(id: number): Promise<Pokestop | null> {
    const known = this.stops().find((s) => s.id === id);
    if (known) return known;
    try {
      const stop = await this.api.get(id);
      this.merge([stop]);
      return stop;
    } catch {
      return null;
    }
  }

  /** Czy są jeszcze nieprzeczytane strony komentarzy pod pinezką. */
  hasMoreComments(stop: Pokestop): boolean {
    const total = this.commentTotals()[stop.id];
    return total !== undefined && stop.comments.length < total;
  }

  /** Pierwsza strona komentarzy zastępuje to, co było, kolejne są dopisywane (najnowsze pierwsze). */
  async loadComments(id: number, page = 1): Promise<void> {
    const result = await this.api.listComments(id, page, this.commentsPageSize);
    this.commentTotals.update((t) => ({ ...t, [id]: result.total }));
    this.patch(id, (s) => {
      const known = page === 1 ? [] : s.comments;
      const fresh = result.items.filter((c) => !known.some((k) => k.id === c.id));
      return { ...s, comments: [...known, ...fresh] };
    });
  }

  async loadMoreComments(id: number): Promise<void> {
    const stop = this.stops().find((s) => s.id === id);
    if (stop) await this.loadComments(id, Math.floor(stop.comments.length / this.commentsPageSize) + 1);
  }

  /** Zwraca pokemona nagrodzonego za głos (już z doliczonym exp). Błędy (np. za daleko) przechodzą do wywołującego. */
  async vote(id: number, vote: 'for' | 'against', context: VoteContext): Promise<Pokemon> {
    const { stop, pokemon } = await this.api.vote(id, vote, context);
    this.merge([stop]);
    this.pokemons.replace(pokemon);
    void this.progress.refresh();
    return pokemon;
  }

  async comment(id: number, text: string, parentId?: number): Promise<void> {
    const created = await this.api.comment(id, text, parentId);
    this.commentTotals.update((t) => (parentId || t[id] === undefined ? t : { ...t, [id]: t[id] + 1 }));
    this.patch(id, (s) => ({
      ...s,
      commentCount: (s.commentCount ?? s.comments.length) + 1,
      comments: parentId
        ? s.comments.map((c) => (c.id === parentId ? { ...c, replies: [...(c.replies ?? []), created] } : c))
        : [created, ...s.comments],
    }));
  }

  async addReport(report: NewReport, position: Position): Promise<Pokestop> {
    const stop = await this.api.create(report, position);
    this.merge([stop]);
    void this.pokemons.refresh(); // zastawiony pokemon przestaje być dostępny
    return stop;
  }

  async setStatus(id: number, status: PokestopStatus): Promise<void> {
    this.merge([await this.api.setStatus(id, status)]);
  }

  /**
   * Dopisuje lub aktualizuje pinezki. Odpowiedzi HTTP nie niosą treści komentarzy (tylko `commentCount`),
   * więc przy takiej odpowiedzi zachowujemy już pobrane komentarze zamiast je kasować.
   */
  private merge(incoming: Pokestop[]): void {
    this.stops.update((current) => {
      const byId = new Map(current.map((s) => [s.id, s]));
      for (const stop of incoming) {
        const existing = byId.get(stop.id);
        const keepComments = existing && stop.commentCount !== undefined && stop.comments.length === 0;
        byId.set(stop.id, keepComments ? { ...stop, comments: existing.comments } : stop);
      }
      return [...byId.values()];
    });
  }

  private patch(id: number, change: (stop: Pokestop) => Pokestop): void {
    this.stops.update((stops) => stops.map((s) => (s.id === id ? change(s) : s)));
  }
}
