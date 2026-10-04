import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../config/app-config.service';

export interface Tokens {
  access: string;
  refresh: string;
}

/** Tokeny JWT backendu (localStorage) i zakładanie konta gościa przy pierwszym uruchomieniu w trybie `http`. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(AppConfigService);

  // Konfiguracja bywa jeszcze niewczytana, gdy serwis jest tworzony (app initializer), więc czytamy ją dopiero przy użyciu.
  private get config() {
    return this.appConfig.config;
  }

  private get keys() {
    const prefix = this.config.auth.storageKeyPrefix;
    return { access: `${prefix}.access`, refresh: `${prefix}.refresh` };
  }

  get accessToken(): string | null {
    return this.read(this.keys.access);
  }

  /** Czy jakikolwiek obszar korzysta z prawdziwego backendu (wtedy potrzebujemy sesji). */
  get needsSession(): boolean {
    const { pokestops, game, account } = this.config.api.mode;
    return pokestops === 'http' || game === 'http' || account === 'http';
  }

  /** Wywoływane przy starcie aplikacji: bez tokenu zakłada konto gościa (gdy `auth.autoGuest`). */
  async ensureSession(): Promise<void> {
    if (!this.needsSession || this.accessToken || !this.config.auth.autoGuest) return;
    this.store(await firstValueFrom(this.http.post<Tokens>(`${this.config.api.baseUrl}/auth/guest`, {})));
  }

  /**
   * Odświeża token dostępu. Zwraca false, gdy odświeżenie się nie udało (sesja wygasła albo tokeny pochodzą z innego serwera,
   * np. po zmianie klucza lub bazy). Wtedy kończymy sesję: bez tego aplikacja zostawała z martwym tokenem i każde żądanie
   * dostawało 401, aż użytkownik sam przeładował stronę.
   */
  async refresh(): Promise<boolean> {
    const refresh = this.read(this.keys.refresh);
    if (!refresh) {
      this.endSession();
      return false;
    }
    try {
      this.store(await firstValueFrom(this.http.post<Tokens>(`${this.config.api.baseUrl}/auth/refresh`, { refresh })));
      return true;
    } catch {
      this.endSession();
      return false;
    }
  }

  /** Usuwa nieważne tokeny i, gdy włączono `auth.autoGuest`, przeładowuje stronę: start aplikacji założy wtedy nowe konto gościa. */
  private endSession(): void {
    this.clear();
    if (this.needsSession && this.config.auth.autoGuest && this.mayReload()) this.reloadPage();
  }

  /** Najwyżej jedno przeładowanie na 15 s, żeby niedostępny backend nie wprowadził strony w pętlę przeładowań. */
  private mayReload(): boolean {
    const key = `${this.config.auth.storageKeyPrefix}.reloadedAt`;
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last < 15_000) return false;
      sessionStorage.setItem(key, String(Date.now()));
    } catch {
      /* sessionStorage niedostępny: przeładowujemy raz na wywołanie, a start aplikacji i tak nie zapętli się bez tokenu */
    }
    return true;
  }

  protected reloadPage(): void {
    location.reload();
  }

  /** Zapamiętuje tokeny po logowaniu lub rejestracji (sesja zaczyna działać od następnego żądania). */
  signIn(tokens: Tokens): void {
    this.store(tokens);
  }

  /** Wylogowanie: usuwa tokeny. Aplikacja po przeładowaniu założy wtedy nowe konto gościa (`auth.autoGuest`). */
  signOut(): void {
    this.clear();
  }

  clear(): void {
    this.write(this.keys.access, null);
    this.write(this.keys.refresh, null);
  }

  private store(tokens: Tokens): void {
    this.write(this.keys.access, tokens.access);
    this.write(this.keys.refresh, tokens.refresh);
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* localStorage może być niedostępny (tryb prywatny): sesja trwa do końca karty */
    }
  }
}
