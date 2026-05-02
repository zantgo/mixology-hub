import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  role: 'user' | 'admin';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isMockAuth: boolean;
  loading: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  readonly user = signal<UserProfile | null>(null);
  readonly isAuthenticated = signal<boolean>(!!localStorage.getItem('access_token'));
  readonly isAdmin = signal<boolean>(false);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  get isMockAuth(): boolean {
    return !localStorage.getItem('access_token');
  }

  login(email: string, password: string): Observable<any> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.post<{ user: UserProfile; accessToken: string; refreshToken: string }>(
      `${this.apiUrl}/login`, { email, password }
    ).pipe(
      tap(res => {
        this.storeTokens(res);
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
    return this.http.post<{ user: UserProfile; accessToken: string; refreshToken: string }>(
      `${this.apiUrl}/register`, { email, password, displayName }
    ).pipe(
      tap(res => {
        this.storeTokens(res);
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
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      this.http.post(`${this.apiUrl}/logout`, { refreshToken }).subscribe();
    }
    this.clearState();
  }

  private storeTokens(res: { accessToken: string; refreshToken: string }): void {
    localStorage.setItem('access_token', res.accessToken);
    localStorage.setItem('refresh_token', res.refreshToken);
  }

  private clearState(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.user.set(null);
    this.isAuthenticated.set(false);
    this.isAdmin.set(false);
    this.error.set(null);
  }
}
