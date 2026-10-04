import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from '../../../core/api/api-providers';
import { provideTestConfig } from '../../../core/config/testing';
import { GameEvent } from '../../../core/event.model';
import { EventService } from '../../../core/event.service';
import { EventForm } from './event-form';

describe('EventForm (organizator definiuje wydarzenie "cool thing")', () => {
  function render(location: { lat: number; lng: number } | null = { lat: 50.07, lng: 19.99 }) {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    const fixture = TestBed.createComponent(EventForm);
    fixture.componentRef.setInput('location', location);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, text: string) => {
      const input = el.querySelector(selector) as HTMLInputElement;
      input.value = text;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const created: GameEvent[] = [];
    fixture.componentInstance.created.subscribe((e) => created.push(e));
    return { fixture, el, type, submit, created, service: TestBed.inject(EventService) };
  }

  it('offers only the rare species reserved for events as the reward', () => {
    const { el } = render();
    const names = [...el.querySelectorAll('.reward strong')].map((s) => s.textContent);
    expect(names).toEqual(['Złoty Rower', 'Błyszczący Kosz', 'Zielony Gigant', 'Lampion Festiwalowy', 'Chmurka-Latawiec', 'Mural-Stwór']);
  });

  it('shows how the chosen reward will spin at the event point', () => {
    const { el, fixture } = render();
    expect(el.querySelector('.preview')).toBeNull();
    (el.querySelectorAll('.reward')[3] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.preview app-spryciak-model')).not.toBeNull();
    expect(el.querySelector('.preview')?.textContent).toContain('Lampion Festiwalowy');
    expect(el.querySelectorAll('.reward')[3].getAttribute('aria-checked')).toBe('true');
  });

  it('asks for a title and a reward before publishing', async () => {
    const { el, submit, created } = render();
    await submit();
    expect(el.querySelector('.invalid')).not.toBeNull();
    expect(el.textContent).toContain('Tytuł ma mieć co najmniej 3 znaki');
    expect(el.textContent).toContain('Wybierz rzadkiego pokemona');
    expect(created).toHaveLength(0);
  });

  it('refuses an end before the start and daily hours in the wrong order', async () => {
    const { el, type, submit, fixture } = render();
    type('input[type="text"]', 'Piknik');
    (el.querySelectorAll('.reward')[0] as HTMLButtonElement).click();
    type('input[type="datetime-local"]:nth-of-type(1)', '2026-10-12T10:00');
    const [start, end] = el.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    start.value = '2026-10-12T10:00';
    start.dispatchEvent(new Event('input'));
    end.value = '2026-10-11T10:00';
    end.dispatchEvent(new Event('input'));
    (el.querySelector('.check input') as HTMLInputElement).click();
    fixture.detectChanges();
    const [from, to] = el.querySelectorAll<HTMLInputElement>('input[type="time"]');
    from.value = '18:00';
    from.dispatchEvent(new Event('input'));
    to.value = '10:00';
    to.dispatchEvent(new Event('input'));
    await submit();
    expect(el.textContent).toContain('Koniec musi być później niż początek');
    expect(el.textContent).toContain('Godzina końca musi być późniejsza niż początku');
  });

  it('publishes the event with the map location, period, daily hours and the chosen rare reward', async () => {
    const { el, type, submit, created, fixture, service } = render({ lat: 50.0701, lng: 19.9902 });
    type('input[type="text"]', 'Rowerowy piknik');
    (el.querySelectorAll('.reward')[0] as HTMLButtonElement).click();
    const [start, end] = el.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    start.value = '2030-05-01T09:00';
    start.dispatchEvent(new Event('input'));
    end.value = '2030-05-03T21:00';
    end.dispatchEvent(new Event('input'));
    (el.querySelector('.check input') as HTMLInputElement).click();
    fixture.detectChanges();
    await submit();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ title: 'Rowerowy piknik', rewardCharacter: 'gold_bike', lat: 50.0701, lng: 19.9902, dailyFrom: '10:00', dailyTo: '18:00', mine: true });
    expect(new Date(created[0].startsAt).getFullYear()).toBe(2030);
    expect(service.events().some((e) => e.id === created[0].id)).toBe(true);
  });

  it('waits for the map when the location is not known yet', async () => {
    const { el, type, submit, created } = render(null);
    type('input[type="text"]', 'Rowerowy piknik');
    (el.querySelectorAll('.reward')[0] as HTMLButtonElement).click();
    await submit();
    expect(el.querySelector('.form-error')?.textContent).toContain('mapa się wczyta');
    expect(created).toHaveLength(0);
  });
});
