import { RouterLink } from '@angular/router';
import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild, afterNextRender, DestroyRef } from '@angular/core';
import { EncounterService } from '../../core/encounter.service';
import { AppConfigService } from '../../core/config/app-config.service';
import { Encounter, Position, TYPES } from '../../core/game.model';
import { distanceMeters } from '../../core/geo.utils';
import { describeError } from '../../core/http/api-error';
import { CHARACTERS, POKESTOP_TYPES, Pokestop } from '../../core/pokestop.model';
import { PokemonService } from '../../core/pokemon.service';
import { GeolocationService } from '../../core/geolocation.service';
import { PokestopService } from '../../core/pokestop.service';
import { ProgressService } from '../../core/progress.service';
import { findScenario } from '../../core/scenario.catalog';
import { describeDetails } from '../../core/scenario.utils';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { Battle } from './battle/battle';
import { MapController } from './map.controller';
import { ReportDraft, ReportPanel } from './report-panel/report-panel';

/** Ekran mapy ("home"): pinezki, głosowanie, komentarze, zgłoszenia i tryb walki. Logikę MapLibre ma `MapController`. */
@Component({
  selector: 'app-map-page',
  imports: [Battle, ReportPanel, StatusChip, RouterLink],
  providers: [MapController],
  templateUrl: './map.page.html',
  styleUrl: './map.page.css',
})
export class MapPage {
  private readonly pokestops = inject(PokestopService);
  private readonly mapCtl = inject(MapController);
  private readonly geo = inject(GeolocationService);
  private readonly encounterService = inject(EncounterService);
  private readonly toast = inject(ToastService);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  protected readonly pokemons = inject(PokemonService);
  private readonly reloadDebounceMs = inject(AppConfigService).config.ui.mapReloadDebounceMs;
  private reloadTimer?: ReturnType<typeof setTimeout>;
  private readonly reportPanel = viewChild(ReportPanel);
  protected readonly session = inject(SessionService);
  protected readonly progress = inject(ProgressService).progress;
  /** Promień kółka interakcji wokół gracza (z konfiguracji; decyzję o zasięgu i tak podejmuje backend). */
  protected readonly interactionRadius = inject(AppConfigService).config.game.interactionRangeM;
  protected readonly enemyTypes = TYPES;
  protected readonly devTools = inject(AppConfigService).config.dev.tools;

  /** Z parametru adresu `?stop=ID`, np. przy przejściu z listy inicjatyw. */
  readonly stop = input<string>();

