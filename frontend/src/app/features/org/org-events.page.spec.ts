import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_PROVIDERS } from '../../core/api/api-providers';
import { provideTestConfig } from '../../core/config/testing';
import { OrgEventsPage } from './org-events.page';

describe('OrgEventsPage (lista wydarzeń organizacji)', () => {
  async function render() {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), provideRouter([]), ...API_PROVIDERS] });
    const fixture = TestBed.createComponent(OrgEventsPage);
    for (let i = 0; i < 3; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
    const el = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, el, settle, titles: () => [...el.querySelectorAll('article h2')].map((h) => h.textContent), click: (selector: string, index = 0) => (el.querySelectorAll(selector)[index] as HTMLElement).click() };
  }

  it('lists only the organization\'s own current and upcoming events with reward and participants', async () => {
    const { el, titles } = await render();
    expect(titles()).toEqual(['Festiwal Lampionów', 'Piknik rowerowy przy Arenie']);
    const picnic = el.querySelectorAll('article')[1];
    expect(picnic.textContent).toContain('Złoty Rower');
    expect(picnic.textContent).toContain('★ Rzadki');
    expect(picnic.textContent).toContain('Uczestnicy: 12');
    expect(picnic.querySelector('.phase')?.textContent).toBe('Trwa');
  });

  it('cancels an event only after confirmation and moves it to the cancelled list', async () => {
    const { el, fixture, titles, click, settle } = await render();
    click('article:nth-of-type(2) .danger'); // Piknik
    fixture.detectChanges();
    expect(el.querySelector('.confirm')?.textContent).toContain('Odwołać „Piknik rowerowy przy Arenie”');
    expect(titles()).toHaveLength(2);
    click('.confirm .danger');
    await settle();
    await settle();
    expect(titles()).toEqual(['Festiwal Lampionów']);
    click('.chip-row button', 2);
    fixture.detectChanges();
    expect(titles()).toEqual(['Piknik rowerowy przy Arenie']);
    expect(el.querySelector('.phase')?.textContent).toBe('Odwołane');
  });

  it('does not cancel when the confirmation is declined', async () => {
    const { el, fixture, titles, click } = await render();
    click('article .danger');
    fixture.detectChanges();
    click('.confirm button:not(.danger)');
    fixture.detectChanges();
    expect(el.querySelector('.confirm')).toBeNull();
    expect(titles()).toHaveLength(2);
  });
});
