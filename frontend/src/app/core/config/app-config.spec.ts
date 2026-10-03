import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { AppConfigError, parseAppConfig } from './app-config';

const REAL_FILE = 'public/config/app-config.yaml';
const realYaml = () => load(readFileSync(REAL_FILE, 'utf-8')) as Record<string, any>;

describe('parseAppConfig', () => {
  it('accepts the real public/config/app-config.yaml', () => {
    const config = parseAppConfig(realYaml());
    expect(config.api.mode.pokestops).toMatch(/^(mock|http)$/);
    expect(config.map.center.lat).toBeGreaterThan(-90);
    expect(config.upload.maxPhotos).toBeGreaterThan(0);
  });

  it('strips a trailing slash from the API address', () => {
    const raw = realYaml();
    raw['api'].baseUrl = 'http://localhost:8000/api/v1///';
    expect(parseAppConfig(raw).api.baseUrl).toBe('http://localhost:8000/api/v1');
  });

  it('names the exact key path of a missing section', () => {
    const raw = realYaml();
    delete raw['map'];
    expect(() => parseAppConfig(raw)).toThrowError(new AppConfigError('Konfiguracja: brak sekcji "map"'));
  });

  it('rejects a value of the wrong type with its path', () => {
    const raw = realYaml();
    raw['upload'].maxPhotos = '3';
    expect(() => parseAppConfig(raw)).toThrowError('"upload.maxPhotos" musi być typu number');
  });

  it('rejects an unknown api mode', () => {
    const raw = realYaml();
    raw['api'].mode.game = 'sqlite';
    expect(() => parseAppConfig(raw)).toThrowError('"api.mode.game" musi mieć wartość mock albo http');
  });

  it('requires the account mode and the new ui and upload keys', () => {
    for (const [section, key] of [['api.mode', 'account'], ['ui', 'commentsPageSize'], ['ui', 'mapReloadDebounceMs'], ['upload', 'enabled'], ['api.mode', 'scenarios'], ['auth', 'passwordMinLength'], ['game', 'maxTeamSize'], ['game', 'actionDwellSeconds'], ['game', 'battleClashMs']]) {
      const raw = realYaml();
      const target = section === 'api.mode' ? raw['api'].mode : raw[section];
      delete target[key];
      expect(() => parseAppConfig(raw), `${section}.${key}`).toThrowError(AppConfigError);
    }
  });

  it('rejects an empty document', () => {
    expect(() => parseAppConfig(null)).toThrowError(AppConfigError);
  });
});
