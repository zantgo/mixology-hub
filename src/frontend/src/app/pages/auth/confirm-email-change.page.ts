import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthStore } from '../../core/stores/auth.store';
import { UiStore } from '../../core/stores/ui.store';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-confirm-email-change-page',
  standalone: true,
  imports: [RouterLink, ButtonComponent, IconComponent],
  template: `
    <div class="auth-container">
      <div class="auth-card card">
        <div class="auth-header">
          <app-icon
            [name]="success() ? 'check-circle' : 'mail'"
            [size]="48"
            [color]="success() ? 'var(--color-success)' : 'var(--color-primary)'"
          />
          <h1 class="auth-title">Email Change Confirmation</h1>
        </div>

        @if (loading()) {
          <div class="verify-loader">
            <app-icon name="loader" [size]="32" [color]="'var(--color-text-tertiary)'" />
            <p class="verify-message">Confirming your new email address...</p>
          </div>
        }

        @if (!loading() && success()) {
          <div class="verify-success">
            <p class="verify-message">{{ message() }}</p>
            <a routerLink="/auth/login" class="verify-link">
              <app-button>
                <app-icon name="log-in" [size]="18" />
                Sign In Again
              </app-button>
            </a>
          </div>
        }

        @if (!loading() && error()) {
          <div class="verify-error">
            <p class="verify-message error-text">{{ error() }}</p>
            <a routerLink="/auth/login" class="verify-link">
              <app-button variant="outline">
                <app-icon name="log-in" [size]="18" />
                Back to Sign In
              </app-button>
            </a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .auth-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 60vh;
        padding: var(--space-6);
      }

      .auth-card {
        padding: var(--space-8);
        max-width: 420px;
        width: 100%;
        text-align: center;
      }

      .auth-header {
        margin-bottom: var(--space-6);
      }

      .auth-title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-h4);
        margin: var(--space-3) 0 var(--space-1);
      }

      .verify-loader,
      .verify-success,
      .verify-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-4);
      }

      .verify-message {
        font-size: var(--font-size-body);
        color: var(--color-text-secondary);
      }

      .error-text {
        color: var(--color-error);
      }

      .verify-link {
        display: inline-block;
        text-decoration: none;
      }
    `,
  ],
})
export class ConfirmEmailChangePage implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private uiStore = inject(UiStore);

  loading = signal(true);
  success = signal(false);
  message = signal('');
  error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParams['token'];
    if (!token) {
      this.loading.set(false);
      this.error.set('Missing email change token. Please check your verification link.');
      return;
    }

    this.http.post<any>(`${environment.apiUrl}/auth/email-change/confirm`, { token }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.success.set(true);
        this.message.set(res.message || 'Your email has been successfully changed.');
        this.authStore.clearState();
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Email changed successfully. Please sign in again.',
          type: 'success',
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.error?.message ||
            'Failed to confirm email change. The link may be invalid or expired.',
        );
      },
    });
  }
}
