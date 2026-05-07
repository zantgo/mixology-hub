import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { UiStore } from '../stores/ui.store';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const uiStore = inject(UiStore);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Session expired. Please log in again.',
          type: 'warning',
        });
      } else if (error.status === 403) {
        uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'You do not have permission to perform this action.',
          type: 'error',
        });
      } else if (error.status === 500 || error.status === 502 || error.status === 503) {
        uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'A server error occurred. Please try again later.',
          type: 'error',
        });
      } else if (error.status === 0) {
        uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Network error. Please check your connection.',
          type: 'error',
        });
      } else if (error.status === 404) {
        // Don't show toast for 404s — handled at the page level
      } else {
        const message = error.error?.message || error.statusText || 'An unexpected error occurred.';
        uiStore.addToast({
          id: crypto.randomUUID(),
          message: Array.isArray(message) ? message.join(', ') : message,
          type: 'error',
        });
      }

      return throwError(() => error);
    }),
  );
};
