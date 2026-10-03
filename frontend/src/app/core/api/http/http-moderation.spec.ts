import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from '../../config/testing';
import { API_PROVIDERS } from '../api-providers';
import { ModerationApi } from '../moderation.api';
import { MockModerationApi } from '../moderation.api.mock';
import { HttpModerationApi } from './http-moderation.api';

const BASE = TEST_CONFIG.api.baseUrl;

describe('ModerationApi', () => {
  function setup(mode: 'mock' | 'http') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { pokestops: mode, game: 'mock', account: 'mock', scenarios: 'mock', catalog: 'mock' } } }),
        ...API_PROVIDERS,
      ],
    });
    return { http: TestBed.inject(HttpTestingController), api: TestBed.inject(ModerationApi) };
  }

  it('follows api.mode.pokestops', () => {
    expect(setup('mock').api).toBeInstanceOf(MockModerationApi);
    TestBed.resetTestingModule();
    expect(setup('http').api).toBeInstanceOf(HttpModerationApi);
  });

  it('sends the verdicts, since and page size as query parameters and unwraps the page', async () => {
    const { http, api } = setup('http');
    const result = api.list({ verdicts: ['rejected', 'error'], since: '2026-10-03T12:00:00Z', pageSize: 1 });
    const req = http.expectOne((r) => r.url === `${BASE}/admin/moderation-log`);
    expect(req.request.params.get('verdict')).toBe('rejected,error');
    expect(req.request.params.get('since')).toBe('2026-10-03T12:00:00Z');
    expect(req.request.params.get('pageSize')).toBe('1');
    req.flush({ count: 7, results: [{ id: 3, verdict: 'rejected' }] });
    expect(await result).toEqual({ count: 7, items: [{ id: 3, verdict: 'rejected' }] });
  });

  it('turns an error response into an ApiHttpError', async () => {
    const { http, api } = setup('http');
    const result = api.list({ verdicts: ['rejected'] });
    http.expectOne((r) => r.url === `${BASE}/admin/moderation-log`).flush({ code: 'forbidden', message: 'Rola nie ma uprawnień' }, { status: 403, statusText: 'Forbidden' });
    await expect(result).rejects.toMatchObject({ status: 403, code: 'forbidden' });
  });
});
