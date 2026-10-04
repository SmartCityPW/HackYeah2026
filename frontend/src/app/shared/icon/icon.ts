import { Component, computed, input } from '@angular/core';

/** Ikony liniowe 24×24 (kreska w kolorze tekstu). Zamiast emoji w nawigacji i przyciskach. */
const PATHS = {
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  spryciaki: 'M12 12.5c-3 0-5.5 3-5.5 5.2 0 1.8 1.5 2.3 3 2 .9-.2 1.6-.5 2.5-.5s1.6.3 2.5.5c1.5.3 3-.2 3-2 0-2.2-2.5-5.2-5.5-5.2zM3.5 11a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0zM7.5 6.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0zM13.5 6.5a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0zM17.5 11a1.5 2 0 1 0 3 0 1.5 2 0 1 0-3 0z',  // łapka
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  plus: 'M12 5v14M5 12h14',
  locate: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 2v3M12 19v3M2 12h3M19 12h3',
  swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01',
  building: 'M4 21V5l8-2v18M12 7l8 2v12M3 21h18M8 9v.01M8 13v.01M8 17v.01M16 13v.01M16 17v.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 6l6 6-6 6',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  host: { 'aria-hidden': 'true' },
  styles: `:host { display: inline-flex; width: 1.25em; height: 1.25em; flex: none; } svg { width: 100%; height: 100%; }`,
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="d()" /></svg>`,
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly d = computed(() => PATHS[this.name()]);
}
