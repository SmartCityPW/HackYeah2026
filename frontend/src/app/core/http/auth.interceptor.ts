import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AppConfigService } from '../config/app-config.service';
import { AuthService } from './auth.service';

/** Dokleja token do wywołań naszego API i raz próbuje odświeżyć go po 401. Wywołania /auth/* nie są modyfikowane. */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(AppConfigService).config.api.baseUrl;
  const auth = inject(AuthService);
  const isOurApi = request.url.startsWith(baseUrl);
  const isAuthCall = request.url.startsWith(`${baseUrl}/auth/`);
  if (!isOurApi || isAuthCall) return next(request);

  const withToken = (req: HttpRequest<unknown>) => {
    const token = auth.accessToken;
    return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  };

  return next(withToken(request)).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return from(auth.refresh()).pipe(switchMap((ok) => (ok ? next(withToken(request)) : throwError(() => error))));
      }
      return throwError(() => error);
    }),
  );
};
