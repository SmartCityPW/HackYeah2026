import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from '../config/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const BASE = TEST_CONFIG.api.baseUrl;
const ACCESS = 'test.access';
const REFRESH = 'test.refresh';

function setup(mode: 'mock' | 'http', autoGuest = true, account: 'mock' | 'http' = 'mock') {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { pokestops: mode, game: 'mock', account, scenarios: 'mock', catalog: 'mock' } }, auth: { ...TEST_CONFIG.auth, autoGuest } }),
    ],
  });
  return { http: TestBed.inject(HttpTestingController), auth: TestBed.inject(AuthService), client: TestBed.inject(HttpClient) };
}

describe('AuthService.ensureSession', () => {
  it('does nothing in full mock mode (no backend needed)', async () => {
    const { http, auth } = setup('mock');
    await auth.ensureSession();
    http.expectNone(`${BASE}/auth/guest`);
    expect(auth.accessToken).toBeNull();
  });

  it('creates a guest account and stores the tokens when the backend is used', async () => {
    const { http, auth } = setup('http');
    const done = auth.ensureSession();
    http.expectOne(`${BASE}/auth/guest`).flush({ access: 'A', refresh: 'R' });
    await done;
    expect(auth.accessToken).toBe('A');
    expect(localStorage.getItem(REFRESH)).toBe('R');
  });

  it('also needs a session when only the account (GET /me) comes from the backend', async () => {
    const { http, auth } = setup('mock', true, 'http');
    const done = auth.ensureSession();
    http.expectOne(`${BASE}/auth/guest`).flush({ access: 'A', refresh: 'R' });
    await done;
    expect(auth.accessToken).toBe('A');
  });

  it('keeps an existing session and respects auth.autoGuest = false', async () => {
    const existing = setup('http');
    localStorage.setItem(ACCESS, 'already');
    await existing.auth.ensureSession();
    existing.http.expectNone(`${BASE}/auth/guest`);

    TestBed.resetTestingModule();
    const manual = setup('http', false);
    await manual.auth.ensureSession();
    manual.http.expectNone(`${BASE}/auth/guest`);
  });
});

describe('authInterceptor', () => {
  it('adds the token only to our API, never to other hosts or to /auth calls', () => {
    const { http, client } = setup('http');
    localStorage.setItem(ACCESS, 'tok');
    client.get(`${BASE}/me`).subscribe();
    expect(http.expectOne(`${BASE}/me`).request.headers.get('Authorization')).toBe('Bearer tok');
    client.get('http://tiles.example/style').subscribe();
    expect(http.expectOne('http://tiles.example/style').request.headers.has('Authorization')).toBe(false);
    client.post(`${BASE}/auth/login`, {}).subscribe();
    expect(http.expectOne(`${BASE}/auth/login`).request.headers.has('Authorization')).toBe(false);
  });

  it('refreshes the token once on 401 and retries the request', async () => {
    const { http, client } = setup('http');
    localStorage.setItem(ACCESS, 'old');
    localStorage.setItem(REFRESH, 'refresh-1');
    const result = new Promise((resolve) => client.get(`${BASE}/me`).subscribe(resolve));

    http.expectOne(`${BASE}/me`).flush({ code: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    http.expectOne(`${BASE}/auth/refresh`).flush({ access: 'new', refresh: 'refresh-1' });
    await new Promise((r) => setTimeout(r));
    const retry = http.expectOne(`${BASE}/me`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush({ id: 1 });
    expect(await result).toEqual({ id: 1 });
  });

  it('gives up and clears the session when refreshing fails', async () => {
    const { http, client, auth } = setup('http');
    localStorage.setItem(ACCESS, 'old');
    localStorage.setItem(REFRESH, 'bad');
    const failed = new Promise((resolve) => client.get(`${BASE}/me`).subscribe({ error: resolve }));
    http.expectOne(`${BASE}/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    await Promise.resolve();
    http.expectOne(`${BASE}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(((await failed) as { status: number }).status).toBe(401);
    expect(auth.accessToken).toBeNull();
  });
});
