import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from '../../../core/api/api-providers';
import { provideTestConfig } from '../../../core/config/testing';
import { PokestopService } from '../../../core/pokestop.service';
import { InitiativeManager } from './initiative-manager';

describe('InitiativeManager (panel organizatora)', () => {
  const NGO = 7;

  async function render() {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    const service = TestBed.inject(PokestopService);
    await service.loadAll();
    await service.loadTimeline(NGO);
    const fixture = TestBed.createComponent(InitiativeManager);
    // Komponent czyta aktualną pinezkę z serwisu, tak jak robi to karta po zmianie stanu.
    fixture.componentRef.setInput('stop', service.stops().find((s) => s.id === NGO));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await fixture.whenStable();
      fixture.componentRef.setInput('stop', service.stops().find((s) => s.id === NGO));
      fixture.detectChanges();
    };
    const type = (selector: string, text: string) => {
      const input = el.querySelector(selector) as HTMLInputElement;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { el, service, settle, type, fixture };
  }

  it('adds a timeline entry from the form and lists it first', async () => {
    const { el, service, settle, type } = await render();
    type('form:nth-of-type(1) input', 'Dziś zasadziliśmy pierwsze drzewko');
    (el.querySelector('form:nth-of-type(1) button.primary') as HTMLButtonElement).click();
    await settle();
    expect(service.timelines()[NGO][0].title).toBe('Dziś zasadziliśmy pierwsze drzewko');
    expect(el.querySelector('.timeline .title')?.textContent).toBe('Dziś zasadziliśmy pierwsze drzewko');
    expect((el.querySelector('form input') as HTMLInputElement).value).toBe('');
  });

  it('edits an existing entry in the same form and deletes after confirmation', async () => {
    const { el, service, settle, type, fixture } = await render();
    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('.timeline .actions button')];
    buttons().find((b) => b.textContent === 'Edytuj')!.click();
    fixture.detectChanges();
    expect((el.querySelector('form input') as HTMLInputElement).value).toBe('Jutro sadzimy pierwsze drzewko');
    type('form input', 'Sadzimy dziś');
    (el.querySelector('form button.primary') as HTMLButtonElement).click();
    await settle();
    expect(service.timelines()[NGO][0].title).toBe('Sadzimy dziś');

    buttons().find((b) => b.textContent === 'Usuń')!.click();
    fixture.detectChanges();
    expect(el.querySelector('.confirm')?.textContent).toContain('Sadzimy dziś');
    (el.querySelector('.confirm .danger') as HTMLButtonElement).click();
    await settle();
    expect(service.timelines()[NGO].some((e) => e.title === 'Sadzimy dziś')).toBe(false);
  });

  it('changes the status with a note and offers no way to reject', async () => {
    const { el, service, settle, type } = await render();
    const labels = [...el.querySelectorAll('.status-row button')].map((b) => b.textContent!.trim());
    expect(labels.some((l) => l.includes('Odrzucone'))).toBe(false);
    expect(labels).toHaveLength(3);
    type('.status-row ~ label input', 'Sadzonki dotarły');
    (el.querySelectorAll('.status-row button')[1] as HTMLButtonElement).click();
    await settle();
    expect(service.stops().find((s) => s.id === NGO)!.status).toBe('in_progress');
    expect(service.timelines()[NGO][0]).toMatchObject({ kind: 'status', body: 'Sadzonki dotarły' });
  });

  it('adds and removes custom fields up to the configured limit', async () => {
    const { el, settle, fixture } = await render();
    const fields = [...el.querySelectorAll('section')].find((sec) => sec.querySelector('h4')?.textContent === 'Pola własne')!;
    const add = () => fields.querySelectorAll<HTMLButtonElement>('.buttons button')[0];
    expect(el.querySelectorAll('.pair')).toHaveLength(2);
    for (let i = 0; i < 8; i++) { add().click(); fixture.detectChanges(); }
    expect(el.querySelectorAll('.pair')).toHaveLength(10);
    expect(add().disabled).toBe(true);
    (el.querySelector('.pair .icon-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.pair')).toHaveLength(9);
    await settle();
  });

  it('shows aggregated survey results with option labels', async () => {
    const { el, settle, fixture } = await render();
    const button = [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('Pokaż wyniki'))!;
    button.click();
    await settle();
    fixture.detectChanges();
    expect(el.textContent).toContain('2 wypełnień');
    const labels = [...el.querySelectorAll('.bar-row span')].map((x) => x.textContent);
    expect(labels).toEqual(expect.arrayContaining(['Tak', 'Nie', 'Cień', 'Mniej hałasu', 'Czystsze powietrze']));
    expect(el.querySelector('.avg')?.textContent).toContain('Średnia');
  });
});
