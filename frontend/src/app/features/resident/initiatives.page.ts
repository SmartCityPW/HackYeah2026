import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MAP_PATH } from '../../core/navigation';
import { PokestopService } from '../../core/pokestop.service';
import { Pokestop } from '../../core/pokestop.model';
import { SessionService } from '../../core/session.service';
import { InitiativeCard } from '../../shared/initiative-card/initiative-card';

type Filter = 'all' | 'mine' | 'voted' | 'resolved';

const FILTERS: { id: Filter; label: string; matches: (s: Pokestop) => boolean }[] = [
  { id: 'all', label: 'Wszystkie', matches: () => true },
  { id: 'mine', label: 'Moje zgłoszenia', matches: (s) => !!s.mine },
  { id: 'voted', label: 'Oddane głosy', matches: (s) => s.myVote !== null },
  { id: 'resolved', label: 'Załatwione', matches: (s) => s.status === 'resolved' },
];

/** Stan inicjatyw, z którymi użytkownik miał styczność (zgłosił, zagłosował, skomentował). */
@Component({
  selector: 'app-initiatives-page',
  imports: [InitiativeCard],
  templateUrl: './initiatives.page.html',
})
export class InitiativesPage {
  private readonly pokestops = inject(PokestopService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  protected readonly filters = FILTERS;
  protected readonly filter = signal<Filter>('all');
  protected readonly items = computed(() => {
    const matches = FILTERS.find((f) => f.id === this.filter())!.matches;
    return this.pokestops.interactions().filter(matches);
  });

  protected showOnMap(id: number): void {
    void this.router.navigate([MAP_PATH[this.session.role()]], { queryParams: { stop: id } });
  }
}
