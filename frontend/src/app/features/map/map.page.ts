import { Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild, afterNextRender, DestroyRef } from '@angular/core';
import { CHARACTERS, POKESTOP_TYPES, STATUS_META } from '../../core/pokestop.model';
import { GeolocationService } from '../../core/geolocation.service';
import { PokestopService } from '../../core/pokestop.service';
import { findScenario } from '../../core/scenario.catalog';
import { describeDetails } from '../../core/scenario.utils';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { MapController } from './map.controller';
import { ReportDraft, ReportPanel } from './report-panel/report-panel';

/** Ekran mapy ("home"): pinezki, głosowanie, komentarze i dodawanie zgłoszeń. Logikę MapLibre ma `MapController`. */
@Component({
  selector: 'app-map-page',
  imports: [ReportPanel, StatusChip],
  providers: [MapController],
  templateUrl: './map.page.html',
  styleUrl: './map.page.css',
})
export class MapPage {
  private readonly pokestops = inject(PokestopService);
  private readonly mapCtl = inject(MapController);
  private readonly geo = inject(GeolocationService);
  private readonly toast = inject(ToastService);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  protected readonly session = inject(SessionService);

  /** Z parametru adresu `?stop=ID`, np. przy przejściu z listy inicjatyw. */
  readonly stop = input<string>();

  protected readonly types = POKESTOP_TYPES;
  protected readonly selectedId = signal<number | null>(null);
  protected readonly selected = computed(() => this.pokestops.stops().find((s) => s.id === this.selectedId()) ?? null);
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

    effect(() => {
      if (this.mapCtl.ready()) this.mapCtl.showStops(this.pokestops.visibleStops(), (id) => this.select(id));
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

  protected select(id: number): void {
    const stop = this.pokestops.stops().find((s) => s.id === id);
    if (!stop) return;
    this.panelOpen.set(false);
    this.selectedId.set(id);
    this.mapCtl.focus(stop.lat, stop.lng);
  }

  protected close(): void {
    this.selectedId.set(null);
  }

  protected togglePanel(): void {
    this.selectedId.set(null);
    this.panelOpen.update((open) => !open);
  }

  protected async vote(id: number, vote: 'for' | 'against'): Promise<void> {
    const won = await this.pokestops.vote(id, vote);
    if (won) this.toast.show(`Dziękujemy za głos! Zdobywasz: ${CHARACTERS[won].emoji} ${CHARACTERS[won].label}`);
  }

  protected async sendComment(id: number): Promise<void> {
    const text = this.commentDraft().trim();
    if (!text) return;
    await this.pokestops.comment(id, text);
    this.commentDraft.set('');
  }

  protected onCommentInput(event: Event): void {
    this.commentDraft.set((event.target as HTMLInputElement).value);
  }

  protected async onReportDrafted(draft: ReportDraft): Promise<void> {
    const center = this.mapCtl.center();
    if (!center) return;
    const stop = await this.pokestops.addReport({ ...draft, lat: center.lat, lng: center.lng });
    this.panelOpen.set(false);
    this.selectedId.set(stop.id);
    this.toast.show(
      draft.type === 'ngo'
        ? 'Inicjatywa opublikowana! Mieszkańcy mogą teraz głosować.'
        : 'Zgłoszenie dodane! Gdy inni je potwierdzą, dostaniesz postać.',
    );
  }
}
