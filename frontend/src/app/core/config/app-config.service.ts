import { Injectable, InjectionToken, inject } from '@angular/core';
import { load } from 'js-yaml';
import { AppConfig, AppConfigError, parseAppConfig } from './app-config';

/** Adres pliku konfiguracji (względem `<base href>`). Można go podmienić przy wdrożeniu przez własny provider. */
export const APP_CONFIG_URL = new InjectionToken<string>('APP_CONFIG_URL', { factory: () => 'config/app-config.yaml' });

/** Konfiguracja wczytywana raz przy starcie (provideAppInitializer w app.config.ts), potem dostępna synchronicznie. */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly url = inject(APP_CONFIG_URL);
  private loaded?: AppConfig;

  get config(): AppConfig {
    if (!this.loaded) {
      throw new AppConfigError('Konfiguracja nie została jeszcze wczytana (sprawdź provideAppInitializer)');
    }
    return this.loaded;
  }

  async load(): Promise<void> {
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new AppConfigError(`Nie udało się pobrać konfiguracji z "${this.url}" (HTTP ${response.status})`);
    }
    this.loaded = parseAppConfig(load(await response.text()));
  }

  /** Do testów: ustawia konfigurację bez pobierania pliku. */
  set(config: AppConfig): void {
    this.loaded = config;
  }
}
