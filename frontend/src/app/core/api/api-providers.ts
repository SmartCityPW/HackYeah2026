import { Provider, inject } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import { AccountApi } from './account.api';
import { MockAccountApi } from './account.api.mock';
import { GameApi } from './game.api';
import { MockGameApi } from './game.api.mock';
import { HttpAccountApi } from './http/http-account.api';
import { HttpGameApi } from './http/http-game.api';
import { HttpPokestopApi } from './http/http-pokestop.api';
import { PokestopApi } from './pokestop.api';
import { MockPokestopApi } from './pokestop.api.mock';

/**
 * Źródło danych per obszar wybiera `api.mode` w konfiguracji: mock (dane w pamięci) albo http (prawdziwy backend).
 * Przejście z atrap na backend dla kolejnego obszaru to zmiana jednej wartości w public/config/app-config.yaml.
 */
export const API_PROVIDERS: Provider[] = [
  MockPokestopApi,
  MockGameApi,
  MockAccountApi,
  { provide: PokestopApi, useFactory: () => inject<PokestopApi>(inject(AppConfigService).config.api.mode.pokestops === 'http' ? HttpPokestopApi : MockPokestopApi) },
  { provide: GameApi, useFactory: () => inject<GameApi>(inject(AppConfigService).config.api.mode.game === 'http' ? HttpGameApi : MockGameApi) },
  { provide: AccountApi, useFactory: () => inject<AccountApi>(inject(AppConfigService).config.api.mode.account === 'http' ? HttpAccountApi : MockAccountApi) },
];
