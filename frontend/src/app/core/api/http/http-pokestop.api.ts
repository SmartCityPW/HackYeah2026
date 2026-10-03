import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { NotAdaptedYet, toApiError } from '../../http/api-error';
import { CharacterId, NewReport, Pokestop, PokestopStatus, VoteResult } from '../../pokestop.model';
import { PokestopApi } from '../pokestop.api';
import { PageDto, PokestopDto } from './contract.types';
import { toPokestop } from './pokestop.mapper';

/** Maksymalny rozmiar strony akceptowany przez backend (pokestops.max_page_size w backend/config/default.yaml). */
const PAGE_SIZE = 200;

/**
 * Implementacja `PokestopApi` na prawdziwym backendzie (api.mode.pokestops: http).
 * Gotowe: odczyt listy i kolekcji, zmiana statusu. Reszta wymaga zmian w interfejsie, które opisuje
 * docs/frontend-adaptation.md (wybór pokemona, pozycja użytkownika, komentarze, zdjęcia).
 */
@Injectable({ providedIn: 'root' })
export class HttpPokestopApi extends PokestopApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AppConfigService).config.api.baseUrl;

  async list(): Promise<Pokestop[]> {
    // TODO (adaptacja): ładowanie wg widocznego fragmentu mapy (?bbox=) i stronicowanie zamiast jednej dużej strony.
    const page = await this.get<PageDto<PokestopDto>>(`/pokestops?pageSize=${PAGE_SIZE}`);
    return page.results.map(toPokestop);
  }

  async listCollection(): Promise<Record<CharacterId, number>> {
    return this.get<Record<CharacterId, number>>('/me/collection');
  }

  async setStatus(id: number, status: PokestopStatus): Promise<Pokestop> {
    // Odrzucenie wymaga powodu (`note`). TODO (adaptacja): pole powodu w widoku moderacji.
    const note = status === 'rejected' ? 'Odrzucone przez administratora' : undefined;
    const dto = await this.send<PokestopDto>('PATCH', `/pokestops/${id}`, { status, note });
    return toPokestop(dto);
  }

  async vote(_id: number, _vote: 'for' | 'against'): Promise<VoteResult> {
    throw new NotAdaptedYet('głosowanie', 'Backend wymaga pokemonId (wybór pokemona z GET /me/pokemons) oraz pozycji użytkownika. Zob. api-contract.md, punkty 9 i 14.');
  }

  async comment(_id: number, _text: string): Promise<Pokestop> {
    throw new NotAdaptedYet('komentarze', 'Użyj POST/GET /pokestops/{id}/comments (stronicowane, z odpowiedziami). Zob. api-contract.md, punkt 17.');
  }

  async create(_report: NewReport): Promise<Pokestop> {
    throw new NotAdaptedYet('tworzenie zgłoszenia', 'Backend wymaga stakedPokemonId dla report/idea i zdjęć wgranych wcześniej (photoIds). Zob. api-contract.md, punkty 1 i 12.');
  }

  private async get<T>(path: string): Promise<T> {
    return this.send<T>('GET', path);
  }

  private async send<T>(method: 'GET' | 'PATCH', path: string, body?: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.http.request<T>(method, `${this.base}${path}`, { body }));
    } catch (error) {
      throw toApiError(error);
    }
  }
}
