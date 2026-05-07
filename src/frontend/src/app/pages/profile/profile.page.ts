import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/stores/auth.store';
import { UiStore } from '../../core/stores/ui.store';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [RouterLink, ButtonComponent, IconComponent, BadgeComponent],
  template: `
    <div class="container">
      <h1 class="page-title">Profile</h1>

      @if (authStore.user()) {
        <div class="profile-card card">
          <div class="profile-avatar">
            <app-icon name="user" [size]="48" [color]="'var(--color-text-tertiary)'" />
          </div>

          <div class="profile-info">
            <div class="info-row">
              <span class="info-label">Display Name</span>
              <span class="info-value">{{ authStore.user()!.displayName || 'Not set' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email</span>
              <span class="info-value">{{ authStore.user()!.email }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Role</span>
              <span class="info-value">
                <app-badge
                  [type]="authStore.isAdmin() ? 'makeable' : 'ai'"
                  [label]="authStore.isAdmin() ? 'Admin' : 'Bartender'"
                />
              </span>
            </div>
          </div>
        </div>

        <div class="profile-section">
          <h3 class="section-title">Appearance</h3>
          <div class="card theme-controls">
            <div class="theme-row">
              <span class="theme-label">Theme</span>
              <div class="theme-buttons">
                <button
                  class="theme-btn"
                  [class.active]="uiStore.theme() === 'light'"
                  (click)="uiStore.setTheme('light')"
                >
                  <app-icon name="sun" [size]="20" />
                  Light
                </button>
                <button
                  class="theme-btn"
                  [class.active]="uiStore.theme() === 'dark'"
                  (click)="uiStore.setTheme('dark')"
                >
                  <app-icon name="moon" [size]="20" />
                  Dark
                </button>
                <button
                  class="theme-btn"
                  [class.active]="uiStore.theme() === 'system'"
                  (click)="uiStore.setTheme('system')"
                >
                  <app-icon name="monitor" [size]="20" />
                  System
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="profile-actions">
          <app-button variant="outline" (action)="onLogout()" style="width: 100%;">
            <app-icon name="log-out" [size]="20" />
            Sign Out
          </app-button>
        </div>
      } @else {
        <div class="not-authed">
          <app-icon name="user" [size]="64" [color]="'var(--color-text-tertiary)'" />
          <h3 class="not-authed-title">Not signed in</h3>
          <p class="not-authed-description">
            Sign in to access your profile, favorites, and bar inventory.
          </p>
          <a routerLink="/auth/login">
            <app-button>Sign In</app-button>
          </a>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .profile-card {
        padding: var(--space-6);
        display: flex;
        gap: var(--space-6);
        align-items: flex-start;
        margin-bottom: var(--space-6);
      }

      .profile-avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--color-bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .profile-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }

      .info-row {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .info-label {
        font-size: var(--font-size-caption);
        color: var(--color-text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .info-value {
        font-size: var(--font-size-body);
        color: var(--color-text-primary);
      }

      .profile-section {
        margin-bottom: var(--space-6);
      }

      .section-title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-h5);
        margin-bottom: var(--space-3);
      }

      .theme-controls {
        padding: var(--space-4);
      }

      .theme-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-3);
      }

      .theme-label {
        font-size: var(--font-size-body-small);
        color: var(--color-text-secondary);
      }

      .theme-buttons {
        display: flex;
        gap: var(--space-2);
      }

      .theme-btn {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        background: var(--color-bg-primary);
        color: var(--color-text-secondary);
        font-size: var(--font-size-body-small);
        cursor: pointer;
        transition: all var(--transition-fast);

        &.active {
          background: rgba(217, 119, 54, 0.15);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        &:hover:not(.active) {
          background: var(--color-bg-tertiary);
        }
      }

      .profile-actions {
        margin-top: var(--space-4);
      }

      .not-authed {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50dvh;
        text-align: center;
        gap: var(--space-4);
      }

      .not-authed-title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-h3);
      }

      .not-authed-description {
        color: var(--color-text-secondary);
        max-width: 320px;
        margin-bottom: var(--space-4);
      }
    `,
  ],
})
export class ProfilePage {
  readonly authStore = inject(AuthStore);
  readonly uiStore = inject(UiStore);
  private router = inject(Router);

  onLogout(): void {
    this.authStore.logout();
    this.uiStore.addToast({
      id: crypto.randomUUID(),
      message: 'You have been signed out.',
      type: 'info',
    });
    this.router.navigate(['/discover']);
  }
}
