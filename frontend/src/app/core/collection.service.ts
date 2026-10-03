import { Injectable, computed, inject, signal } from '@angular/core';
import { PokestopApi } from './api/pokestop.api';
import { CatalogService } from './catalog/catalog.service';
import { CharacterId } from './pokestop.model';

/** Kolekcja postaci użytkownika ("Moje Spryciaki"): liczba posiadanych sztuk każdego gatunku ze słownika. */
@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly api = inject(PokestopApi);
  private readonly catalog = inject(CatalogService);

  readonly counts = signal<Record<CharacterId, number>>({});
  readonly unlocked = computed(() => this.catalog.characters().filter((c) => (this.counts()[c.code] ?? 0) > 0).length);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.counts.set(await this.api.listCollection());
  }
}
