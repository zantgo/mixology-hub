import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  role: 'user' | 'admin';
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  readonly user = signal<UserProfile | null>(null);
  readonly isAuthenticated = signal<boolean>(false);
  readonly isAdmin = signal<boolean>(false);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  private accessToken: string | null = null;
  private refreshInProgress: Promise<boolean> | null = null;

  initialize(): Observable<boolean> {
    return new Observable<boolean>((subscriber) => {
      this.silentRefresh().subscribe({
        next: (success) => {
          subscriber.next(success);
          subscriber.complete();
        },
        error: () => {
          subscriber.next(false);
          subscriber.complete();
        },
      });
    });
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  login(email: string, password: string): Observable<any> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.post<{ user: UserProfile; accessToken: string }>(
      `${this.apiUrl}/login`, { email, password }, { withCredentials: true }
    ).pipe(
      tap(res => {
        this.accessToken = res.accessToken;
        this.user.set(res.user);
        this.isAuthenticated.set(true);
        this.isAdmin.set(res.user.role === 'admin');
        this.loading.set(false);
      }),
      catchError(err => {
        this.error.set(err.error?.message || 'Login failed');
        this.loading.set(false);
        return throwError(() => err);
      })
    );
  }

  register(email: string, password: string, displayName?: string): Observable<any> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.post<{ user: UserProfile; accessToken: string }>(
      `${this.apiUrl}/register`, { email, password, displayName }, { withCredentials: true }
    ).pipe(
      tap(res => {
        this.accessToken = res.accessToken;
        this.user.set(res.user);
        this.isAuthenticated.set(true);
        this.isAdmin.set(res.user.role === 'admin');
        this.loading.set(false);
      }),
      catchError(err => {
        this.error.set(err.error?.message || 'Registration failed');
        this.loading.set(false);
        return throwError(() => err);
      })
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
      this.http.post<{ accessToken: string }>(
        `${this.apiUrl}/refresh`, {}, { withCredentials: true }
      ).subscribe({
        next: (res) => {
          this.accessToken = res.accessToken;
          this.isAuthenticated.set(true);
          this.refreshInProgress = null;
          resolve(true);
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

  loadProfile(): Observable<UserProfile> {
    this.loading.set(true);
    return this.http.get<UserProfile>(`${this.apiUrl}/profile`).pipe(
      tap(profile => {
        this.user.set(profile);
        this.isAdmin.set(profile.role === 'admin');
        this.isAuthenticated.set(true);
        this.loading.set(false);
      }),
      catchError(err => {
        this.loading.set(false);
        return throwError(() => err);
      })
    );
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }).subscribe();
    this.clearState();
  }

  clearState(): void {
    this.accessToken = null;
    this.user.set(null);
    this.isAuthenticated.set(false);
    this.isAdmin.set(false);
    this.error.set(null);
  }
}
