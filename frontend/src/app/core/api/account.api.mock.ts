import { Injectable } from '@angular/core';
import { AccountApi, Me } from './account.api';

/** Atrapa: brak konta z backendu, rolę wybiera przełącznik deweloperski (SessionService). */
@Injectable()
export class MockAccountApi extends AccountApi {
  async me(): Promise<Me | null> {
    return null;
  }
}
