import { Injectable, computed, inject, signal } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import { Catalog, CatalogCharacter } from './catalog.model';
import mockCatalog from './catalog.mock.json';

/**
 * Słownik postaci, jeden dla całej aplikacji. W trybie `api.mode.catalog: http` pobierany z `GET /catalog` przy starcie,
 * w trybie atrap pochodzi z `catalog.mock.json`, wygenerowanego z tego samego pliku co dane backendu
 * (`python manage.py export_reference`). Kodów postaci nie wpisujemy w kodzie.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly appConfig = inject(AppConfigService);
  private readonly data = signal<Catalog>(mockCatalog as Catalog);
  private readonly byCode = computed(() => new Map(this.data().characters.map((c) => [c.code, c])));

  readonly characters = computed(() => this.data().characters);

  /** Wywoływane raz przy starcie (provideAppInitializer), po wczytaniu konfiguracji. */
  async load(): Promise<void> {
    const { api } = this.appConfig.config;
    if (api.mode.catalog !== 'http') return;
    const response = await fetch(`${api.baseUrl}/catalog`);
    if (!response.ok) throw new Error(`Nie udało się pobrać katalogu postaci (HTTP ${response.status})`);
    this.data.set((await response.json()) as Catalog);
  }

  /** Postać po kodzie. Nieznany kod (np. wycofana postać na starym koncie) daje zastępczy opis zamiast błędu. */
  character(code: string): CatalogCharacter {
    return this.byCode().get(code) ?? unknownCharacter(code);
  }

  /** Do testów: podmienia słownik. */
  set(catalog: Catalog): void {
    this.data.set(catalog);
  }
}

function unknownCharacter(code: string): CatalogCharacter {
  return {
    code, label: code, emoji: '❔', categoryLabel: '', typeCode: 'infra', modelPath: null,
    isStarter: false, isEventExclusive: false, basePower: 1, powerGrowth: 1,
  };
}
