import { HttpErrorResponse } from '@angular/common/http';

/** Błąd z backendu w kształcie z kontraktu: { code, message, fields? } (docs/openapi.yaml, schemat Error). */
export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Gracz stoi poza kółkiem interakcji (kod `too_far`): serwer podaje, jak daleko jest i jaki jest promień kółka. */
export class TooFarError extends ApiHttpError {
  constructor(
    readonly distanceM: number,
    readonly radiusM: number,
    message = 'Podejdź bliżej',
  ) {
    super(422, 'too_far', message);
  }
}

/** Tłumaczy odpowiedź HTTP z błędem na `ApiHttpError` (także gdy backend jest nieosiągalny). */
export function toApiError(error: unknown): ApiHttpError {
  if (error instanceof ApiHttpError) return error;
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { code?: string; message?: string; fields?: Record<string, string>; distanceM?: number; radiusM?: number } | null;
    if (body?.code === 'too_far' && typeof body.distanceM === 'number' && typeof body.radiusM === 'number') {
      return new TooFarError(body.distanceM, body.radiusM, body.message);
    }
    if (body && typeof body === 'object' && body.code) {
      return new ApiHttpError(error.status, body.code, body.message ?? error.message, body.fields);
    }
    return new ApiHttpError(error.status, error.status === 0 ? 'network_error' : 'http_error', error.status === 0 ? 'Brak połączenia z serwerem' : error.message);
  }
  return new ApiHttpError(0, 'unknown_error', error instanceof Error ? error.message : String(error));
}

/** Operacja, której frontend jeszcze nie dopasował do kontraktu (patrz docs/frontend-adaptation.md). */
export class NotAdaptedYet extends Error {
  constructor(operation: string, todo: string) {
    super(`Tryb "http": ${operation} nie jest jeszcze dopasowane do kontraktu. ${todo}`);
  }
}

/**
 * Komunikat dla użytkownika. Backend zwraca czytelne polskie komunikaty (too_far, moderation_rejected, already_voted…),
 * więc pokazujemy je wprost; własny tekst mamy tylko dla braku połączenia i błędów spoza kontraktu.
 */
export function describeError(error: unknown): string {
  const e = toApiError(error);
  if (e instanceof TooFarError) return `Za daleko: ${e.distanceM} m. Podejdź na mniej niż ${e.radiusM} m.`;
  if (e.code === 'network_error') return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
  if (e.code === 'unknown_error' || e.code === 'http_error') return 'Coś poszło nie tak. Spróbuj ponownie.';
  return e.message;
}
