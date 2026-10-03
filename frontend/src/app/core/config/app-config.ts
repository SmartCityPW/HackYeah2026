/** Typowany kształt konfiguracji z `public/config/app-config.yaml`. */
export type ApiMode = 'mock' | 'http';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface AppConfig {
  api: { baseUrl: string; mode: { pokestops: ApiMode; game: ApiMode; account: ApiMode; scenarios: ApiMode; catalog: ApiMode } };
  auth: { storageKeyPrefix: string; autoGuest: boolean; passwordMinLength: number };
  map: { styleUrl: string; workerUrl: string; center: LatLng; zoom: number; pitch: number; bearing: number };
  game: {
    /** Promień kółka interakcji wokół gracza (głos, nowa pinezka, walka). Do wyświetlania: egzekwuje backend. */
    interactionRangeM: number;
    simulatedGps: LatLng;
    /** Ilu pokemonów można najwyżej wystawić do jednej walki. */
    maxTeamSize: number;
    /** Mnożnik mocy pokemona, którego typ = typ przeciwnika (do podglądu: wynik liczy backend). */
    typeMultiplier: number;
    /** "Akcja na miejscu": tyle sekund trzeba wytrwać w kółku przy przeciwniku, zanim można wybrać drużynę. */
    actionDwellSeconds: number;
    /** Tyle sekund gracz ma na powrót do kółka podczas walki, zanim ta się przerwie (GPS potrafi na chwilę "skoczyć"). */
    leaveGraceSeconds: number;
    /** Po tylu metrach ruchu pytamy backend o przeciwników na nowo. */
    encounterRefreshMeters: number;
    /** Odświeżanie przeciwników także na postoju (wygasają, serwer może wygenerować nowych). */
    encounterRefreshSeconds: number;
    /** Najkrótszy czas animacji starcia (wynik i tak przychodzi z backendu). */
    battleClashMs: number;
  };
  upload: { enabled: boolean; maxPhotos: number; maxPhotoBytes: number };
  ui: { toastMs: number; commentsPageSize: number; mapReloadDebounceMs: number };
  dev: { tools: boolean };
}

export class AppConfigError extends Error {}

type Obj = Record<string, unknown>;

function section(parent: unknown, key: string, path: string): Obj {
  const value = (parent as Obj | undefined)?.[key];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppConfigError(`Konfiguracja: brak sekcji "${path}"`);
  }
  return value as Obj;
}

function typed<T>(parent: Obj, key: string, path: string, type: 'string' | 'number' | 'boolean'): T {
  const value = parent[key];
  if (typeof value !== type) {
    throw new AppConfigError(`Konfiguracja: "${path}" musi być typu ${type}`);
  }
  return value as T;
}

const text = (p: Obj, k: string, path: string) => typed<string>(p, k, path, 'string');
const num = (p: Obj, k: string, path: string) => typed<number>(p, k, path, 'number');
const flag = (p: Obj, k: string, path: string) => typed<boolean>(p, k, path, 'boolean');

function mode(p: Obj, k: string, path: string): ApiMode {
  const value = p[k];
  if (value !== 'mock' && value !== 'http') {
    throw new AppConfigError(`Konfiguracja: "${path}" musi mieć wartość mock albo http`);
  }
  return value;
}

function latLng(parent: Obj, key: string, path: string): LatLng {
  const s = section(parent, key, path);
  return { lat: num(s, 'lat', `${path}.lat`), lng: num(s, 'lng', `${path}.lng`) };
}

/** Waliduje surowy obiekt z YAML-a i zwraca typowaną konfigurację. Błąd wskazuje dokładną ścieżkę klucza. */
export function parseAppConfig(raw: unknown): AppConfig {
  const root = (raw ?? {}) as Obj;
  const api = section(root, 'api', 'api');
  const apiMode = section(api, 'mode', 'api.mode');
  const auth = section(root, 'auth', 'auth');
  const map = section(root, 'map', 'map');
  const game = section(root, 'game', 'game');
  const upload = section(root, 'upload', 'upload');
  const ui = section(root, 'ui', 'ui');
  const dev = section(root, 'dev', 'dev');
  return {
    api: {
      baseUrl: text(api, 'baseUrl', 'api.baseUrl').replace(/\/+$/, ''),
      mode: {
        pokestops: mode(apiMode, 'pokestops', 'api.mode.pokestops'),
        game: mode(apiMode, 'game', 'api.mode.game'),
        account: mode(apiMode, 'account', 'api.mode.account'),
        scenarios: mode(apiMode, 'scenarios', 'api.mode.scenarios'),
        catalog: mode(apiMode, 'catalog', 'api.mode.catalog'),
      },
    },
    auth: {
      storageKeyPrefix: text(auth, 'storageKeyPrefix', 'auth.storageKeyPrefix'),
      autoGuest: flag(auth, 'autoGuest', 'auth.autoGuest'),
      passwordMinLength: num(auth, 'passwordMinLength', 'auth.passwordMinLength'),
    },
    map: {
      styleUrl: text(map, 'styleUrl', 'map.styleUrl'),
      workerUrl: text(map, 'workerUrl', 'map.workerUrl'),
      center: latLng(map, 'center', 'map.center'),
      zoom: num(map, 'zoom', 'map.zoom'),
      pitch: num(map, 'pitch', 'map.pitch'),
      bearing: num(map, 'bearing', 'map.bearing'),
    },
    game: {
      interactionRangeM: num(game, 'interactionRangeM', 'game.interactionRangeM'),
      simulatedGps: latLng(game, 'simulatedGps', 'game.simulatedGps'),
      maxTeamSize: num(game, 'maxTeamSize', 'game.maxTeamSize'),
      typeMultiplier: num(game, 'typeMultiplier', 'game.typeMultiplier'),
      actionDwellSeconds: num(game, 'actionDwellSeconds', 'game.actionDwellSeconds'),
      leaveGraceSeconds: num(game, 'leaveGraceSeconds', 'game.leaveGraceSeconds'),
      encounterRefreshMeters: num(game, 'encounterRefreshMeters', 'game.encounterRefreshMeters'),
      encounterRefreshSeconds: num(game, 'encounterRefreshSeconds', 'game.encounterRefreshSeconds'),
      battleClashMs: num(game, 'battleClashMs', 'game.battleClashMs'),
    },
    upload: {
      enabled: flag(upload, 'enabled', 'upload.enabled'),
      maxPhotos: num(upload, 'maxPhotos', 'upload.maxPhotos'),
      maxPhotoBytes: num(upload, 'maxPhotoBytes', 'upload.maxPhotoBytes'),
    },
    ui: {
      toastMs: num(ui, 'toastMs', 'ui.toastMs'),
      commentsPageSize: num(ui, 'commentsPageSize', 'ui.commentsPageSize'),
      mapReloadDebounceMs: num(ui, 'mapReloadDebounceMs', 'ui.mapReloadDebounceMs'),
    },
    dev: { tools: flag(dev, 'tools', 'dev.tools') },
  };
}
