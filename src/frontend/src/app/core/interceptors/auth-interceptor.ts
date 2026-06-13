import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, Subject } from 'rxjs';
import { AuthStore } from '../stores/auth.store';

let isRefreshing = false;
let refreshSubject: Subject<boolean> | null = null;

function getCookie(name: string): string | null {
  const nameLenPlus = name.length + 1;
  return (
    document.cookie
      .split(';')
      .map((c) => c.trim())
      .filter((cookie) => cookie.substring(0, nameLenPlus) === `${name}=`)
      .map((cookie) => decodeURIComponent(cookie.substring(nameLenPlus)))[0] || null
  );
}

function waitForRefresh(): Observable<boolean> {
  if (!refreshSubject) {
    refreshSubject = new Subject<boolean>();
  }
  return refreshSubject.asObservable();
}

function finalizeRefresh(success: boolean): void {
  isRefreshing = false;
  if (refreshSubject) {
    refreshSubject.next(success);
    refreshSubject.complete();
    refreshSubject = null;
  }
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
  const csrfToken = getCookie('csrf_token');

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
        if (!isRefreshing) {
          isRefreshing = true;
          return authStore.silentRefresh().pipe(
            switchMap((success) => {
              finalizeRefresh(success);
              if (success) {
                const newToken = authStore.getAccessToken();
                const retryHeaders: Record<string, string> = {
                  Authorization: `Bearer ${newToken}`,
                };
                const currentCsrf = getCookie('csrf_token');
                if (currentCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                  retryHeaders['X-CSRF-Token'] = currentCsrf;
                }
                const retryReq = req.clone({
                  setHeaders: retryHeaders,
                  withCredentials: true,
                });
                return next(retryReq);
              }
              authStore.clearState();
              return throwError(() => error);
            }),
            catchError(() => {
              finalizeRefresh(false);
              authStore.clearState();
              return throwError(() => error);
            }),
          );
        }

        return waitForRefresh().pipe(
          switchMap((success) => {
            if (success) {
              const newToken = authStore.getAccessToken();
              const retryHeaders: Record<string, string> = {
                Authorization: `Bearer ${newToken}`,
              };
              const currentCsrf = getCookie('csrf_token');
              if (currentCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                retryHeaders['X-CSRF-Token'] = currentCsrf;
              }
              const retryReq = req.clone({
                setHeaders: retryHeaders,
                withCredentials: true,
              });
              return next(retryReq);
            }
            authStore.clearState();
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
