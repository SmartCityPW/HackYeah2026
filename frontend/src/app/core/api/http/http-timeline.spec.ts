import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from '../../config/testing';
import { API_PROVIDERS } from '../api-providers';
import { PokestopApi } from '../pokestop.api';
import { HttpPokestopApi } from './http-pokestop.api';

const BASE = TEST_CONFIG.api.baseUrl;

describe('HttpPokestopApi: losy inicjatywy (kształty z docs/openapi.yaml)', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { pokestops: 'http', game: 'mock', account: 'mock', scenarios: 'mock', catalog: 'mock' } } }),
        ...API_PROVIDERS,
      ],
    });
    return { http: TestBed.inject(HttpTestingController), api: TestBed.inject(PokestopApi) };
  }

  const entry = { kind: 'update', id: 12, title: 'Jutro sadzimy', body: '', author: 'Fundacja', createdAt: '2026-10-03T10:00:00Z', updatedAt: null, editable: true };

  it('is the HTTP implementation', () => {
    expect(setup().api).toBeInstanceOf(HttpPokestopApi);
  });

  it('reads the timeline page', async () => {
    const { http, api } = setup();
    const result = api.listTimeline(5);
    const req = http.expectOne(`${BASE}/pokestops/5/timeline?pageSize=200`);
    expect(req.request.method).toBe('GET');
    req.flush({ count: 1, results: [entry] });
    expect(await result).toEqual([entry]);
  });

  it('adds, edits and deletes entries with the contract bodies', async () => {
    const { http, api } = setup();
    const added = api.addUpdate(5, { title: 'Jutro sadzimy', body: '' });
    const post = http.expectOne(`${BASE}/pokestops/5/updates`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ title: 'Jutro sadzimy', body: '' });
    post.flush(entry);
    expect((await added).id).toBe(12);

    const edited = api.editUpdate(5, 12, { title: 'Poprawione' });
    const patch = http.expectOne(`${BASE}/pokestops/5/updates/12`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ title: 'Poprawione' });
    patch.flush({ ...entry, title: 'Poprawione' });
    expect((await edited).title).toBe('Poprawione');

    const deleted = api.deleteUpdate(5, 12);
    const del = http.expectOne(`${BASE}/pokestops/5/updates/12`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await deleted;
  });

  it('manages an initiative with PATCH and maps custom fields', async () => {
    const { http, api } = setup();
    const result = api.manage(5, { status: 'in_progress', note: 'Ruszamy', customFields: [{ label: 'Budżet', value: '1 zł' }] });
    const req = http.expectOne(`${BASE}/pokestops/5`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'in_progress', note: 'Ruszamy', customFields: [{ label: 'Budżet', value: '1 zł' }] });
    req.flush({
      id: 5, type: 'ngo', status: 'in_progress', scenarioCode: 'org-tree', character: 'tree', icon: '🌳', title: 'Lipy', author: 'Fundacja', mine: false,
      organization: 'Fundacja', lat: 50, lng: 19, votesFor: 0, votesAgainst: 0, myVote: null, commentCount: 0,
      customFields: [{ label: 'Budżet', value: '1 zł' }], updateCount: 2,
    });
    expect(await result).toMatchObject({ status: 'in_progress', customFields: [{ label: 'Budżet', value: '1 zł' }], updateCount: 2 });
  });
});
