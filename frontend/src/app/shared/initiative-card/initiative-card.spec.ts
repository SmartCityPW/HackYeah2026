import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from '../../core/api/api-providers';
import { provideTestConfig } from '../../core/config/testing';
import { PokestopService } from '../../core/pokestop.service';
import { InitiativeCard } from './initiative-card';

describe('InitiativeCard (rozwijana: status, pola własne, losy)', () => {
  async function render(id: number, inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    const service = TestBed.inject(PokestopService);
    await service.loadAll();
    const fixture = TestBed.createComponent(InitiativeCard);
    fixture.componentRef.setInput('stop', service.stops().find((s) => s.id === id));
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function open(fixture: { nativeElement: HTMLElement; detectChanges: () => void; whenStable: () => Promise<unknown> }) {
    (fixture.nativeElement.querySelector('.head') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('starts collapsed and expands to show what the status means, custom fields and the timeline', async () => {
    const { fixture, el } = await render(7);
    expect(el.querySelector('.details')).toBeNull();
    expect(el.querySelector('.head')?.getAttribute('aria-expanded')).toBe('false');

    await open(fixture);
    expect(el.querySelector('.head')?.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('.meaning')?.textContent).toContain('Głosowanie trwa');
    expect([...el.querySelectorAll('.fields dt')].map((d) => d.textContent)).toEqual(['Liczba drzew', 'Budżet']);
    const titles = [...el.querySelectorAll('.timeline .title')].map((t) => t.textContent);
    expect(titles).toEqual(['Jutro sadzimy pierwsze drzewko', 'Dziś rada dzielnicy zajęła się sprawą', 'Inicjatywa dodana']);
  });

  it('explains "Załatwione" and shows how the status changed', async () => {
    const { fixture, el } = await render(8);
    await open(fixture);
    expect(el.querySelector('.meaning')?.textContent).toContain('Załatwione');
    expect(el.querySelector('.meaning')?.textContent).toContain('zamknięta');
    const changes = [...el.querySelectorAll('.timeline .change')].map((c) => c.textContent!.replace(/\s+/g, ' ').trim());
    expect(changes).toHaveLength(2);
    expect(changes[0]).toContain('W realizacji');
    expect(changes[0]).toContain('Załatwione');
  });

  it('keeps the old behaviour when not expandable (moderation: header opens the map)', async () => {
    const { fixture, el } = await render(7, { expandable: false });
    let opened = 0;
    fixture.componentInstance.opened.subscribe(() => opened++);
    (el.querySelector('.head') as HTMLButtonElement).click();
    expect(opened).toBe(1);
    expect(el.querySelector('.details')).toBeNull();
  });
});
