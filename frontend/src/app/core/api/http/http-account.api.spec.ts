import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideTestConfig, TEST_CONFIG } from '../../config/testing';
import { ApiHttpError, describeError } from '../../http/api-error';
import { authInterceptor } from '../../http/auth.interceptor';
import { AuthService } from '../../http/auth.service';
import { AccountApi } from '../account.api';
import { API_PROVIDERS } from '../api-providers';
import sample from './testing/backend-sample.json';

const BASE = TEST_CONFIG.api.baseUrl;
const ACCESS = 'test.access';
const REFRESH = 'test.refresh';

function setup() {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideTestConfig({ api: { ...TEST_CONFIG.api, mode: { pokestops: 'mock', game: 'mock', account: 'http', scenarios: 'mock' } } }),
      ...API_PROVIDERS,
    ],
  });
  return { http: TestBed.inject(HttpTestingController), api: TestBed.inject(AccountApi), auth: TestBed.inject(AuthService) };
}

const failure = async (promise: Promise<unknown>) => (await promise.catch((e) => e)) as ApiHttpError;

describe('HttpAccountApi (real backend responses captured from the running API)', () => {
  it('maps the real GET /me of an organization with its full data and status', async () => {
    const { http, api } = setup();
    const result = api.me();
    http.expectOne(`${BASE}/me`).flush(sample.meOrg);
    expect(await result).toEqual({
      id: sample.meOrg.id, displayName: 'Anna', role: 'org', isGuest: false,
      organization: { id: 2, name: 'Fundacja Testowa', kind: 'foundation', krs: '0000999999', contactPerson: 'Anna Test', contactEmail: 'kontakt@testowa.example', contactPhone: '+48 600 000 000', verificationStatus: 'pending' },
    });
  });

  describe('signing in', () => {
    it('login stores the tokens and sends only e-mail and password, without a token of its own', async () => {
      const { http, api, auth } = setup();
      localStorage.setItem(ACCESS, 'stary-gosc');
      const done = api.login({ email: 'a@b.pl', password: 'haslo-testowe-1' });
      const req = http.expectOne(`${BASE}/auth/login`);
      expect(req.request.body).toEqual({ email: 'a@b.pl', password: 'haslo-testowe-1' });
      expect(req.request.headers.has('Authorization')).toBe(false);
      req.flush({ access: 'A', refresh: 'R' });
      await done;
      expect(auth.accessToken).toBe('A');
      expect(localStorage.getItem(REFRESH)).toBe('R');
    });

    it('a wrong password is a readable 401 and leaves the current session untouched', async () => {
      const { http, api, auth } = setup();
      localStorage.setItem(ACCESS, 'sesja-goscia');
      const result = failure(api.login({ email: 'a@b.pl', password: 'zle-haslo-xx' }));
      http.expectOne(`${BASE}/auth/login`).flush(sample.errors.invalidCredentials, { status: 401, statusText: 'Unauthorized' });
      const error = await result;
      expect([error.status, error.code]).toEqual([401, 'invalid_credentials']);
      expect(describeError(error)).toBe(sample.errors.invalidCredentials.message);
      expect(auth.accessToken).toBe('sesja-goscia');
      http.expectNone(`${BASE}/auth/refresh`); // 401 z logowania nie uruchamia odświeżania tokenu
    });
  });

  describe('registering', () => {
    it('register stores the tokens', async () => {
      const { http, api, auth } = setup();
      const done = api.register({ email: 'nowy@b.pl', password: 'haslo-testowe-1', displayName: 'Nowy' });
      const req = http.expectOne(`${BASE}/auth/register`);
      expect(req.request.body).toEqual({ email: 'nowy@b.pl', password: 'haslo-testowe-1', displayName: 'Nowy' });
      req.flush({ access: 'A2', refresh: 'R2' });
      await done;
      expect(auth.accessToken).toBe('A2');
    });

    it('turns a taken e-mail (409) and field errors (422) into errors the form can show', async () => {
      const { http, api } = setup();
      const taken = failure(api.register({ email: 'zajety@b.pl', password: 'haslo-testowe-1' }));
      http.expectOne(`${BASE}/auth/register`).flush(sample.errors.emailTaken, { status: 409, statusText: 'Conflict' });
      expect((await taken).code).toBe('email_taken');

      const invalid = failure(api.register({ email: 'zle', password: '123' }));
      http.expectOne(`${BASE}/auth/register`).flush(sample.errors.validation, { status: 422, statusText: 'Unprocessable' });
      const error = await invalid;
      expect(error.fields).toEqual({ email: 'Podaj poprawny adres e-mail.', password: 'Hasło musi mieć co najmniej 8 znaków' });
    });

    it('registerOrganization sends the organization block and stores the tokens', async () => {
      const { http, api, auth } = setup();
      const registration = {
        email: 'org@b.pl', password: 'haslo-testowe-3', displayName: 'Anna',
        organization: { name: 'Fundacja Testowa', kind: 'foundation' as const, krs: '0000999999', contactEmail: 'kontakt@testowa.example' },
      };
      const done = api.registerOrganization(registration);
      const req = http.expectOne(`${BASE}/auth/register-organization`);
      expect(req.request.body).toEqual(registration);
      req.flush({ access: 'A3', refresh: 'R3' });
      await done;
      expect(auth.accessToken).toBe('A3');
    });
  });

  it('upgrade uses the guest session (it carries the token) and keeps the tokens', async () => {
    const { http, api, auth } = setup();
    localStorage.setItem(ACCESS, 'token-goscia');
    localStorage.setItem(REFRESH, 'refresh-goscia');
    const done = api.upgrade({ email: 'zapisany@b.pl', password: 'haslo-testowe-2', displayName: 'Zapisany' });
    const req = http.expectOne(`${BASE}/auth/upgrade`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-goscia'); // regresja: wszystkie /auth/* były kiedyś pomijane
    req.flush({ id: 10, displayName: 'Zapisany', role: 'resident', isGuest: false, organization: null });
    await done;
    expect(auth.accessToken).toBe('token-goscia');
  });

  it('logout removes both tokens and makes no request', async () => {
    const { http, api, auth } = setup();
    localStorage.setItem(ACCESS, 'a');
    localStorage.setItem(REFRESH, 'r');
    await api.logout();
    expect([auth.accessToken, localStorage.getItem(REFRESH)]).toEqual([null, null]);
    http.expectNone(() => true);
  });

  describe('organizations', () => {
    it('reads the own organization', async () => {
      const { http, api } = setup();
      const result = api.myOrganization();
      http.expectOne(`${BASE}/me/organization`).flush(sample.organization);
      expect((await result)?.verificationStatus).toBe('pending');
    });

    it('lists organizations for the administrator, optionally by status', async () => {
      const { http, api } = setup();
      const all = api.listOrganizations();
      http.expectOne(`${BASE}/admin/organizations`).flush(sample.organizations);
      expect((await all).map((o) => o.name)).toEqual(['Fundacja Zielone Miasto', 'Fundacja Testowa']);

      const pending = api.listOrganizations('pending');
      http.expectOne(`${BASE}/admin/organizations?verificationStatus=pending`).flush([]);
      expect(await pending).toEqual([]);
    });

    it('verifies an organization with a PATCH', async () => {
      const { http, api } = setup();
      const result = api.setOrganizationVerification(2, 'verified');
      const req = http.expectOne(`${BASE}/admin/organizations/2`);
      expect([req.request.method, req.request.body]).toEqual(['PATCH', { verificationStatus: 'verified' }]);
      req.flush(sample.organizationVerified);
      expect((await result).verificationStatus).toBe('verified');
    });

    it('a non-administrator gets a readable 403', async () => {
      const { http, api } = setup();
      const result = failure(api.listOrganizations());
      http.expectOne(`${BASE}/admin/organizations`).flush({ code: 'forbidden', message: 'Brak uprawnień' }, { status: 403, statusText: 'Forbidden' });
      expect((await result).status).toBe(403);
    });
  });
});

describe('MockAccountApi', () => {
  it('has no accounts but keeps organizations in memory so the screens can be shown without a backend', async () => {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    const api = TestBed.inject(AccountApi);
    expect(await api.me()).toBeNull();
    expect((await failure(api.login({ email: 'a@b.pl', password: 'x' }))).code).toBe('unavailable_in_mock');
    expect((await failure(api.registerOrganization({ email: 'a@b.pl', password: 'x', organization: { name: 'n', kind: 'ngo' } }))).code).toBe('unavailable_in_mock');

    const pending = await api.listOrganizations('pending');
    expect(pending.length).toBeGreaterThan(0);
    const updated = await api.setOrganizationVerification(pending[0].id, 'verified');
    expect(updated.verificationStatus).toBe('verified');
    expect((await api.listOrganizations('pending')).length).toBe(pending.length - 1);
  });
});
