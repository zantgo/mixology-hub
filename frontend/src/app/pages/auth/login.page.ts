import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/stores/auth.store';
import { UiStore } from '../../core/stores/ui.store';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonComponent, IconComponent],
  template: `
    <div class="auth-container">
      <div class="auth-card card">
        <div class="auth-header">
          <app-icon name="glass-water" [size]="48" [color]="'var(--color-primary)'" />
          <h1 class="auth-title">Welcome Back</h1>
          <p class="auth-subtitle">Sign in to manage your bar inventory</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input
              id="email"
              type="email"
              class="form-input"
              [(ngModel)]="email"
              name="email"
              placeholder="your@email.com"
              [disabled]="authStore.loading()"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input
              id="password"
              type="password"
              class="form-input"
              [(ngModel)]="password"
              name="password"
              placeholder="Enter your password"
              [disabled]="authStore.loading()"
              required
            />
          </div>

          @if (authStore.error()) {
            <p class="form-error">{{ authStore.error() }}</p>
          }

          <app-button
            type="submit"
            [loading]="authStore.loading()"
            [disabled]="!email.trim() || !password.trim() || authStore.loading()"
            style="width: 100%;"
          >
            Sign In
          </app-button>
        </form>

        <p class="auth-footer">
          Don&apos;t have an account?
          <a routerLink="/auth/register" class="auth-link">Create one</a>
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .auth-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 80dvh;
        padding: var(--space-4);
      }

      .auth-card {
        width: 100%;
        max-width: 420px;
        padding: var(--space-8);
      }

      .auth-header {
        text-align: center;
        margin-bottom: var(--space-8);
      }

      .auth-title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-h2);
        margin-top: var(--space-4);
        margin-bottom: var(--space-2);
      }

      .auth-subtitle {
        color: var(--color-text-secondary);
        font-size: var(--font-size-body-small);
      }

      .auth-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .form-label {
        font-size: var(--font-size-body-small);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
      }

      .form-input {
        width: 100%;
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        background: var(--color-bg-primary);
        color: var(--color-text-primary);
        font-size: var(--font-size-body);
        transition: border-color var(--transition-fast);

        &:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        &:disabled {
          opacity: 0.6;
        }
      }

      .form-error {
        color: var(--color-error);
        font-size: var(--font-size-body-small);
        margin: 0;
      }

      .auth-footer {
        text-align: center;
        margin-top: var(--space-6);
        color: var(--color-text-secondary);
        font-size: var(--font-size-body-small);
      }

      .auth-link {
        color: var(--color-primary);
        text-decoration: none;
        font-weight: var(--font-weight-medium);

        &:hover {
          text-decoration: underline;
        }
      }
    `,
  ],
})
export class LoginPage {
  readonly authStore = inject(AuthStore);
  readonly uiStore = inject(UiStore);
  private router = inject(Router);

  email = '';
  password = '';

  onSubmit(): void {
    if (!this.email.trim() || !this.password.trim()) return;

    this.authStore.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Welcome back!',
          type: 'success',
        });
        this.router.navigate(['/discover']);
      },
      error: () => {},
    });
  }
}
