import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountApi } from '../../core/api/account.api';
import { API_PROVIDERS } from '../../core/api/api-providers';
import { provideTestConfig } from '../../core/config/testing';
import { ApiHttpError } from '../../core/http/api-error';
import { SessionService } from '../../core/session.service';
import { AccountPanel } from '../../shared/account/account-panel';
import { OrganizationsPage } from '../admin/organizations.page';
import { LoginPage } from './login.page';
import { RegisterOrgPage } from './register-org.page';
import { RegisterPage } from './register.page';

/** Atrapa `AccountApi` z podglądem wywołań; `session` mówi, czy konto jest z backendu i czy to gość. */
function setup(options: { remote?: boolean; guest?: boolean; api?: Partial<Record<keyof AccountApi, unknown>> } = {}) {
  const { remote = true, guest = false, api = {} } = options;
  const account = {
    me: async () => (remote ? { id: 1, displayName: 'Jan', role: 'resident', isGuest: guest, organization: null } : null),
    login: vi.fn(async () => undefined),
    register: vi.fn(async () => undefined),
    registerOrganization: vi.fn(async () => undefined),
    upgrade: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    ...api,
  };
  TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS, provideRouter([]), { provide: AccountApi, useValue: account }] });
  const session = TestBed.inject(SessionService);
  const restart = vi.spyOn(session, 'restart').mockImplementation(() => undefined);
  return { account, session, restart };
}

async function render<T>(component: new () => T, session: SessionService) {
  await session.init();
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    type: (selector: string, value: string) => {
      const input = el.querySelector(selector) as HTMLInputElement | HTMLSelectElement;
      input.value = value;
      input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
    },
    submit: async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      fixture.detectChanges();
    },
    text: () => el.textContent!.replace(/\s+/g, ' '),
  };
}

