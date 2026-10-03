import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, Injector, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { API_PROVIDERS } from './core/api/api-providers';
import { CatalogService } from './core/catalog/catalog.service';
import { AppConfigService } from './core/config/app-config.service';
import { authInterceptor } from './core/http/auth.interceptor';
import { AuthService } from './core/http/auth.service';
import { SessionService } from './core/session.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // Konfiguracja (public/config/app-config.yaml) i, w trybie http, konto gościa oraz rola z GET /me muszą być gotowe przed startem aplikacji.
    // inject() działa tylko synchronicznie, więc zależności pobieramy przed pierwszym await. SessionService czyta konfigurację
    // w konstruktorze, dlatego tworzymy go dopiero po jej wczytaniu (przez Injector, który działa także po await).
    provideAppInitializer(async () => {
      const config = inject(AppConfigService);
      const catalog = inject(CatalogService);
      const auth = inject(AuthService);
      const injector = inject(Injector);
      await config.load();
      await catalog.load();
      await auth.ensureSession();
      await injector.get(SessionService).init();
    }),
    ...API_PROVIDERS,
  ],
};
