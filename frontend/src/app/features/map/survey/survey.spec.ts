import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_PROVIDERS } from '../../../core/api/api-providers';
import { provideTestConfig } from '../../../core/config/testing';
import { GeolocationService } from '../../../core/geolocation.service';
import { PokestopService } from '../../../core/pokestop.service';
import { Survey } from './survey';

describe('Survey (ankieta zaufanego podmiotu i ekran nagrody)', () => {
  const TREES = 7;

  async function render(position: 'here' | 'far' | null = 'here') {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), provideRouter([]), ...API_PROVIDERS] });
    const service = TestBed.inject(PokestopService);
    await service.loadAll();
    const stop = service.stops().find((s) => s.id === TREES)!;
    const geo = TestBed.inject(GeolocationService);
    if (position === 'here') geo.simulate([stop.lng, stop.lat]);
    if (position === 'far') geo.simulate([stop.lng, stop.lat + 0.01]);
    const fixture = TestBed.createComponent(Survey);
    fixture.componentRef.setInput('stop', stop);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const click = (selector: string, index = 0) => {
      (el.querySelectorAll(selector)[index] as HTMLElement).click();
      fixture.detectChanges();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { el, fixture, click, submit };
  }

  it('does not reveal which Spryciak is the prize before the survey is sent', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('Jakiego, dowiesz się po wysłaniu');
    expect(el.textContent).not.toContain('Drzewko');
    expect(el.querySelector('app-spryciak-model')).toBeNull();
    expect(el.querySelectorAll('.question')).toHaveLength(3);
  });

  it('asks for the required answers and marks the questions instead of sending', async () => {
    const { el, submit } = await render();
    await submit();
    expect(el.querySelector('.form-error')?.textContent).toContain('Uzupełnij');
    expect(el.querySelectorAll('.question.invalid')).toHaveLength(1);
    expect(el.querySelector('.reward')).toBeNull();
  });

  it('shows the new Spryciak on the next screen after a valid survey', async () => {
    const { el, click, submit } = await render();
    click('.choices button', 0); // support: Tak
    click('.options input', 0); // priorities: cień
    await submit();
    const reward = el.querySelector('.reward')!;
    expect(reward.querySelector('h2')?.textContent).toContain('Wpadł Ci nowy Spryciak');
    expect(reward.querySelector('app-spryciak-model')).not.toBeNull();
    expect(reward.querySelector('h3')?.textContent).toMatch(/\S/);
    expect([...reward.querySelectorAll('.chip')].map((c) => c.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/Moc \d+/), expect.stringMatching(/Poziom \d+/)]));
  });

  it('sends nothing without a known position', async () => {
    const { el, click, submit } = await render(null);
    click('.choices button', 0);
    await submit();
    expect(el.querySelector('.form-error')?.textContent).toContain('lokalizację');
    expect(el.querySelector('.reward')).toBeNull();
  });

  it('reports being too far away from the server answer', async () => {
    const { el, click, submit } = await render('far');
    click('.choices button', 0);
    await submit();
    expect(el.querySelector('.form-error')?.textContent).toContain('Za daleko');
    expect(el.querySelector('.reward')).toBeNull();
  });
});
