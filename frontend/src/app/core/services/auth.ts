import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/auth`;

  register(body: { email: string; password: string; displayName?: string }): Observable<{ user: UserProfile } & AuthTokens> {
    return this.http.post<{ user: UserProfile } & AuthTokens>(`${this.apiUrl}/register`, body).pipe(
      tap((tokens) => this.storeTokens(tokens)),
    );
  }

  login(body: { email: string; password: string }): Observable<{ user: UserProfile } & AuthTokens> {
    return this.http.post<{ user: UserProfile } & AuthTokens>(`${this.apiUrl}/login`, body).pipe(
      tap((tokens) => this.storeTokens(tokens)),
    );
  }

  refreshToken(refreshToken: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap((tokens) => this.storeTokens(tokens)),
    );
  }

  logout(refreshToken?: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/logout`, { refreshToken }).pipe(
      tap(() => this.clearTokens()),
    );
  }

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/profile`);
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(`${this.apiUrl}/verify-email/${token}`);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem('access_token', tokens.accessToken);
    if (tokens.refreshToken) {
      localStorage.setItem('refresh_token', tokens.refreshToken);
    }
  }

  private clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}
