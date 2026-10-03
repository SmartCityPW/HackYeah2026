import { Injectable, inject, signal } from '@angular/core';
import { GameApi } from './api/game.api';
import { PlayerProgress } from './game.model';

/** Poziom i doświadczenie gracza (wyliczane przez backend). */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly api = inject(GameApi);

  readonly progress = signal<PlayerProgress>({ level: 1, xp: 0, xpIntoLevel: 0, xpForNextLevel: 100 });

  constructor() {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.progress.set(await this.api.getProgress());
  }

  update(progress: PlayerProgress): void {
    this.progress.set(progress);
  }
}
