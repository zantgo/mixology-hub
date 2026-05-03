import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, Observable, Subject } from 'rxjs';
import { AuthStore } from '../stores/auth.store';

let isRefreshing = false;
let refreshSubject: Subject<boolean> | null = null;

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
  const publicPaths = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/password-reset', '/auth/verify-email'];
  const isPublicAuth = publicPaths.some((path) => urlPath.endsWith(path));

  const token = authStore.getAccessToken();
  let cloned = req;

  if (token && !isPublicAuth) {
    cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  if (isPublicAuth) {
    cloned = req.clone({ withCredentials: true });
  }

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
                const retryReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${newToken}` },
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
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
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