  protected readonly types = POKESTOP_TYPES;
  protected readonly characters = CHARACTERS;
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => this.pokestops.stops().find((s) => s.id === this.selectedId()) ?? null);
  protected readonly selectedEncounterId = signal<number | null>(null);
  protected readonly selectedEncounter = computed(() => this.encounterService.encounters().find((e) => e.id === this.selectedEncounterId()) ?? null);
  /** Odległość użytkownika od wybranego przeciwnika w metrach; null, gdy nie znamy pozycji. */
  protected readonly encounterDistance = computed(() => this.distanceTo(this.selectedEncounter()));
  protected readonly canAttack = computed(() => {
    const d = this.encounterDistance();
    return this.canParticipate() && d !== null && d <= this.interactionRadius;
  });
  /**
   * Przeciwnik w trybie walki. Trzymamy kopię, bo po wygranej znika z listy przeciwników,
   * a ekran wyniku ma go jeszcze pokazać.
   */
  protected readonly battleEncounter = signal<Encounter | null>(null);
  protected readonly battleInRange = computed(() => {
    const d = this.distanceTo(this.battleEncounter());
    return d !== null && d <= this.interactionRadius;
  });
  /** Odległość użytkownika od wybranej pinezki w metrach; null, gdy nie znamy pozycji. */
  protected readonly stopDistance = computed(() => this.distanceTo(this.selected()));
  /** Głosować można tylko na pinezki w kółku interakcji (podgląd i komentarze są dostępne z każdej odległości). */
  protected readonly stopInRange = computed(() => {
    const d = this.stopDistance();
    return d !== null && d <= this.interactionRadius;
  });
  /** Zgłoszenie można postawić tylko w kółku: celownik (środek mapy) musi być w zasięgu gracza. */
  protected readonly pinInRange = computed(() => {
    const d = this.distanceTo(this.mapCtl.centerPosition());
    return d !== null && d <= this.interactionRadius;
  });
  private readonly stopsInRange = computed(() => this.idsInRange(this.pokestops.visibleStops()));
  private readonly encountersInRange = computed(() => this.idsInRange(this.encounterService.encounters()));
  /** Najbliższy przeciwnik w kółku (do szybkiego startu walki z paska); null, gdy nikogo nie ma w zasięgu. */
  protected readonly nearestEnemy = computed(() => {
    const inRange = this.encountersInRange();
    return (
      this.encounterService
        .encounters()
        .filter((e) => inRange.has(e.id))
        .sort((a, b) => (this.distanceTo(a) ?? 0) - (this.distanceTo(b) ?? 0))[0] ?? null
    );
  });
  /** Bez pozycji nie ma kółka ani przeciwników, więc mówimy graczowi, co zrobić. */
  protected readonly needsLocation = computed(() => this.mapCtl.ready() && this.geo.position() === null);
  protected readonly panelOpen = signal(false);
  protected readonly commentDraft = signal('');
  /** Komentarz nadrzędny, na który odpowiadamy (null: piszemy nowy komentarz najwyższego poziomu). */
  protected readonly replyTo = signal<{ id: number; author: string } | null>(null);
  protected readonly commentsLoading = signal(false);
  protected readonly moreComments = computed(() => {
    const stop = this.selected();
    return !!stop && this.pokestops.hasMoreComments(stop);
  });
  /** Administrator tylko przegląda: nie zgłasza, nie głosuje i nie komentuje. */
  protected readonly canParticipate = computed(() => this.session.role() !== 'admin');
  protected readonly selectedDetails = computed(() => {
    const stop = this.selected();
    const scenario = findScenario(stop?.scenarioId);
    return stop?.details && scenario ? describeDetails(scenario, stop.details) : [];
  });

  constructor() {
    afterNextRender(() => {
      this.mapCtl.init(this.container().nativeElement);
      this.geo.start();
    });
    inject(DestroyRef).onDestroy(() => this.geo.stop());

    // Jeden efekt, żeby oznaczanie zasięgu zawsze widziało już utworzone markery.
    effect(() => {
      if (!this.mapCtl.ready()) return;
      this.mapCtl.showStops(this.pokestops.visibleStops(), (id) => this.select(id));
      this.mapCtl.showEncounters(this.encounterService.encounters(), (id) => this.selectEncounter(id));
      this.mapCtl.markInRange(this.stopsInRange(), this.encountersInRange());
    });
    // Pinezki dociągamy z widocznego obszaru mapy (po każdym jej ruchu, z opóźnieniem z konfiguracji).
    effect(() => {
      if (!this.mapCtl.ready()) return;
      untracked(() => {
        this.mapCtl.onMoveEnd(() => this.scheduleReload());
        this.scheduleReload();
        void this.run(() => this.pokemons.refresh());
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.reloadTimer));
    effect(() => {
      const position = this.geo.position();
      if (position && this.mapCtl.ready()) this.mapCtl.showUser(position);
    });
    effect(() => {
      const id = Number(this.stop());
      if (id && this.mapCtl.ready()) untracked(() => void this.select(id));
    });
  }

  private distanceTo(target: Position | null): number | null {
    const me = this.encounterService.userPosition();
    return target && me ? Math.round(distanceMeters(me, target)) : null;
  }

  private idsInRange(items: (Position & { id: number })[]): Set<number> {
    const me = this.encounterService.userPosition();
    return new Set(me ? items.filter((i) => distanceMeters(me, i) <= this.interactionRadius).map((i) => i.id) : []);
  }

  /** Wykonuje operację i zamiast zgłaszać błąd w konsoli pokazuje użytkownikowi jego opis (np. "za daleko"). Zwraca undefined przy błędzie. */
  private async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.toast.show(describeError(error));
      return undefined;
    }
  }

  /** Jak `run`, ale dla operacji bez wyniku: zwraca, czy się udała. */
  private async attempt(operation: () => Promise<unknown>): Promise<boolean> {
    return (await this.run(async () => {
      await operation();
      return true;
    })) === true;
  }

  private scheduleReload(): void {
    clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      const area = this.mapCtl.bounds();
      if (area) void this.run(() => this.pokestops.loadArea(area));
    }, this.reloadDebounceMs);
  }

  /** Otwiera kartę pinezki (pobiera ją z serwera, jeśli jeszcze jej nie mamy) wraz z pierwszą stroną komentarzy. */
  protected async select(id: number): Promise<void> {
    const stop = await this.pokestops.open(id);
    if (!stop) return;
    this.panelOpen.set(false);
    this.selectedEncounterId.set(null);
    this.replyTo.set(null);
    this.commentDraft.set('');
    this.selectedId.set(id);
    this.mapCtl.focus(stop.lat, stop.lng);
    this.commentsLoading.set(true);
    await this.run(() => this.pokestops.loadComments(id));
    this.commentsLoading.set(false);
  }

  /** Przeciwnik w kółku od razu wciąga w tryb walki; dalszy pokazuje tylko kartę z odległością. */
  protected selectEncounter(id: number): void {
    const enc = this.encounterService.encounters().find((e) => e.id === id);
    if (!enc || this.battleEncounter()) return;
    this.panelOpen.set(false);
    this.selectedId.set(null);
    this.selectedEncounterId.set(id);
    if (this.canAttack()) this.startBattle(enc);
    else this.mapCtl.focus(enc.lat, enc.lng);
  }

  protected startBattle(enc: Encounter): void {
    this.panelOpen.set(false);
    this.selectedId.set(null);
    this.selectedEncounterId.set(null);
    this.battleEncounter.set(enc);
    this.mapCtl.enterBattle(enc.lat, enc.lng);
  }

  /** Koniec walki; `message` (np. powód przerwania) pokazujemy jako komunikat. */
  protected endBattle(message?: string): void {
    this.battleEncounter.set(null);
    this.mapCtl.exitBattle();
    if (message) this.toast.show(message, '⚠️');
    // Celownik startuje na graczu, czyli w środku kółka.
    const me = this.encounterService.userPosition();
    if (this.panelOpen() && me) this.mapCtl.focus(me.lat, me.lng);
  }

  protected close(): void {
    this.selectedId.set(null);
    this.selectedEncounterId.set(null);
  }

  protected togglePanel(): void {
    this.selectedId.set(null);
    this.selectedEncounterId.set(null);
    this.panelOpen.update((open) => !open);
  }

  protected onPokemonChosen(event: Event): void {
    this.pokemons.choose(Number((event.target as HTMLSelectElement).value));
  }

  /** Głos wymaga wybranego pokemona (dostaje exp) i pozycji użytkownika (serwer sprawdza, czy jest na miejscu). */
  protected async vote(id: number, vote: 'for' | 'against'): Promise<void> {
    const pokemon = this.pokemons.chosen();
    const position = this.encounterService.userPosition();
    if (!pokemon) {
      this.toast.show('Nie masz jeszcze pokemona, który mógłby dostać exp.');
      return;
    }
    if (!position) {
      this.toast.show('Włącz lokalizację, żeby głosować. Musisz być na miejscu.');
      return;
    }
    const rewarded = await this.run(() => this.pokestops.vote(id, vote, { pokemonId: pokemon.id, position }));
    if (rewarded) {
      const character = CHARACTERS[rewarded.character];
      this.toast.show(`Dziękujemy za głos! ${character.emoji} ${character.label} ma teraz ${rewarded.exp} exp (poziom ${rewarded.level})`, '🎁');
    }
  }

  protected async sendComment(id: number): Promise<void> {
    const text = this.commentDraft().trim();
    if (!text) return;
    const reply = this.replyTo();
    // Przy błędzie szkic zostaje w polu, żeby nie trzeba go było pisać od nowa.
    if (!(await this.attempt(() => this.pokestops.comment(id, text, reply?.id)))) return;
    this.commentDraft.set('');
    this.replyTo.set(null);
  }

  protected async loadMoreComments(id: number): Promise<void> {
    this.commentsLoading.set(true);
    await this.run(() => this.pokestops.loadMoreComments(id));
    this.commentsLoading.set(false);
  }

  protected commentTotal(stop: Pokestop): number {
    return stop.commentCount ?? stop.comments.length;
  }

  protected onCommentInput(event: Event): void {
    this.commentDraft.set((event.target as HTMLInputElement).value);
  }

  /** Przy błędzie (np. moderacja odrzuciła treść) panel zostaje otwarty z wypełnionym formularzem, żeby można było poprawić i spróbować ponownie. */
  protected async onReportDrafted(draft: ReportDraft): Promise<void> {
    const center = this.mapCtl.centerPosition();
    const position = this.encounterService.userPosition();
    if (!center) return;
    if (!position) {
      this.toast.show('Włącz lokalizację, żeby dodać pinezkę. Możesz ją postawić tylko w swoim kółku.', '🚶');
      return;
    }
    const stop = await this.run(() => this.pokestops.addReport({ ...draft, lat: center.lat, lng: center.lng }, position));
    if (!stop) return;
    this.reportPanel()?.reset();
    this.panelOpen.set(false);
    void this.select(stop.id);
    this.toast.show(
      draft.type === 'ngo'
        ? 'Inicjatywa opublikowana! Mieszkańcy mogą teraz głosować.'
        : 'Zgłoszenie dodane! Gdy inni je potwierdzą, odzyskasz pokemona z premią exp.',
      '✅',
    );
  }
}
