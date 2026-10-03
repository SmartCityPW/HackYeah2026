import { Injectable } from '@angular/core';
import { INTERACTION_RADIUS_M, MAX_ENEMIES_IN_RANGE, MIN_ENEMIES_IN_RANGE, AttackResult, Encounter, PlayerProgress, Position } from '../game.model';
import { distanceMeters, offsetMeters } from '../geo.utils';
import { GameApi } from './game.api';

const XP_PER_LEVEL = 100;
const LIFETIME_MS = 30 * 60_000;
/** Po tylu metrach marszu serwer losuje na nowo, ilu przeciwników ma być w kółku. */
const REROLL_AFTER_M = 40;
/** Przeciwnicy nie pojawiają się tuż na krawędzi kółka ani pod nogami gracza. */
const SPAWN_MIN_M = 8;
const SPAWN_EDGE_MARGIN = 0.9;

const toProgress = (xp: number): PlayerProgress => ({
  level: Math.floor(xp / XP_PER_LEVEL) + 1,
  xp,
  xpIntoLevel: xp % XP_PER_LEVEL,
  xpForNextLevel: XP_PER_LEVEL,
});

const TEMPLATES: Omit<Encounter, 'id' | 'lat' | 'lng' | 'expiresAt'>[] = [
  { name: 'Korek Komunikacyjny', emoji: '🚗', level: 3, description: 'Zablokował skrzyżowanie i nie chce odjechać.', actionLabel: 'Stań przy skrzyżowaniu i rozładuj korek', xpReward: 40 },
  { name: 'Śmieciowy Potwór', emoji: '🗑️', level: 2, description: 'Rośnie przy każdym wyrzuconym papierku.', actionLabel: 'Wyrzuć jedną śmieć do kosza w pobliżu', xpReward: 25 },
  { name: 'Smogowy Duch', emoji: '🌫️', level: 4, description: 'Unosi się nad miastem w zimne dni.', actionLabel: 'Weź kilka głębokich wdechów, ale daleko od ulicy', xpReward: 55 },
  { name: 'Betonowy Golem', emoji: '🧱', level: 5, description: 'Zabetonował skwer, na którym miała rosnąć trawa.', actionLabel: 'Dotknij najbliższego drzewa', xpReward: 70 },
];

/**
 * Atrapa backendu gry: sama generuje przeciwników i rozstrzyga walki, jak zrobiłby to serwer.
 * W kółku gracza krąży od MIN do MAX przeciwników; ci, od których gracz odszedł (albo wygaśli), znikają,
 * a w ich miejsce pojawiają się nowi wokół aktualnej pozycji.
 */
@Injectable()
export class MockGameApi extends GameApi {
  /** Źródło losowości (do podmiany w testach). */
  random: () => number = Math.random;

  private xp = 120;
  private encounters: Encounter[] = [];
  private nextId = 1;
  private target = 0;
  private rolledAt?: Position;

  async listEncounters(around: Position, radiusM: number): Promise<Encounter[]> {
    const now = Date.now();
    this.encounters = this.encounters.filter((e) => Date.parse(e.expiresAt) > now && distanceMeters(around, e) <= radiusM);
    if (!this.rolledAt || distanceMeters(this.rolledAt, around) >= REROLL_AFTER_M) {
      this.rolledAt = around;
      this.target = MIN_ENEMIES_IN_RANGE + Math.floor(this.random() * (MAX_ENEMIES_IN_RANGE - MIN_ENEMIES_IN_RANGE + 1));
    }
    while (this.encounters.length < this.target) this.encounters.push(this.spawn(around, radiusM, now));
    return JSON.parse(JSON.stringify(this.encounters));
  }

  async attack(id: number, position: Position): Promise<AttackResult> {
    const target = this.encounters.find((e) => e.id === id);
    if (!target) throw new Error(`Przeciwnik ${id} już nie istnieje`);
    const distanceM = Math.round(distanceMeters(position, target));
    if (distanceM > INTERACTION_RADIUS_M) return { outcome: 'too_far', distanceM };
    this.encounters = this.encounters.filter((e) => e.id !== id);
    this.xp += target.xpReward;
    return { outcome: 'won', xpGained: target.xpReward, progress: toProgress(this.xp) };
  }

  async getProgress(): Promise<PlayerProgress> {
    return toProgress(this.xp);
  }

  /** Losowy punkt w kółku (równomiernie po powierzchni) i losowy szablon przeciwnika. */
  private spawn(around: Position, radiusM: number, now: number): Encounter {
    const maxR = radiusM * SPAWN_EDGE_MARGIN;
    const r = Math.sqrt(SPAWN_MIN_M ** 2 + this.random() * (maxR ** 2 - SPAWN_MIN_M ** 2));
    const angle = this.random() * 2 * Math.PI;
    const template = TEMPLATES[Math.floor(this.random() * TEMPLATES.length)];
    return {
      ...template,
      id: this.nextId++,
      ...offsetMeters(around, r * Math.cos(angle), r * Math.sin(angle)),
      expiresAt: new Date(now + LIFETIME_MS).toISOString(),
    };
  }
}
