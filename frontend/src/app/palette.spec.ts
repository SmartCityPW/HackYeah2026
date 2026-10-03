import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pilnuje palety projektu (docs/paleta-hackyeah.pdf): kolory żyją tylko w tokenach `styles.css`,
 * a pary tekst/tło z tokenów mają kontrast WCAG AA (4,5:1).
 */
const SRC = 'src';
const PALETTE = { plum: '#4f345a', mist: '#f5efff', lavender: '#cdc1ff', pink: '#ea638c', indigo: '#7371fc' };
const WHITE = '#ffffff';

// Pliki, w których kolory mogą być zapisane na stałe: sam rejestr tokenów, <meta theme-color> i modele 3D (kolory postaci).
const ALLOWED = [join(SRC, 'styles.css'), join(SRC, 'index.html'), join(SRC, 'app/features/map/three')];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, percentOfA: number) =>
  '#' + rgb(a).map((v, i) => Math.round((v * percentOfA + rgb(b)[i] * (100 - percentOfA)) / 100).toString(16).padStart(2, '0')).join('');
const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('palette', () => {
  it('styles.css defines exactly the five project colors', () => {
    const css = readFileSync(join(SRC, 'styles.css'), 'utf-8').toLowerCase();
    for (const [name, hex] of Object.entries(PALETTE)) expect(css, name).toContain(`--color-${name}: ${hex};`);
  });

  it('no hard-coded colors outside the token registry (use var(--...) tokens)', () => {
    const offenders = files(SRC)
      .filter((f) => /\.(css|html|ts)$/.test(f) && !/\.spec\.ts$/.test(f) && !ALLOWED.some((a) => f.startsWith(a)))
      .flatMap((f) =>
        readFileSync(f, 'utf-8')
          .split('\n')
          .map((line, i) => ({ f, line: i + 1, text: line }))
          .filter(({ text }) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(text)),
      )
      .map(({ f, line }) => `${f}:${line}`);
    expect(offenders).toEqual([]);
  });

  it('text/background pairs from the tokens meet WCAG AA (4.5:1)', () => {
    const { plum, mist, lavender, pink, indigo } = PALETTE;
    const textMuted = mix(plum, WHITE, 78);
    const brandStrong = mix(indigo, plum, 55);
    const accentStrong = mix(pink, plum, 55);
    const accentInk = mix(pink, plum, 40);
    const accentTint = mix(pink, WHITE, 22);
    const tint = mix(lavender, WHITE, 40);
    const enemyBar = mix(pink, WHITE, 45);
    const pairs: [string, string, string][] = [
      ['text on bg', plum, mist],
      ['text on surface', plum, WHITE],
      ['muted text on surface', textMuted, WHITE],
      ['muted text on bg', textMuted, mist],
      ['white on brand-strong (primary button, open status)', WHITE, brandStrong],
      ['white on accent-strong (against button, rejected status)', WHITE, accentStrong],
      ['brand-strong text on tint (active chip, badge)', brandStrong, tint],
      ['brand-strong text on bg', brandStrong, mist],
      ['accent-ink text on accent-tint (danger button, pending badge)', accentInk, accentTint],
      ['text on lavender (in-progress status)', plum, lavender],
      ['mist on plum (resolved status, toast)', mist, plum],
      ['text on the power bar of the team (lavender)', plum, lavender],
      ['text on the power bar of the enemy (light pink)', plum, enemyBar],
      ['accent-ink on bg (battle kicker, warnings)', accentInk, mist],
    ];
    for (const [name, fg, bg] of pairs) expect(contrast(fg, bg), name).toBeGreaterThanOrEqual(4.5);
  });
});
