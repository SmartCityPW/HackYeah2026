import { Injectable, inject } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import { AttackResult, Encounter, PlayerProgress, Position } from '../game.model';
import { distanceMeters } from '../geo.utils';
import { GameApi } from './game.api';

const XP_PER_LEVEL = 100;

const toProgress = (xp: number): PlayerProgress => ({
  level: Math.floor(xp / XP_PER_LEVEL) + 1,
  xp,
  xpIntoLevel: xp % XP_PER_LEVEL,
  xpForNextLevel: XP_PER_LEVEL,
});

/** Przesunięcie o `dn` metrów na północ i `de` metrów na wschód. */
const offset = (origin: Position, dn: number, de: number): Position => ({
  lat: origin.lat + dn / 111_320,
  lng: origin.lng + de / (111_320 * Math.cos((origin.lat * Math.PI) / 180)),
});

const TEMPLATES: Omit<Encounter, 'id' | 'lat' | 'lng' | 'expiresAt'>[] = [
  { name: 'Korek Komunikacyjny', emoji: '🚗', level: 3, description: 'Zablokował skrzyżowanie i nie chce odjechać.', actionLabel: 'Stań przy skrzyżowaniu i rozładuj korek', xpReward: 40 },
  { name: 'Śmieciowy Potwór', emoji: '🗑️', level: 2, description: 'Rośnie przy każdym wyrzuconym papierku.', actionLabel: 'Wyrzuć jedną śmieć do kosza w pobliżu', xpReward: 25 },
  { name: 'Smogowy Duch', emoji: '🌫️', level: 4, description: 'Unosi się nad miastem w zimne dni.', actionLabel: 'Weź kilka głębokich wdechów, ale daleko od ulicy', xpReward: 55 },
  { name: 'Betonowy Golem', emoji: '🧱', level: 5, description: 'Zabetonował skwer, na którym miała rosnąć trawa.', actionLabel: 'Dotknij najbliższego drzewa', xpReward: 70 },
];

/** Atrapa backendu gry: sama generuje przeciwników i rozstrzyga walki, jak zrobiłby to serwer. */
@Injectable()
export class MockGameApi extends GameApi {
  private readonly rangeM = inject(AppConfigService).config.game.interactionRangeM;
  private xp = 120;
  private encounters: Encounter[] = [];
  private nextId = 1;

  async listEncounters(around: Position): Promise<Encounter[]> {
    if (this.encounters.length === 0) this.encounters = this.spawn(around);
    return JSON.parse(JSON.stringify(this.encounters));
  }

  async attack(id: number, position: Position): Promise<AttackResult> {
    const target = this.encounters.find((e) => e.id === id);
    if (!target) throw new Error(`Przeciwnik ${id} już nie istnieje`);
    const distanceM = Math.round(distanceMeters(position, target));
    if (distanceM > this.rangeM) return { outcome: 'too_far', distanceM };
    this.encounters = this.encounters.filter((e) => e.id !== id);
    this.xp += target.xpReward;
    return { outcome: 'won', xpGained: target.xpReward, progress: toProgress(this.xp) };
  }

  async getProgress(): Promise<PlayerProgress> {
    return toProgress(this.xp);
  }

  private spawn(around: Position): Encounter[] {
    // Pierwszy przeciwnik stoi blisko środka (do łatwego demo), reszta rozrzucona w okolicy.
    const spots: [number, number][] = [[18, 12], [140, -90], [-120, 180], [230, 160]];
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    return TEMPLATES.map((t, i) => ({ ...t, id: this.nextId++, ...offset(around, spots[i][0], spots[i][1]), expiresAt }));
  }
}
