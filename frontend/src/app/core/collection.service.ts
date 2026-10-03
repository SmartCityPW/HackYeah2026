import { Injectable, computed, inject, signal } from '@angular/core';
import { PokestopApi } from './api/pokestop.api';
import { CHARACTER_IDS, CharacterId } from './pokestop.model';

const EMPTY = Object.fromEntries(CHARACTER_IDS.map((id) => [id, 0])) as Record<CharacterId, number>;

/** Kolekcja postaci użytkownika ("Moje Spryciaki"). */
@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly api = inject(PokestopApi);

  readonly counts = signal<Record<CharacterId, number>>(EMPTY);
  readonly unlocked = computed(() => CHARACTER_IDS.filter((id) => this.counts()[id] > 0).length);

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.counts.set(await this.api.listCollection());
  }

  /** Lokalnie dolicza zdobytą postać (serwer jest źródłem prawdy, `refresh()` ją zsynchronizuje). */
  grant(id: CharacterId): void {
    this.counts.update((c) => ({ ...c, [id]: c[id] + 1 }));
  }
}
