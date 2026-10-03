import { Provider } from '@angular/core';
import { AppConfig } from './app-config';
import { AppConfigService } from './app-config.service';

/** Konfiguracja do testów jednostkowych (te same klucze co w public/config/app-config.yaml). */
export const TEST_CONFIG: AppConfig = {
  api: { baseUrl: 'http://api.test/api/v1', mode: { pokestops: 'mock', game: 'mock', account: 'mock', scenarios: 'mock', catalog: 'mock' } },
  auth: { storageKeyPrefix: 'test', autoGuest: true, passwordMinLength: 8 },
  map: { styleUrl: 'http://tiles.test/style', workerUrl: '/worker.mjs', center: { lat: 50.0617, lng: 19.9373 }, zoom: 16, pitch: 50, bearing: 0 },
  game: {
    interactionRangeM: 50, simulatedGps: { lat: 50.0617, lng: 19.9373 }, maxTeamSize: 3, typeMultiplier: 1.2,
    actionDwellSeconds: 3, leaveGraceSeconds: 2, encounterRefreshMeters: 10, encounterRefreshSeconds: 30, battleClashMs: 0,
  },
  upload: { enabled: true, maxPhotos: 3, maxPhotoBytes: 5 * 1024 * 1024 },
  ui: { toastMs: 3000, commentsPageSize: 2, mapReloadDebounceMs: 0 },
  dev: { tools: true },
};

/** Provider ustawiający konfigurację testową zamiast pobierania YAML-a. */
export function provideTestConfig(override: Partial<AppConfig> = {}): Provider {
  return {
    provide: AppConfigService,
    useFactory: () => {
      const service = new AppConfigService();
      service.set({ ...TEST_CONFIG, ...override });
      return service;
    },
  };
}
