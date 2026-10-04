import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/catalog/catalog.service';
import { TYPES } from '../../core/game.model';
import { Pokemon } from '../../core/pokemon.model';
import { SpryciakModel } from '../spryciak-model/spryciak-model';

/**
 * Ekran nagrody: nowy Spryciak z obracającym się modelem 3D, typem, mocą i poziomem. Używany po ankiecie i po odebraniu pokemona
 * z wydarzenia. Rzadki gatunek (wyłączny dla wydarzeń) dostaje wyróżnioną etykietę.
 */
@Component({
  selector: 'app-reward',
  imports: [SpryciakModel, RouterLink],
  templateUrl: './reward.html',
  styleUrl: './reward.css',
})
export class Reward {
  private readonly catalog = inject(CatalogService);

  readonly pokemon = input.required<Pokemon>();
  /** Nadtytuł nad nagłówkiem (np. skąd nagroda). */
  readonly kicker = input('');
  readonly heading = input('Wpadł Ci nowy Spryciak!');
  readonly note = input('Dołączył do Twoich Spryciaków. Zdobywa exp, gdy głosujesz, i pomaga w walkach.');
  readonly closed = output<void>();

  protected readonly types = TYPES;
  protected readonly species = computed(() => this.catalog.character(this.pokemon().character));
}
