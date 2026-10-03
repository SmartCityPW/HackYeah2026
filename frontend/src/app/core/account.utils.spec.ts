import { optional, organizationKindLabel, validateCredentials, validateLogin, validateOrganization } from './account.utils';

describe('validateCredentials', () => {
  it('accepts a correct e-mail and a long enough password', () => {
    expect(validateCredentials({ email: 'a@b.pl', password: 'dlugie-haslo' }, 8)).toEqual({});
  });

  it('names the problem per field and uses the configured minimum length', () => {
    expect(validateCredentials({ email: '', password: '' }, 8)).toEqual({ email: 'Podaj adres e-mail.', password: 'Podaj hasło.' });
    expect(validateCredentials({ email: 'bez-malpy', password: '1234567' }, 8)).toEqual({
      email: 'Podaj poprawny adres e-mail.',
      password: 'Hasło musi mieć co najmniej 8 znaków.',
    });
    expect(validateCredentials({ email: 'a@b.pl', password: '12345' }, 5)).toEqual({});
  });

  it('limits the display name', () => {
    expect(validateCredentials({ email: 'a@b.pl', password: 'dlugie-haslo', displayName: 'x'.repeat(61) }, 8)['displayName']).toContain('60');
  });
});

describe('validateLogin', () => {
  it('only requires the fields to be filled in (an old account may have a shorter password)', () => {
    expect(validateLogin({ email: 'a@b.pl', password: '1' })).toEqual({});
    expect(Object.keys(validateLogin({ email: ' ', password: '' }))).toEqual(['email', 'password']);
  });
});

describe('validateOrganization', () => {
  const valid = { email: 'a@b.pl', password: 'dlugie-haslo', organization: { name: 'Fundacja', kind: 'foundation' as const } };

  it('accepts the minimal registration', () => {
    expect(validateOrganization(valid, 8)).toEqual({});
  });

  it('requires a name and a kind, and checks the contact e-mail only when given', () => {
    const errors = validateOrganization({ ...valid, organization: { name: ' ', kind: '' as never, contactEmail: 'zle' } }, 8);
    expect(Object.keys(errors).sort()).toEqual(['organization.contactEmail', 'organization.kind', 'organization.name']);
    expect(validateOrganization({ ...valid, organization: { ...valid.organization, contactEmail: undefined } }, 8)).toEqual({});
  });

  it('also reports the account fields', () => {
    expect(validateOrganization({ ...valid, password: 'x' }, 8)['password']).toBeDefined();
  });
});

describe('helpers', () => {
  it('turns blank text into no value, so the backend gets null instead of an empty string', () => {
    expect(optional('  ')).toBeUndefined();
    expect(optional(' 0000123 ')).toBe('0000123');
  });

  it('labels organization kinds in Polish', () => {
    expect(organizationKindLabel('city_office')).toBe('Urząd miasta');
  });
});
