export type ModerationVerdict = 'approved' | 'rejected' | 'error';

/** Wpis logu moderacji AI (widzi go tylko administrator). Odrzucone zgłoszenie nie powstaje jako pinezka, więc to jedyny ślad. */
export interface ModerationEntry {
  id: number;
  verdict: ModerationVerdict;
  /** Komunikat błędu (tylko `error`). */
  reason: string | null;
  scenarioCode: string;
  scenarioLabel: string;
  /** Treść oceniona przez agenta. */
  submitted: { title: string; description?: string; details?: Record<string, unknown> };
  /** Nazwa wyświetlana autora. */
  author: string;
  model: string | null;
  latencyMs: number | null;
  /** ISO 8601. */
  createdAt: string;
}

export interface ModerationPage {
  /** Liczba wpisów spełniających filtr (nie tylko na tej stronie). */
  count: number;
  items: ModerationEntry[];
}

export interface ModerationQuery {
  verdicts: ModerationVerdict[];
  /** Tylko wpisy nowsze od tej chwili (ISO 8601): służy do odznaki "nowe odrzucenia". */
  since?: string;
  pageSize?: number;
}

/** Jak administrator ma rozumieć werdykt: ikona i tekst, bo paleta ma tylko pięć barw. */
export const VERDICT_META: Record<ModerationVerdict, { label: string; icon: string; hint: string }> = {
  rejected: { label: 'Odrzucone', icon: '✕', hint: 'Agent AI odrzucił zgłoszenie. Nie trafiło na mapę, autor dostał ogólny komunikat.' },
  error: { label: 'Agent niedostępny', icon: '⚠', hint: 'Agent nie odpowiedział, więc zgłoszenie nie powstało. Autor może spróbować ponownie.' },
  approved: { label: 'Zatwierdzone', icon: '✔', hint: 'Agent AI zatwierdził zgłoszenie (jest na mapie).' },
};