describe('LoginPage', () => {
  it('does not call the backend with an empty form and says which fields are missing', async () => {
    const { account, session } = setup();
    const page = await render(LoginPage, session);
    await page.submit();
    expect(account.login).not.toHaveBeenCalled();
    expect(page.text()).toContain('Podaj adres e-mail.');
    expect(page.text()).toContain('Podaj hasło.');
  });

  it('logs in and restarts the app so the user is loaded fresh', async () => {
    const { account, session, restart } = setup();
    const page = await render(LoginPage, session);
    page.type('input[type=email]', '  jan@example.com ');
    page.type('input[type=password]', 'dlugie-haslo');
    await page.submit();
    expect(account.login).toHaveBeenCalledWith({ email: 'jan@example.com', password: 'dlugie-haslo' });
    expect(restart).toHaveBeenCalledWith('/');
  });

  it('shows the server message for a wrong password and lets the user try again', async () => {
    const { account, session, restart } = setup({ api: { login: vi.fn(async () => { throw new ApiHttpError(401, 'invalid_credentials', 'Nieprawidłowy e-mail lub hasło'); }) } });
    const page = await render(LoginPage, session);
    page.type('input[type=email]', 'jan@example.com');
    page.type('input[type=password]', 'zle-haslo-xx');
    await page.submit();
    expect(page.el.querySelector('[role=alert]')!.textContent).toContain('Nieprawidłowy e-mail lub hasło');
    expect(restart).not.toHaveBeenCalled();
    expect((page.el.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(false);
    expect(account.login).toHaveBeenCalledTimes(1);
  });

  it('warns a guest that their progress will not move to the account they log in to', async () => {
    const { session } = setup({ guest: true });
    const page = await render(LoginPage, session);
    expect(page.text()).toContain('postęp tego gościa nie przeniesie się');
  });

  it('explains that accounts need the backend when running on mocks', async () => {
    const { session } = setup({ remote: false });
    expect((await render(LoginPage, session)).text()).toContain('api.mode.account: http');
  });
});

describe('RegisterPage', () => {
  const fill = (page: Awaited<ReturnType<typeof render>>) => {
    page.type('input[type=email]', 'nowy@example.com');
    page.type('input[type=password]', 'dlugie-haslo');
  };

  it('a guest saves progress with an upgrade instead of creating another account', async () => {
    const { account, session, restart } = setup({ guest: true });
    const page = await render(RegisterPage, session);
    expect(page.text()).toContain('Zapisz postęp');
    fill(page);
    await page.submit();
    expect(account.upgrade).toHaveBeenCalledWith({ email: 'nowy@example.com', password: 'dlugie-haslo', displayName: undefined });
    expect(account.register).not.toHaveBeenCalled();
    expect(restart).toHaveBeenCalledWith('/konto');
  });

  it('shows the minimum password length from the configuration and blocks a too short one', async () => {
    const { account, session } = setup({ remote: false });
    const page = await render(RegisterPage, session);
    expect(page.text()).toContain('Co najmniej 8 znaków');
    page.type('input[type=email]', 'nowy@example.com');
    page.type('input[type=password]', '1234567');
    await page.submit();
    expect(account.register).not.toHaveBeenCalled();
    expect(page.text()).toContain('Hasło musi mieć co najmniej 8 znaków.');
  });

  it('puts the server field errors (a taken e-mail) under the right field', async () => {
    const { session } = setup({ remote: false, api: { register: vi.fn(async () => { throw new ApiHttpError(422, 'validation_error', 'Błędne dane', { email: 'Ten adres jest zajęty.' }); }) } });
    const page = await render(RegisterPage, session);
    fill(page);
    await page.submit();
    expect(page.el.querySelector('.invalid .error')!.textContent).toContain('Ten adres jest zajęty.');
  });

  it('does not offer a form to someone who is already signed in', async () => {
    const { session } = setup({ guest: false });
    const page = await render(RegisterPage, session);
    expect(page.el.querySelector('form')).toBeNull();
    expect(page.text()).toContain('Jesteś zalogowany');
  });
});

describe('RegisterOrgPage', () => {
  it('requires the organization name and kind, then sends the registration and goes to the organization profile', async () => {
    const { account, session, restart } = setup({ guest: true });
    const page = await render(RegisterOrgPage, session);
    await page.submit();
    expect(account.registerOrganization).not.toHaveBeenCalled();
    expect(page.text()).toContain('Podaj nazwę organizacji.');
    expect(page.text()).toContain('Wybierz rodzaj podmiotu.');

    page.type('input[maxlength="150"]', ' Fundacja Testowa ');
    page.type('select', 'foundation');
    page.type('input[type=email][autocomplete=username]', 'org@example.com');
    page.type('input[type=password]', 'dlugie-haslo');
    page.type('input[inputmode=numeric]', '0000999999');
    await page.submit();
    expect(account.registerOrganization).toHaveBeenCalledWith({
      email: 'org@example.com', password: 'dlugie-haslo', displayName: undefined,
      organization: { name: 'Fundacja Testowa', kind: 'foundation', krs: '0000999999', contactPerson: undefined, contactEmail: undefined, contactPhone: undefined },
    });
    expect(restart).toHaveBeenCalledWith('/org/organizacja');
  });

  it('says that publishing waits for the administrator', async () => {
    const { session } = setup({ guest: true });
    expect((await render(RegisterOrgPage, session)).text()).toContain('zweryfikuje organizację');
  });
});

describe('AccountPanel', () => {
  it('a guest is offered saving progress, logging in and an organization account', async () => {
    const { session } = setup({ guest: true });
    const page = await render(AccountPanel, session);
    expect(page.text()).toContain('🎮 Gość');
    const links = [...page.el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/rejestracja', '/logowanie', '/rejestracja-organizacji']);
    expect(page.el.textContent).not.toContain('Wyloguj');
  });

  it('a signed-in user can log out, which removes the session and restarts the app', async () => {
    const { account, session, restart } = setup({ guest: false });
    const page = await render(AccountPanel, session);
    (page.el.querySelector('button') as HTMLButtonElement).click();
    await page.fixture.whenStable();
    expect(account.logout).toHaveBeenCalled();
    expect(restart).toHaveBeenCalledWith('/');
  });

  it('on mocks it says why there is no login', async () => {
    const { session } = setup({ remote: false });
    const page = await render(AccountPanel, session);
    expect(page.text()).toContain('Tryb atrap');
    expect(page.el.querySelector('button, a')).toBeNull();
  });
});

describe('OrganizationsPage (administrator)', () => {
  const organization = (id: number, name: string, verificationStatus: 'pending' | 'verified' | 'suspended') => ({
    id, name, kind: 'foundation', krs: null, contactPerson: 'Anna', contactEmail: 'a@b.pl', contactPhone: null, verificationStatus,
  });

  function organizations(initial = [organization(1, 'Zielona', 'verified'), organization(2, 'Rowerowa', 'pending'), organization(3, 'Arkadia', 'suspended')]) {
    const list = [...initial];
    const api = {
      listOrganizations: vi.fn(async () => structuredClone(list)),
      setOrganizationVerification: vi.fn(async (id: number, status: string) => {
        const found = list.find((o) => o.id === id)!;
        found.verificationStatus = status as never;
        return structuredClone(found);
      }),
    };
    TestBed.configureTestingModule({ providers: [provideTestConfig(), ...API_PROVIDERS, { provide: AccountApi, useValue: api }] });
    return api;
  }

  const names = (el: HTMLElement) => [...el.querySelectorAll('.row strong')].map((n) => n.textContent);
  const wait = async (fixture: { whenStable: () => Promise<unknown>; detectChanges: () => void }) => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('shows pending organizations first, with the number waiting for a decision', async () => {
    organizations();
    const fixture = TestBed.createComponent(OrganizationsPage);
    await wait(fixture);
    expect(names(fixture.nativeElement)).toEqual(['Rowerowa', 'Zielona', 'Arkadia']);
    expect(fixture.nativeElement.textContent).toContain('Do decyzji: 1');
  });

  it('verifies a pending organization and updates the row without reloading the list', async () => {
    const api = organizations();
    const fixture = TestBed.createComponent(OrganizationsPage);
    await wait(fixture);
    const verify = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.row')][0].querySelector('button') as HTMLButtonElement;
    expect(verify.textContent).toContain('Zweryfikuj');
    verify.click();
    await wait(fixture);
    expect(api.setOrganizationVerification).toHaveBeenCalledWith(2, 'verified');
    expect(api.listOrganizations).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).not.toContain('Do decyzji');
  });

  it('a suspended organization can be restored, a verified one suspended', async () => {
    organizations();
    const fixture = TestBed.createComponent(OrganizationsPage);
    await wait(fixture);
    const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.row')].map((row) => [...row.querySelectorAll('button')].map((b) => b.textContent!.trim()));
    expect(labels).toEqual([['Zweryfikuj', 'Zawieś'], ['Zawieś'], ['Przywróć']]);
  });

  it('filters by status', async () => {
    organizations();
    const fixture = TestBed.createComponent(OrganizationsPage);
    await wait(fixture);
    const chips = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.chip-row button')] as HTMLButtonElement[];
    chips.find((b) => b.textContent!.includes('Zawieszone'))!.click();
    fixture.detectChanges();
    expect(names(fixture.nativeElement)).toEqual(['Arkadia']);
  });
});
