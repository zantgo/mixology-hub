import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, share, finalize, of } from 'rxjs';
import { AuthStore } from '../stores/auth.store';

let refreshOperation$: Observable<boolean> | null = null;
let csrfRecoveryOperation$: Observable<boolean> | null = null;

function startRefresh(authStore: AuthStore): Observable<boolean> {
  if (!refreshOperation$) {
    refreshOperation$ = authStore.silentRefresh().pipe(
      catchError(() => of(false)),
      share(),
      finalize(() => {
        refreshOperation$ = null;
      }),
    );
  }
  return refreshOperation$;
}

function startCsrfRecovery(authStore: AuthStore): Observable<boolean> {
  if (!csrfRecoveryOperation$) {
    csrfRecoveryOperation$ = authStore.bootstrapCsrfToken().pipe(
      catchError(() => of(false)),
      share(),
      finalize(() => {
        csrfRecoveryOperation$ = null;
      }),
    );
  }
  return csrfRecoveryOperation$;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);

  const urlPath = new URL(req.url, window.location.origin).pathname;
  const publicPaths = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/password-reset',
    '/auth/verify-email',
  ];
  const isPublicAuth = publicPaths.some((path) => urlPath.endsWith(path));

  const token = authStore.getAccessToken();
  const csrfToken = authStore.getCsrfToken();

  const headers: Record<string, string> = {};

  if (token && !isPublicAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const cloned = req.clone({
    setHeaders: headers,
    withCredentials: true,
  });

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isPublicAuth) {
        return startRefresh(authStore).pipe(
          switchMap((success) => {
            if (!success) {
              authStore.clearState();
              return throwError(() => error);
            }
            const newToken = authStore.getAccessToken();
            const retryHeaders: Record<string, string> = {
              Authorization: `Bearer ${newToken}`,
            };
            const currentCsrf = authStore.getCsrfToken();
            if (currentCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
              retryHeaders['X-CSRF-Token'] = currentCsrf;
            }
            return next(
              req.clone({
                setHeaders: retryHeaders,
                withCredentials: true,
              }),
            );
          }),
        );
      }
      return throwError(() => error);
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return startCsrfRecovery(authStore).pipe(
          switchMap((success) => {
            if (!success) {
              return throwError(() => error);
            }
            const newCsrf = authStore.getCsrfToken();
            if (!newCsrf) {
              return throwError(() => error);
            }
            return next(
              req.clone({
                setHeaders: { 'X-CSRF-Token': newCsrf },
                withCredentials: true,
              }),
            );
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
