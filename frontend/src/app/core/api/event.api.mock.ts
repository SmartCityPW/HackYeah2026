import { Injectable, inject } from '@angular/core';
import { CatalogService } from '../catalog/catalog.service';
import { AppConfigService } from '../config/app-config.service';
import { CheckInResult, EventQuery, GameEvent, NewEvent } from '../event.model';
import { isActiveNow, nextWindowStart, phaseOf } from '../event.schedule';
import { Position } from '../game.model';
import { distanceMeters } from '../geo.utils';
import { ApiHttpError, TooFarError } from '../http/api-error';
import { Bbox } from '../pokestop.model';
import { EventApi } from './event.api';
import { MockPlayerState } from './mock-player.state';

/** Strefa godzin dziennych w atrapie (backend: `app.timezone`). */
const MOCK_TIMEZONE = 'Europe/Warsaw';
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** Domyślne okno listy: ta sama wartość co backend/config/default.yaml (events.default_window_days). */
const DEFAULT_WINDOW_DAYS = 14;
/** Organizacja konta organizacji w atrapie (zgodna z danymi atrap pinezek). */
const MOCK_ORG = { name: 'Fundacja Zielone Miasto', id: 1 };

type StoredEvent = Omit<GameEvent, 'phase' | 'activeNow' | 'nextWindowStart' | 'participantCount' | 'checkedIn'>;

const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * HOUR_MS).toISOString();

/** Wydarzenia atrap wokół TAURON Areny: jedno trwa (z godzinami dziennymi), jedno jest zapowiedziane, jedno trwa bez godzin dziennych. */
function seedEvents(): StoredEvent[] {
  return [
    {
      id: 1, organization: MOCK_ORG.name, organizationId: MOCK_ORG.id, title: 'Piknik rowerowy przy Arenie',
      description: 'Wspólna jazda po nowej drodze rowerowej, dmuchany tor i serwis rowerów. Zapraszamy całe rodziny, a każdy, kto dojedzie na miejsce, dostanie rzadkiego Złotego Rowera.',
      address: 'Plac przed TAURON Areną Kraków', lat: 50.0675, lng: 19.9915, startsAt: iso(-2), endsAt: iso(70), dailyFrom: '08:00', dailyTo: '22:00',
      rewardCharacter: 'gold_bike', capacity: null, ageMin: null, ageMax: null, status: 'scheduled', mine: true,
    },
    {
      id: 2, organization: MOCK_ORG.name, organizationId: MOCK_ORG.id, title: 'Festiwal Lampionów',
      description: 'Wieczór z lampionami nad Białym Potokiem: warsztaty, muzyka i wspólne puszczanie lampionów. Dla gości mamy rzadkiego Lampiona Festiwalowego.',
      address: 'Skwer przy ul. Lema', lat: 50.069, lng: 19.9896, startsAt: iso(48), endsAt: iso(53), dailyFrom: null, dailyTo: null,
      rewardCharacter: 'lantern', capacity: 100, ageMin: 8, ageMax: null, status: 'scheduled', mine: true,
    },
    {
      id: 3, organization: 'Urząd Miasta Krakowa', organizationId: 2, title: 'Dzień sprzątania skweru',
      description: 'Razem posprzątamy skwer obok Areny: worki, rękawice i napoje zapewnia miasto. Za pomoc rzadki Błyszczący Kosz. Trwa non stop, więc można wpaść o każdej porze.',
      address: 'Skwer obok TAURON Areny', lat: 50.0678, lng: 19.9921, startsAt: iso(-1), endsAt: iso(30), dailyFrom: null, dailyTo: null,
      rewardCharacter: 'shiny_bin', capacity: 30, ageMin: null, ageMax: null, status: 'scheduled', mine: false,
    },
  ];
}

/**
 * Atrapa wydarzeń w pamięci. Egzekwuje te same reguły co serwer: odbiór tylko w kółku interakcji i w czasie trwania
 * (okres plus godziny dzienne), jeden pokemon na uczestnika, limit miejsc, nagroda tylko z katalogu rzadkich gatunków.
 */
@Injectable()
export class MockEventApi extends EventApi {
  private readonly range = inject(AppConfigService).config.game.interactionRangeM;
  private readonly player = inject(MockPlayerState);
  private readonly catalog = inject(CatalogService);
  private readonly events = seedEvents();
  private readonly participants = new Map<number, number>([[1, 12], [2, 0], [3, 7]]);
  private readonly mine = new Set<number>();

  async list(area?: Bbox, query: EventQuery = {}): Promise<GameEvent[]> {
    const from = Date.parse(query.from ?? new Date().toISOString());
    const to = Date.parse(query.to ?? new Date(Date.now() + DEFAULT_WINDOW_DAYS * DAY_MS).toISOString());
    const inArea = (e: StoredEvent) => !area || (e.lng >= area.west && e.lng <= area.east && e.lat >= area.south && e.lat <= area.north);
    const showCancelled = query.organizationId !== undefined || !!query.managed;
    return this.events
      .filter((e) => Date.parse(e.endsAt) >= from && Date.parse(e.startsAt) <= to && inArea(e))
      .filter((e) => (query.organizationId === undefined || e.organizationId === query.organizationId) && (!query.managed || e.mine) && (showCancelled || e.status !== 'cancelled'))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .map((e) => this.view(e));
  }

