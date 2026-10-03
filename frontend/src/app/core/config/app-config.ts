/** Typowany kształt konfiguracji z `public/config/app-config.yaml`. */
export type ApiMode = 'mock' | 'http';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface AppConfig {
  api: { baseUrl: string; mode: { pokestops: ApiMode; game: ApiMode } };
  auth: { storageKeyPrefix: string; autoGuest: boolean };
  map: { styleUrl: string; workerUrl: string; center: LatLng; zoom: number; pitch: number; bearing: number };
  game: { interactionRangeM: number; simulatedGps: LatLng };
  upload: { maxPhotos: number; maxPhotoBytes: number };
  ui: { toastMs: number };
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
      mode: { pokestops: mode(apiMode, 'pokestops', 'api.mode.pokestops'), game: mode(apiMode, 'game', 'api.mode.game') },
    },
    auth: { storageKeyPrefix: text(auth, 'storageKeyPrefix', 'auth.storageKeyPrefix'), autoGuest: flag(auth, 'autoGuest', 'auth.autoGuest') },
    map: {
      styleUrl: text(map, 'styleUrl', 'map.styleUrl'),
      workerUrl: text(map, 'workerUrl', 'map.workerUrl'),
      center: latLng(map, 'center', 'map.center'),
      zoom: num(map, 'zoom', 'map.zoom'),
      pitch: num(map, 'pitch', 'map.pitch'),
      bearing: num(map, 'bearing', 'map.bearing'),
    },
    game: { interactionRangeM: num(game, 'interactionRangeM', 'game.interactionRangeM'), simulatedGps: latLng(game, 'simulatedGps', 'game.simulatedGps') },
    upload: { maxPhotos: num(upload, 'maxPhotos', 'upload.maxPhotos'), maxPhotoBytes: num(upload, 'maxPhotoBytes', 'upload.maxPhotoBytes') },
    ui: { toastMs: num(ui, 'toastMs', 'ui.toastMs') },
    dev: { tools: flag(dev, 'tools', 'dev.tools') },
  };
}
