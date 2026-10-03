import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { API_PROVIDERS } from './core/api/api-providers';
import { AppConfigService } from './core/config/app-config.service';
import { authInterceptor } from './core/http/auth.interceptor';
import { AuthService } from './core/http/auth.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Konfiguracja (public/config/app-config.yaml) i, w trybie http, konto gościa muszą być gotowe przed startem aplikacji.
    // inject() działa tylko synchronicznie, więc obie zależności pobieramy przed pierwszym await.
    provideAppInitializer(async () => {
      const config = inject(AppConfigService);
      const auth = inject(AuthService);
      await config.load();
      await auth.ensureSession();
    }),
    ...API_PROVIDERS,
  ],
};
