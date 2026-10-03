import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Me, AccountApi } from './api/account.api';
import { API_PROVIDERS } from './api/api-providers';
import { provideTestConfig } from './config/testing';
import { SessionService } from './session.service';

describe('SessionService', () => {
  beforeEach(() => localStorage.clear());

  it('on the mock account the role is chosen by hand and remembered', async () => {
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
    const session = TestBed.inject(SessionService);
    await session.init();

    expect(session.roleSwitchable()).toBe(true);
    session.setRole('org');
    expect(session.profile().organization).toBe('Fundacja Zielone Miasto');
    TestBed.tick();
    expect(localStorage.getItem('test.role')).toBe('org');
  });

  it('with the backend account the role and profile come from GET /me and cannot be switched by hand', async () => {
    const me: Me = { id: 5, displayName: 'Fundacja Testowa', role: 'org', isGuest: false, organization: { id: 1, name: 'Fundacja Testowa', kind: 'foundation', krs: null, contactPerson: null, contactEmail: null, contactPhone: null, verificationStatus: 'verified' } };
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS, { provide: AccountApi, useValue: { me: async () => me } }] });
    const session = TestBed.inject(SessionService);
    await session.init();

    expect(session.role()).toBe('org');
    expect(session.profile()).toEqual({ displayName: 'Fundacja Testowa', organization: 'Fundacja Testowa' });
    expect(session.isGuest()).toBe(false);

    session.setRole('admin');
    expect(session.role()).toBe('org');
    expect(session.roleSwitchable()).toBe(false);
    TestBed.tick();
    expect(localStorage.getItem('test.role')).toBeNull();
  });

  describe('organization', () => {
    const organization = (verificationStatus: 'pending' | 'verified' | 'suspended') => ({
      id: 1, name: 'Fundacja Testowa', kind: 'foundation' as const, krs: null, contactPerson: null, contactEmail: null, contactPhone: null, verificationStatus,
    });
    const setup = (status: 'pending' | 'verified' | 'suspended', myOrganization?: () => Promise<unknown>) => {
      const me: Me = { id: 5, displayName: 'Anna', role: 'org', isGuest: false, organization: organization(status) };
      TestBed.configureTestingModule({
        providers: [provideTestConfig(), ...API_PROVIDERS, { provide: AccountApi, useValue: { me: async () => me, myOrganization: myOrganization ?? (async () => me.organization) } }],
      });
      return TestBed.inject(SessionService);
    };

    it('cannot publish until the administrator verifies the organization', async () => {
      for (const [status, canPublish] of [['pending', false], ['suspended', false], ['verified', true]] as const) {
        TestBed.resetTestingModule();
        const session = setup(status);
        await session.init();
        expect([status, session.canPublishInitiatives()]).toEqual([status, canPublish]);
      }
    });

    it('residents and the mock account can always publish (the backend decides)', async () => {
      TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS] });
      const session = TestBed.inject(SessionService);
      session.setRole('org');
      expect(session.canPublishInitiatives()).toBe(true); // atrapa: brak kont, więc brak weryfikacji
      session.setRole('resident');
      expect(session.canPublishInitiatives()).toBe(true);
    });

    it('refreshOrganization picks up a verification done after the app started', async () => {
      let current = organization('pending');
      const session = setup('pending', async () => current);
      await session.init();
      expect(session.canPublishInitiatives()).toBe(false);

      current = organization('verified');
      await session.refreshOrganization();
      expect(session.canPublishInitiatives()).toBe(true);
    });

    it('refreshOrganization does nothing for other roles', async () => {
      const myOrganization = vi.fn();
      TestBed.configureTestingModule({
        providers: [provideTestConfig(), ...API_PROVIDERS, { provide: AccountApi, useValue: { me: async () => ({ id: 1, displayName: 'A', role: 'resident', isGuest: true, organization: null }), myOrganization } }],
      });
      const session = TestBed.inject(SessionService);
      await session.init();
      await session.refreshOrganization();
      expect(myOrganization).not.toHaveBeenCalled();
    });
  });

  it('restart reloads the app at the given address (after login, registration and logout)', () => {
    const assign = vi.fn();
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS, { provide: DOCUMENT, useValue: { defaultView: { location: { assign } } } }] });
    TestBed.inject(SessionService).restart('/konto');
    expect(assign).toHaveBeenCalledWith('/konto');
  });
});
