import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { PokestopApi } from './core/api/pokestop.api';
import { MockPokestopApi } from './core/api/pokestop.api.mock';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Podmiana na backend: zamienić na implementację HTTP (np. `HttpPokestopApi`).
    { provide: PokestopApi, useClass: MockPokestopApi },
  ],
};
