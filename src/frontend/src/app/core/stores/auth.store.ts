import { Injectable, signal, inject, Injector, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, of, fromEvent, merge, throttleTime } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { UiStore } from './ui.store';
import { OrderStore } from './order.store';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  role: 'user' | 'admin';
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private http = inject(HttpClient);
  private router = inject(Router);
  private injector = inject(Injector);
  private orderStore = inject(OrderStore);
  private apiUrl = `${environment.apiUrl}/auth`;

  readonly user = signal<UserProfile | null>(null);
  readonly isAuthenticated = signal<boolean>(false);
  readonly isAdmin = signal<boolean>(false);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private accessToken: string | null = null;
  private csrfToken: string | null = null;
  private refreshInProgress: Promise<boolean> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimeoutWarning: ReturnType<typeof setTimeout> | null = null;
  private idleEventsSubscription: any = null;

  startIdleTimer(): void {
    this.stopIdleTimer();
    this.resetIdleTimer();

    this.idleEventsSubscription = merge(
      fromEvent(document, 'mousedown'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'touchstart'),
      fromEvent(document, 'scroll').pipe(throttleTime(1000)),
    ).subscribe(() => this.resetIdleTimer());
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.idleTimeoutWarning) clearTimeout(this.idleTimeoutWarning);

    if (!this.isAuthenticated()) return;

    this.idleTimeoutWarning = setTimeout(
      () => {
        runInInjectionContext(this.injector, () => {
          const uiStore = this.injector.get(UiStore);
          uiStore.addToast({
            id: crypto.randomUUID(),
            message: 'Session expiring soon due to inactivity.',
            type: 'warning',
            dismissAfter: 10000,
          });
        });
      },
      SESSION_TIMEOUT_MS - 60 * 1000,
    );

    this.idleTimer = setTimeout(() => {
      if (this.orderStore.polling()) {
        runInInjectionContext(this.injector, () => {
          const uiStore = this.injector.get(UiStore);
          uiStore.addToast({
            id: crypto.randomUUID(),
            message: 'Auto-logout deferred: a preparation order is in progress.',
            type: 'warning',
            dismissAfter: 10000,
          });
        });
        this.resetIdleTimer();
        return;
      }
      this.logout();
    }, SESSION_TIMEOUT_MS);
  }

  private stopIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.idleTimeoutWarning) {
      clearTimeout(this.idleTimeoutWarning);
      this.idleTimeoutWarning = null;
    }
    if (this.idleEventsSubscription) {
      this.idleEventsSubscription.unsubscribe();
      this.idleEventsSubscription = null;
    }
  }

  initialize(): Observable<boolean> {
    return new Observable<boolean>((subscriber) => {
      this.silentRefresh().subscribe({
        next: (success) => {
          subscriber.next(success);
          subscriber.complete();
        },
        error: () => {
          this.http
            .get<{ success: boolean }>(`${this.apiUrl}/csrf`, { withCredentials: true })
            .subscribe({
              next: () => {
                subscriber.next(false);
                subscriber.complete();
              },
              error: () => {
                subscriber.next(false);
                subscriber.complete();
              },
            });
        },
      });
    });
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getCsrfToken(): string | null {
    return this.csrfToken;
  }

  login(email: string, password: string): Observable<any> {
    this.loading.set(true);
    this.error.set(null);
    return this.http
      .post<{
        user: UserProfile;
        accessToken: string;
        csrfToken?: string;
      }>(`${this.apiUrl}/login`, { email, password }, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.accessToken = res.accessToken;
          if (res.csrfToken) this.csrfToken = res.csrfToken;
          this.user.set(res.user);
          this.isAuthenticated.set(true);
          this.isAdmin.set(res.user.role === 'admin');
          this.loading.set(false);
          this.startIdleTimer();
        }),
        catchError((err) => {
          this.error.set(err.error?.message || 'Login failed');
          this.loading.set(false);
          return throwError(() => err);
        }),
      );
  }

  register(email: string, password: string, displayName?: string): Observable<any> {
    this.loading.set(true);
    this.error.set(null);
    return this.http
      .post<{
        user: UserProfile;
        accessToken: string;
        csrfToken?: string;
      }>(`${this.apiUrl}/register`, { email, password, displayName }, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.accessToken = res.accessToken;
          if (res.csrfToken) this.csrfToken = res.csrfToken;
          this.user.set(res.user);
          this.isAuthenticated.set(true);
          this.isAdmin.set(res.user.role === 'admin');
          this.loading.set(false);
          this.startIdleTimer();
        }),
        catchError((err) => {
          this.error.set(err.error?.message || 'Registration failed');
          this.loading.set(false);
          return throwError(() => err);
        }),
      );
  }

  silentRefresh(): Observable<boolean> {
    if (this.refreshInProgress) {
      return new Observable<boolean>((subscriber) => {
        this.refreshInProgress!.then((result) => {
          subscriber.next(result);
          subscriber.complete();
        });
      });
    }

    this.refreshInProgress = new Promise<boolean>((resolve) => {
      this.http
        .post<{
          accessToken: string;
          csrfToken?: string;
        }>(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
        .subscribe({
          next: (res) => {
            this.accessToken = res.accessToken;
            if (res.csrfToken) this.csrfToken = res.csrfToken;
            this.isAuthenticated.set(true);

            this.loadProfile().subscribe({
              next: () => {
                this.refreshInProgress = null;
                resolve(true);
              },
              error: () => {
                this.refreshInProgress = null;
                resolve(false);
              },
            });
          },
          error: () => {
            this.refreshInProgress = null;
            resolve(false);
          },
        });
    });

    return new Observable<boolean>((subscriber) => {
      this.refreshInProgress!.then((result) => {
        subscriber.next(result);
        subscriber.complete();
      });
    });
  }

  bootstrapCsrfToken(): Observable<boolean> {
    return new Observable<boolean>((subscriber) => {
      this.http
        .get<{
          success: boolean;
          csrfToken?: string;
        }>(`${this.apiUrl}/csrf`, { withCredentials: true })
        .subscribe({
          next: (res) => {
            if (res.csrfToken) this.csrfToken = res.csrfToken;
            subscriber.next(true);
            subscriber.complete();
          },
          error: () => {
            subscriber.next(false);
            subscriber.complete();
          },
        });
    });
  }

  loadProfile(): Observable<UserProfile> {
    this.loading.set(true);
    return this.http.get<UserProfile>(`${this.apiUrl}/profile`).pipe(
      tap((profile) => {
        this.user.set(profile);
        this.isAdmin.set(profile.role === 'admin');
        this.isAuthenticated.set(true);
        this.loading.set(false);
      }),
      catchError((err) => {
        this.loading.set(false);
        return throwError(() => err);
      }),
    );
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe();
    this.stopIdleTimer();
    this.clearState();
  }

  clearState(): void {
    this.stopIdleTimer();
    this.accessToken = null;
    this.csrfToken = null;
    this.user.set(null);
    this.isAuthenticated.set(false);
    this.isAdmin.set(false);
    this.error.set(null);
  }
}