  async get(id: number): Promise<GameEvent> {
    return this.view(this.require(id));
  }

  async create(draft: NewEvent): Promise<GameEvent> {
    const errors: Record<string, string> = {};
    if (draft.title.trim().length < 3) errors['title'] = 'Tytuł ma mieć co najmniej 3 znaki';
    if (Date.parse(draft.endsAt) <= Date.parse(draft.startsAt)) errors['endsAt'] = 'Koniec musi być później niż początek';
    else if (Date.parse(draft.endsAt) <= Date.now()) errors['endsAt'] = 'Wydarzenie nie może być już zakończone';
    if (!!draft.dailyFrom !== !!draft.dailyTo) errors['dailyFrom'] = 'Podaj obie godziny dzienne albo żadnej';
    else if (draft.dailyFrom && draft.dailyTo && draft.dailyFrom >= draft.dailyTo) errors['dailyTo'] = 'Godzina końca musi być późniejsza niż początku';
    if (!this.catalog.character(draft.rewardCharacter).isEventExclusive) errors['rewardCharacter'] = 'Nagrodą może być tylko rzadki gatunek wyłączny dla wydarzeń';
    if (Object.keys(errors).length) throw new ApiHttpError(422, 'validation_error', 'Błędne dane', errors);
    const stored: StoredEvent = {
      id: Math.max(0, ...this.events.map((e) => e.id)) + 1, organization: MOCK_ORG.name, organizationId: MOCK_ORG.id, title: draft.title.trim(),
      description: draft.description.trim(), address: draft.address?.trim() || null, lat: draft.lat, lng: draft.lng, startsAt: draft.startsAt, endsAt: draft.endsAt,
      dailyFrom: draft.dailyFrom || null, dailyTo: draft.dailyTo || null, rewardCharacter: draft.rewardCharacter, capacity: draft.capacity ?? null,
      ageMin: draft.ageMin ?? null, ageMax: draft.ageMax ?? null, status: 'scheduled', mine: true,
    };
    this.events.push(stored);
    return this.view(stored);
  }

  async cancel(id: number): Promise<GameEvent> {
    const event = this.require(id);
    event.status = 'cancelled';
    return this.view(event);
  }

  async checkIn(id: number, position: Position): Promise<CheckInResult> {
    const event = this.require(id);
    const now = new Date();
    if (event.status === 'cancelled') throw new ApiHttpError(409, 'event_cancelled', 'To wydarzenie zostało odwołane.');
    if (this.mine.has(id)) throw new ApiHttpError(409, 'already_checked_in', 'Już odebrałeś nagrodę z tego wydarzenia.');
    if (!isActiveNow(event, now, MOCK_TIMEZONE)) throw new ApiHttpError(409, 'outside_time_window', this.windowMessage(event, now));
    const distanceM = Math.round(distanceMeters(position, event));
    if (distanceM > this.range) throw new TooFarError(distanceM, this.range, `Jesteś za daleko (${distanceM} m), podejdź na mniej niż ${this.range} m`);
    if (event.capacity !== null && (this.participants.get(id) ?? 0) >= event.capacity) throw new ApiHttpError(409, 'capacity_reached', 'Limit miejsc na tym wydarzeniu został wyczerpany.');
    this.mine.add(id);
    this.participants.set(id, (this.participants.get(id) ?? 0) + 1);
    return { event: this.view(event), pokemon: this.player.toPokemon(this.player.add(event.rewardCharacter)) };
  }

  private windowMessage(event: StoredEvent, now: Date): string {
    if (phaseOf(event, now) === 'ended') return 'To wydarzenie już się zakończyło.';
    const opens = nextWindowStart(event, now, MOCK_TIMEZONE);
    return opens ? `Nagrodę odbierzesz od ${new Date(opens).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: MOCK_TIMEZONE })}.` : 'Nagrodę można odebrać tylko w czasie trwania wydarzenia.';
  }

  /** Wydarzenie z polami liczonymi na bieżąco (etap, czy można odebrać, najbliższe okno, liczba uczestników). */
  private view(event: StoredEvent): GameEvent {
    const now = new Date();
    return structuredClone({
      ...event,
      phase: phaseOf(event, now),
      activeNow: isActiveNow(event, now, MOCK_TIMEZONE),
      nextWindowStart: nextWindowStart(event, now, MOCK_TIMEZONE),
      participantCount: this.participants.get(event.id) ?? 0,
      checkedIn: this.mine.has(event.id),
    });
  }

  private require(id: number): StoredEvent {
    const event = this.events.find((e) => e.id === id);
    if (!event) throw new ApiHttpError(404, 'not_found', `Wydarzenie ${id} nie istnieje.`);
    return event;
  }
}
