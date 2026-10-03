import { Injectable, computed, inject, signal } from '@angular/core';
import { PokestopApi } from './api/pokestop.api';
import { CollectionService } from './collection.service';
import { CharacterId, NewReport, Pokestop, PokestopStatus } from './pokestop.model';
import { hasInteraction } from './pokestop.utils';

/** Stan pinezek po stronie klienta; operacje delegujemy do `PokestopApi` (mock lub HTTP). */
@Injectable({ providedIn: 'root' })
export class PokestopService {
  private readonly api = inject(PokestopApi);
  private readonly collection = inject(CollectionService);

  readonly stops = signal<Pokestop[]>([]);
  readonly loaded = signal(false);
  /** Na mapie nie pokazujemy odrzuconych zgłoszeń. */
  readonly visibleStops = computed(() => this.stops().filter((s) => s.status !== 'rejected'));
  /** Inicjatywy, z którymi użytkownik miał styczność (zgłosił, zagłosował, skomentował). */
  readonly interactions = computed(() => this.stops().filter(hasInteraction));

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.stops.set(await this.api.list());
    this.loaded.set(true);
  }

  /** Zwraca postać zdobytą za głos albo null, jeśli użytkownik już głosował. */
  async vote(id: number, vote: 'for' | 'against'): Promise<CharacterId | null> {
    const { stop, awarded } = await this.api.vote(id, vote);
    this.replace(stop);
    if (awarded) this.collection.grant(awarded);
    return awarded;
  }

  async comment(id: number, text: string): Promise<void> {
    this.replace(await this.api.comment(id, text));
  }

  async addReport(report: NewReport): Promise<Pokestop> {
    const stop = await this.api.create(report);
    this.stops.update((stops) => [...stops, stop]);
    return stop;
  }

  async setStatus(id: number, status: PokestopStatus): Promise<void> {
    this.replace(await this.api.setStatus(id, status));
  }

  private replace(updated: Pokestop): void {
    this.stops.update((stops) => stops.map((s) => (s.id === updated.id ? updated : s)));
  }
}
