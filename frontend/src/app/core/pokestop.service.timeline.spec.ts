import { TestBed } from '@angular/core/testing';
import { API_PROVIDERS } from './api/api-providers';
import { provideTestConfig } from './config/testing';
import { ApiHttpError } from './http/api-error';
import { PokestopService } from './pokestop.service';

describe('PokestopService: losy inicjatywy (atrapa działa jak backend)', () => {
  let service: PokestopService;
  const NGO = 7; // Fundacja Zielone Miasto: wpisy organizatora i pola własne
  const RESOLVED = 8;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    service = TestBed.inject(PokestopService);
    await service.loadAll();
  });

  const entries = (id: number) => service.timelines()[id];
  const stop = (id: number) => service.stops().find((s) => s.id === id)!;

  it('lists entries newest first, ending with the creation of the initiative', async () => {
    await service.loadTimeline(NGO);
    const kinds = entries(NGO).map((e) => e.kind);
    expect(kinds).toEqual(['update', 'update', 'created']);
    expect(entries(NGO)[0].title).toBe('Jutro sadzimy pierwsze drzewko');
    expect(stop(NGO).updateCount).toBe(2);
  });

  it('shows the status history with notes (what "resolved" meant)', async () => {
    await service.loadTimeline(RESOLVED);
    const changes = entries(RESOLVED).filter((e) => e.kind === 'status');
    expect(changes.map((e) => [e.fromStatus, e.toStatus])).toEqual([['in_progress', 'resolved'], ['open', 'in_progress']]);
    expect(changes[0].body).toContain('uchwałą');
  });

  it('adds, edits and deletes an organizer entry and keeps the counter in sync', async () => {
    await service.addUpdate(NGO, { title: 'Posadzone!', body: 'Pierwsza lipa stoi' });
    expect(entries(NGO)[0]).toMatchObject({ kind: 'update', title: 'Posadzone!', body: 'Pierwsza lipa stoi', author: 'Fundacja Zielone Miasto' });
    expect(stop(NGO).updateCount).toBe(3);

    const id = entries(NGO)[0].id;
    await service.editUpdate(NGO, id, { title: 'Posadzone! (poprawka)' });
    expect(entries(NGO)[0]).toMatchObject({ title: 'Posadzone! (poprawka)', body: 'Pierwsza lipa stoi' });
    expect(entries(NGO)[0].updatedAt).not.toBeNull();

    await service.deleteUpdate(NGO, id);
    expect(entries(NGO).some((e) => e.id === id)).toBe(false);
    expect(stop(NGO).updateCount).toBe(2);
  });

  it('refuses an entry without a title, like the server', async () => {
    const error = await service.addUpdate(NGO, { title: '   ', body: 'x' }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).fields['title']).toBeTruthy();
  });

  it('records a status change with the organizer note on the timeline', async () => {
    await service.manage(NGO, { status: 'in_progress', note: 'Sadzonki dotarły' });
    expect(stop(NGO).status).toBe('in_progress');
    expect(entries(NGO)[0]).toMatchObject({ kind: 'status', fromStatus: 'open', toStatus: 'in_progress', body: 'Sadzonki dotarły', author: 'Fundacja Zielone Miasto' });
  });

  it('saves custom fields and content', async () => {
    await service.manage(NGO, { customFields: [{ label: 'Termin', value: 'jesień' }], title: 'Nowy tytuł' });
    expect(stop(NGO)).toMatchObject({ title: 'Nowy tytuł', customFields: [{ label: 'Termin', value: 'jesień' }] });
  });
});
