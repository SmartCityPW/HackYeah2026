import { SurveyAnswer, SurveyAnswers, SurveyQuestion } from './pokestop.model';

/** Zakres oceny (gwiazdki), gdy pytanie nie ma własnego `min`/`max`: jak w backendzie (`RATING_RANGE`). */
export const DEFAULT_RATING: [number, number] = [1, 5];

export function ratingRange(q: SurveyQuestion): [number, number] {
  return [q.min ?? DEFAULT_RATING[0], q.max ?? DEFAULT_RATING[1]];
}

/** Kolejne wartości oceny, do narysowania przycisków. */
export function ratingScale(q: SurveyQuestion): number[] {
  const [low, high] = ratingRange(q);
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}

const isEmpty = (v: SurveyAnswer | undefined): boolean => v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Sprawdza odpowiedzi tak jak serwer (wymagane, typ, zakres, opcje), żeby błąd pokazać przed wysłaniem.
 * Zwraca {klucz pytania: komunikat}; pusty = poprawne. Ostatnie słowo i tak ma backend.
 */
export function validateAnswers(questions: SurveyQuestion[], answers: SurveyAnswers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const value = answers[q.key];
    if (isEmpty(value)) {
      if (q.required) errors[q.key] = 'To pole jest wymagane';
      continue;
    }
    const values = new Set(q.options.map((o) => o.value));
    switch (q.type) {
      case 'number': {
        const n = Number(value);
        if (typeof value === 'boolean' || Number.isNaN(n)) errors[q.key] = 'Podaj liczbę';
        else if (q.min !== null && n < q.min) errors[q.key] = `Minimum: ${q.min}`;
        else if (q.max !== null && n > q.max) errors[q.key] = `Maksimum: ${q.max}`;
        break;
      }
      case 'rating': {
        const [low, high] = ratingRange(q);
        if (!Number.isInteger(Number(value)) || Number(value) < low || Number(value) > high) errors[q.key] = `Ocena od ${low} do ${high}`;
        break;
      }
      case 'boolean':
        if (typeof value !== 'boolean') errors[q.key] = 'Wybierz tak albo nie';
        break;
      case 'select':
      case 'choice':
        if (typeof value !== 'string' || !values.has(value)) errors[q.key] = 'Wybierz jedną z opcji';
        break;
      case 'multiselect':
        if (!Array.isArray(value) || !value.every((v) => values.has(v))) errors[q.key] = 'Wybierz opcje z listy';
        break;
      default:
        if (typeof value !== 'string') errors[q.key] = 'Wpisz tekst';
    }
  }
  return errors;
}

/** Odpowiedzi bez pustych wartości (pominięte pytania nieobowiązkowe nie jadą na serwer). */
export function compactAnswers(answers: SurveyAnswers): SurveyAnswers {
  return Object.fromEntries(Object.entries(answers).filter(([, v]) => !isEmpty(v)));
}
