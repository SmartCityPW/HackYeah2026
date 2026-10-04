import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from '../../../core/api/api-providers';
import { provideTestConfig } from '../../../core/config/testing';
import { GameEvent } from '../../../core/event.model';
import { EventService } from '../../../core/event.service';
import { EventCard } from './event-card';

/** 12:00 w Warszawie: wydarzenie 1 (godziny dzienne 08:00-22:00) jest wtedy aktywne. */
const NOON = new Date('2026-10-10T10:00:00Z');

describe('EventCard (zapowiedź wydarzenia i odbiór rzadkiego pokemona)', () => {
  afterEach(() => vi.useRealTimers());

  async function render(id: number, inputs: Partial<{ distance: number | null; canCollect: boolean; busy: boolean }> = {}) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOON);
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    const service = TestBed.inject(EventService);
    await service.loadArea({ west: 19, south: 50, east: 20, north: 51 });
    const event: GameEvent = service.events().find((e) => e.id === id)!;
    const fixture = TestBed.createComponent(EventCard);
    fixture.componentRef.setInput('event', event);
    fixture.componentRef.setInput('radius', 50);
    fixture.componentRef.setInput('distance', inputs.distance === undefined ? 10 : inputs.distance);
    if (inputs.canCollect !== undefined) fixture.componentRef.setInput('canCollect', inputs.canCollect);
    if (inputs.busy !== undefined) fixture.componentRef.setInput('busy', inputs.busy);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, button: () => el.querySelector<HTMLButtonElement>('.collect'), text: () => el.textContent!.replace(/\s+/g, ' ') };
  }

  it('announces what the event is, who organizes it and which rare pokemon is the reward', async () => {
    const { el, text } = await render(1);
    expect(el.querySelector('h2')?.textContent).toBe('Piknik rowerowy przy Arenie');
    expect(text()).toContain('Wydarzenie · Fundacja Zielone Miasto');
    expect(text()).toContain('Złoty Rower');
    expect(el.querySelector('.reward-box app-spryciak-model')).not.toBeNull();
    expect(el.querySelector('.chip.rare')?.textContent).toContain('Rzadki');
    expect(text()).toContain('codziennie 08:00–22:00');
    expect(text()).toContain('Plac przed TAURON Areną Kraków');
  });

  it('lets you collect only when the event runs now and you stand in the circle', async () => {
    const { button, fixture } = await render(1);
    expect(button()?.disabled).toBe(false);
    let collected = 0;
    fixture.componentInstance.collect.subscribe(() => collected++);
    button()!.click();
    expect(collected).toBe(1);
  });

  it('keeps the button disabled and says how far you are when outside the circle', async () => {
    const { button, text } = await render(1, { distance: 180 });
    expect(button()?.disabled).toBe(true);
    expect(text()).toContain('Jesteś 180 m od miejsca. Podejdź na mniej niż 50 m.');
  });

  it('asks for the location when it is unknown', async () => {
    const { button, text } = await render(1, { distance: null });
    expect(button()?.disabled).toBe(true);
    expect(text()).toContain('Włącz lokalizację');
  });

  it('shows the description before the start but offers no reward until it begins', async () => {
    const { el, button, text } = await render(2); // zapowiedziane za 2 dni
    expect(el.querySelector('.description')?.textContent).toContain('lampionami');
    expect(text()).toContain('Jeszcze się nie zaczęło. Nagrodę odbierzesz od');
    expect(button()?.disabled).toBe(true);
    expect(text()).toContain('Lampion Festiwalowy');
  });

  it('shows the age and the number of participants with the capacity', async () => {
    const { text } = await render(2);
    expect(text()).toContain('0 z 100 miejsc');
    expect(text()).toContain('od 8 lat');
  });

  it('only previews for organizers and admins (no collect button)', async () => {
    const { button, text } = await render(1, { canCollect: false });
    expect(button()).toBeNull();
    expect(text()).toContain('Złoty Rower');
  });

  it('says that the reward is already collected', async () => {
    const { fixture, el, button } = await render(1);
    fixture.componentRef.setInput('event', { ...fixture.componentInstance.event(), checkedIn: true });
    fixture.detectChanges();
    expect(button()?.textContent).toContain('Nagroda odebrana');
    expect(button()?.disabled).toBe(true);
    expect(el.querySelector('.state')?.textContent).toContain('Nagroda odebrana');
  });
});
