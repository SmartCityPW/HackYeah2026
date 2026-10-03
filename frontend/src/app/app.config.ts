import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { PokestopApi } from './core/api/pokestop.api';
import { MockPokestopApi } from './core/api/pokestop.api.mock';
import { GameApi } from './core/api/game.api';
import { MockGameApi } from './core/api/game.api.mock';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Podmiana na backend: zamienić na implementację HTTP (np. `HttpPokestopApi`).
    { provide: PokestopApi, useClass: MockPokestopApi },
    { provide: GameApi, useClass: MockGameApi },
  ],
};
