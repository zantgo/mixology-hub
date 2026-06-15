import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/stores/auth.store';
import { UiStore } from '../../core/stores/ui.store';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

function validatePassword(value: string): string[] {
  const errors: string[] = [];
  if (!value) return errors;

  if (value.length < 8) {
    errors.push('At least 8 characters');
  }
  if (value.length > 128) {
    errors.push('At most 128 characters');
  }
  if (new Set(value).size < 5) {
    errors.push('At least 5 unique characters');
  }

  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value);
  const classCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;
  if (classCount < 3) {
    errors.push('Include at least 3 of: uppercase, lowercase, digit, special character');
  }

  if (/(.)\1{3,}/.test(value)) {
    errors.push('No 4 repeating characters in a row');
  }
  if (
    /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
      value,
    )
  ) {
    errors.push('No sequential characters (e.g., abc, 123)');
  }

  return errors;
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ButtonComponent, IconComponent],
  template: `
    <div class="auth-container">
      <div class="auth-card card">
        <div class="auth-header">
          <app-icon name="user-plus" [size]="48" [color]="'var(--color-primary)'" />
          <h1 class="auth-title">Create Account</h1>
          <p class="auth-subtitle">Start building your virtual bar</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label class="form-label" for="displayName">Display Name (optional)</label>
            <input
              id="displayName"
              type="text"
              class="form-input"
              [(ngModel)]="displayName"
              name="displayName"
              placeholder="How should we call you?"
              [disabled]="authStore.loading()"
            />
          </div>

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
              placeholder="At least 8 characters, mixed types"
              [disabled]="authStore.loading()"
              required
              minlength="8"
            />
            @if (passwordErrors().length > 0) {
              <ul class="password-errors">
                @for (err of passwordErrors(); track err) {
                  <li>{{ err }}</li>
                }
              </ul>
            }
          </div>

          @if (authStore.error()) {
            <p class="form-error">{{ authStore.error() }}</p>
          }

          <app-button
            type="submit"
            [loading]="authStore.loading()"
            [disabled]="!email.trim() || passwordErrors().length > 0 || authStore.loading()"
            style="width: 100%;"
          >
            Create Account
          </app-button>
        </form>

        <p class="auth-footer">
          Already have an account?
          <a routerLink="/auth/login" class="auth-link">Sign in</a>
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

      .password-errors {
        margin: var(--space-1) 0 0 0;
        padding-left: var(--space-4);
        color: var(--color-warning);
        font-size: var(--font-size-caption);
        list-style: disc;

        li {
          margin-bottom: var(--space-1);
        }
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
export class RegisterPage {
  readonly authStore = inject(AuthStore);
  readonly uiStore = inject(UiStore);
  private router = inject(Router);

  displayName = '';
  email = '';
  password = '';

  readonly passwordErrors = computed(() => validatePassword(this.password));

  onSubmit(): void {
    if (!this.email.trim() || !this.password.trim()) return;

    this.authStore
      .register(this.email.trim(), this.password, this.displayName.trim() || undefined)
      .subscribe({
        next: () => {
          this.uiStore.addToast({
            id: crypto.randomUUID(),
            message: 'Account created! Welcome to MixologyHub.',
            type: 'success',
          });
          this.router.navigate(['/discover']);
        },
        error: () => {},
      });
  }
}
