import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog.service';
import { CollectionService } from '../../core/collection.service';
import { describeError } from '../../core/http/api-error';
import { PokemonService } from '../../core/pokemon.service';
import { PokestopService } from '../../core/pokestop.service';
import { ProgressService } from '../../core/progress.service';
import { SessionService } from '../../core/session.service';
import { ToastService } from '../../core/toast.service';
import { AccountPanel } from '../../shared/account/account-panel';
import { Icon } from '../../shared/icon/icon';
import { SpryciakModel } from '../../shared/spryciak-model/spryciak-model';

/** Ilu najsilniejszych Spryciaków pokazuje profil. */
const TOP = 3;

/** Profil mieszkańca: poziom, najsilniejsze Spryciaki, udział w sprawach miasta i konto. */
@Component({
  selector: 'app-profile-page',
  imports: [RouterLink, AccountPanel, Icon, SpryciakModel],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.css',
})
export class ProfilePage {
  private readonly pokestops = inject(PokestopService);
  private readonly pokemonService = inject(PokemonService);
  protected readonly session = inject(SessionService);
  protected readonly progress = inject(ProgressService).progress;
  protected readonly collection = inject(CollectionService);
  protected readonly catalog = inject(CatalogService);

  /** Najsilniejsze Spryciaki (poziom, potem moc). */
  protected readonly top = computed(() =>
    [...this.pokemonService.pokemons()].sort((a, b) => b.level - a.level || b.power - a.power).slice(0, TOP),
  );
  protected readonly ownedCount = computed(() => this.pokemonService.pokemons().length);

  /** Udział w sprawach miasta, policzony z pinezek, z którymi gracz miał styczność. */
  protected readonly stats = computed(() => {
    const items = this.pokestops.interactions();
    const mine = items.filter((s) => s.mine);
    return [
      { value: mine.filter((s) => s.type === 'report').length, label: 'zgłoszonych problemów' },
      { value: mine.filter((s) => s.type === 'idea' || s.type === 'place').length, label: 'pomysłów i miejsc' },
      { value: items.filter((s) => s.myVote !== null).length, label: 'oddanych głosów' },
      { value: items.filter((s) => s.type === 'consultation' && s.myVote !== null).length, label: 'konsultacji z Twoim głosem' },
      { value: items.filter((s) => s.type === 'ngo' && s.myVote !== null).length, label: 'poparte inicjatywy NGO' },
      { value: items.filter((s) => s.status === 'resolved').length, label: 'załatwionych spraw' },
    ];
  });

  constructor() {
    const toast = inject(ToastService);
    const report = (error: unknown) => toast.show(describeError(error));
    void this.pokestops.loadInteractions().catch(report);
    void this.pokemonService.refresh().catch(report);
    void this.collection.refresh().catch(() => undefined);
  }
}
