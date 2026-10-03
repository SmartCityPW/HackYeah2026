import { Component, inject } from '@angular/core';
import { CollectionService } from '../../core/collection.service';
import { CHARACTERS, CHARACTER_IDS } from '../../core/pokestop.model';
import { ProgressService } from '../../core/progress.service';

/** "Moje Spryciaki": kolekcja postaci zdobytych za udział w inicjatywach. */
@Component({
  selector: 'app-spryciaki-page',
  templateUrl: './spryciaki.page.html',
  styleUrl: './spryciaki.page.css',
})
export class SpryciakiPage {
  protected readonly collection = inject(CollectionService);
  protected readonly progress = inject(ProgressService).progress;
  protected readonly characters = CHARACTER_IDS.map((id) => ({ id, ...CHARACTERS[id] }));
  protected readonly total = CHARACTER_IDS.length;
}
