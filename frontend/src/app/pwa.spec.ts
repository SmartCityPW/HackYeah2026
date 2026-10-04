import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Pliki PWA to konfiguracja, a nie kod: te testy pilnują, żeby manifest, ikony i service worker nie rozjechały się po zmianach. */
const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const manifest = JSON.parse(read('public/manifest.webmanifest')) as {
  name: string; short_name: string; start_url: string; display: string; theme_color: string; background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};

describe('PWA', () => {
  it('manifest ma pola wymagane do instalacji', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('kolor motywu zgadza się z tagiem theme-color w index.html', () => {
    expect(read('src/index.html')).toContain(`<meta name="theme-color" content="${manifest.theme_color}">`);
  });

  it('ikony istnieją i obejmują wariant "any" oraz "maskable" w 192 i 512 px', () => {
    for (const icon of manifest.icons) expect(existsSync(join(root, 'public', icon.src)), icon.src).toBe(true);
    for (const purpose of ['any', 'maskable']) {
      for (const size of ['192x192', '512x512']) {
        expect(manifest.icons.some((i) => i.purpose === purpose && i.sizes === size), `${purpose} ${size}`).toBe(true);
      }
    }
  });

  it('index.html wskazuje manifest i ikonę dla iOS', () => {
    const html = read('src/index.html');
    expect(html).toContain('<link rel="manifest" href="manifest.webmanifest">');
    expect(html).toContain('apple-touch-icon');
    expect(existsSync(join(root, 'public/icons/apple-touch-icon.png'))).toBe(true);
  });

  it('build produkcyjny generuje service worker z ngsw-config.json', () => {
    const angular = JSON.parse(read('angular.json'));
    const production = angular.projects.HackYeah2026.architect.build.configurations.production;
    expect(production.serviceWorker).toBe('ngsw-config.json');
    const config = JSON.parse(read('ngsw-config.json')) as { index: string; assetGroups: { resources: { files: string[] } }[] };
    expect(config.index).toBe('/index.html');
    // konfiguracja runtime i żądania do API nie mogą trafić do cache'u service workera
    const cached = config.assetGroups.flatMap((g) => g.resources.files).join(' ');
    expect(cached).not.toContain('config');
  });
});
