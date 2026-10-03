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
    const me: Me = { id: 5, displayName: 'Fundacja Testowa', role: 'org', isGuest: false, organization: 'Fundacja Testowa' };
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
});
