import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild, afterNextRender, DestroyRef } from '@angular/core';
import { EncounterService } from '../../core/encounter.service';
import { Encounter, INTERACTION_RADIUS_M, Position, TYPES, TooFarError } from '../../core/game.model';
import { distanceMeters } from '../../core/geo.utils';
import { CHARACTERS, POKESTOP_TYPES } from '../../core/pokestop.model';
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
  imports: [Battle, ReportPanel, StatusChip],
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
  protected readonly session = inject(SessionService);
  protected readonly progress = inject(ProgressService).progress;
  protected readonly interactionRadius = INTERACTION_RADIUS_M;

  /** Z parametru adresu `?stop=ID`, np. przy przejściu z listy inicjatyw. */
  readonly stop = input<string>();

  protected readonly types = POKESTOP_TYPES;
  protected readonly enemyTypes = TYPES;
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => this.pokestops.stops().find((s) => s.id === this.selectedId()) ?? null);
  protected readonly selectedEncounterId = signal<number | null>(null);
  protected readonly selectedEncounter = computed(() => this.encounterService.encounters().find((e) => e.id === this.selectedEncounterId()) ?? null);
  /** Odległość użytkownika od wybranego przeciwnika w metrach; null, gdy nie znamy pozycji. */
  protected readonly encounterDistance = computed(() => this.distanceTo(this.selectedEncounter()));
  protected readonly canAttack = computed(() => {
    const d = this.encounterDistance();
    return this.canParticipate() && d !== null && d <= INTERACTION_RADIUS_M;
  });
  /**
   * Przeciwnik w trybie walki. Trzymamy kopię, bo po wygranej znika z listy przeciwników,
   * a ekran wyniku ma go jeszcze pokazać.
   */
  protected readonly battleEncounter = signal<Encounter | null>(null);
  protected readonly battleInRange = computed(() => {
    const d = this.distanceTo(this.battleEncounter());
    return d !== null && d <= INTERACTION_RADIUS_M;
  });
  /** Odległość użytkownika od wybranej pinezki w metrach; null, gdy nie znamy pozycji. */
  protected readonly stopDistance = computed(() => this.distanceTo(this.selected()));
  /** Głosować i komentować można tylko pinezki w kółku interakcji (podgląd jest dostępny z każdej odległości). */
  protected readonly stopInRange = computed(() => {
    const d = this.stopDistance();
    return d !== null && d <= INTERACTION_RADIUS_M;
  });
  /** Zgłoszenie można postawić tylko w kółku: celownik (środek mapy) musi być w zasięgu gracza. */
  protected readonly pinInRange = computed(() => {
    const d = this.distanceTo(this.mapCtl.centerPosition());
    return d !== null && d <= INTERACTION_RADIUS_M;
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
    effect(() => {
      const position = this.geo.position();
      if (position && this.mapCtl.ready()) this.mapCtl.showUser(position);
    });
    effect(() => {
      const id = Number(this.stop());
      if (id && this.mapCtl.ready() && this.pokestops.loaded()) untracked(() => this.select(id));
    });
  }

  private distanceTo(target: Position | null): number | null {
    const me = this.encounterService.userPosition();
    return target && me ? Math.round(distanceMeters(me, target)) : null;
  }

  private idsInRange(items: (Position & { id: number })[]): Set<number> {
    const me = this.encounterService.userPosition();
    return new Set(me ? items.filter((i) => distanceMeters(me, i) <= INTERACTION_RADIUS_M).map((i) => i.id) : []);
  }

  protected select(id: number): void {
    const stop = this.pokestops.stops().find((s) => s.id === id);
    if (!stop) return;
    this.panelOpen.set(false);
    this.selectedEncounterId.set(null);
    this.selectedId.set(id);
    this.mapCtl.focus(stop.lat, stop.lng);
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
  }

  protected close(): void {
    this.selectedId.set(null);
    this.selectedEncounterId.set(null);
  }

  protected togglePanel(): void {
    this.selectedId.set(null);
    this.selectedEncounterId.set(null);
    this.panelOpen.update((open) => !open);
    // Celownik startuje na graczu, czyli w środku kółka.
    const me = this.encounterService.userPosition();
    if (this.panelOpen() && me) this.mapCtl.focus(me.lat, me.lng);
  }

  /** Wykonuje akcję na pinezce; odmowę serwera "za daleko" pokazuje jako komunikat i zwraca null. */
  private async inRange<T>(action: () => Promise<T>): Promise<{ value: T } | null> {
    try {
      return { value: await action() };
    } catch (e) {
      if (!(e instanceof TooFarError)) throw e;
      this.toast.show(`Za daleko: ${e.distanceM} m. Podejdź na mniej niż ${INTERACTION_RADIUS_M} m.`, '🚶');
      return null;
    }
  }

  protected async vote(id: number, vote: 'for' | 'against'): Promise<void> {
    const won = (await this.inRange(() => this.pokestops.vote(id, vote)))?.value;
    if (won) this.toast.show(`Dziękujemy za głos! Zdobywasz: ${CHARACTERS[won].emoji} ${CHARACTERS[won].label}`, '🎁');
  }

  protected async sendComment(id: number): Promise<void> {
    const text = this.commentDraft().trim();
    if (!text) return;
    if (!(await this.inRange(() => this.pokestops.comment(id, text)))) return;
    this.commentDraft.set('');
  }

  protected onCommentInput(event: Event): void {
    this.commentDraft.set((event.target as HTMLInputElement).value);
  }

  protected async onReportDrafted(draft: ReportDraft): Promise<void> {
    const center = this.mapCtl.centerPosition();
    if (!center) return;
    const created = await this.inRange(() => this.pokestops.addReport({ ...draft, lat: center.lat, lng: center.lng }));
    if (!created) return;
    const stop = created.value;
    this.panelOpen.set(false);
    this.selectedId.set(stop.id);
    this.toast.show(
      draft.type === 'ngo'
        ? 'Inicjatywa opublikowana! Mieszkańcy mogą teraz głosować.'
        : 'Zgłoszenie dodane! Gdy inni je potwierdzą, dostaniesz postać.',
      '✅',
    );
  }
}
