import { Credentials, OrganizationKind, OrganizationRegistration, VerificationStatus } from './api/account.api';

/** Błędy pól: klucz = nazwa pola, wartość = komunikat dla użytkownika. */
export type FieldErrors = Record<string, string>;

export const ORGANIZATION_KINDS: { value: OrganizationKind; label: string }[] = [
  { value: 'ngo', label: 'Organizacja pozarządowa' },
  { value: 'foundation', label: 'Fundacja' },
  { value: 'association', label: 'Stowarzyszenie' },
  { value: 'city_office', label: 'Urząd miasta' },
  { value: 'district_council', label: 'Rada dzielnicy' },
  { value: 'municipality', label: 'Gmina' },
  { value: 'other', label: 'Inny podmiot' },
];

export const organizationKindLabel = (kind: OrganizationKind): string => ORGANIZATION_KINDS.find((k) => k.value === kind)?.label ?? kind;

/** Status weryfikacji niesie ikona (a nie sam kolor); `bg` i `fg` to tokeny palety z styles.css. */
export const VERIFICATION_META: Record<VerificationStatus, { label: string; icon: string; bg: string; fg: string }> = {
  pending: { label: 'Czeka na weryfikację', icon: '⏳', bg: 'var(--accent-tint)', fg: 'var(--accent-ink)' },
  verified: { label: 'Zweryfikowana', icon: '✔', bg: 'var(--tint)', fg: 'var(--brand-strong)' },
  suspended: { label: 'Zawieszona', icon: '⛔', bg: 'var(--accent-strong)', fg: 'var(--on-strong)' },
};

// Celowo prosta kontrola kształtu (jest @ i kropka w domenie, bez spacji). Decyduje serwer.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 60;
const ORGANIZATION_NAME_MAX = 150;

export function validateCredentials(values: Credentials, passwordMinLength: number): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.email.trim()) errors['email'] = 'Podaj adres e-mail.';
  else if (!EMAIL.test(values.email.trim())) errors['email'] = 'Podaj poprawny adres e-mail.';
  if (!values.password) errors['password'] = 'Podaj hasło.';
  else if (values.password.length < passwordMinLength) errors['password'] = `Hasło musi mieć co najmniej ${passwordMinLength} znaków.`;
  if ((values.displayName ?? '').length > NAME_MAX) errors['displayName'] = `Nazwa może mieć najwyżej ${NAME_MAX} znaków.`;
  return errors;
}

/** Przy logowaniu nie sprawdzamy długości hasła (konto mogło powstać przy innych zasadach), tylko czy pola są wypełnione. */
export function validateLogin(values: Credentials): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.email.trim()) errors['email'] = 'Podaj adres e-mail.';
  if (!values.password) errors['password'] = 'Podaj hasło.';
  return errors;
}

export function validateOrganization(values: OrganizationRegistration, passwordMinLength: number): FieldErrors {
  const errors = validateCredentials(values, passwordMinLength);
  const org = values.organization;
  if (!org.name.trim()) errors['organization.name'] = 'Podaj nazwę organizacji.';
  else if (org.name.length > ORGANIZATION_NAME_MAX) errors['organization.name'] = `Nazwa może mieć najwyżej ${ORGANIZATION_NAME_MAX} znaków.`;
  if (!org.kind) errors['organization.kind'] = 'Wybierz rodzaj podmiotu.';
  if (org.contactEmail && !EMAIL.test(org.contactEmail.trim())) errors['organization.contactEmail'] = 'Podaj poprawny adres e-mail.';
  return errors;
}

/** Pusty tekst z formularza zamieniamy na brak wartości (backend przyjmuje wtedy null). */
export const optional = (value: string): string | undefined => value.trim() || undefined;
