import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../core/stores/auth.store';
import { UiStore } from '../../core/stores/ui.store';
import { OrderStore } from '../../core/stores/order.store';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    ButtonComponent,
    IconComponent,
    BadgeComponent,
    SkeletonComponent,
  ],
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

        <nav class="profile-tabs">
          <button
            class="tab"
            [class.active]="activeTab() === 'appearance'"
            (click)="activeTab.set('appearance')"
          >
            Appearance
          </button>
          <button
            class="tab"
            [class.active]="activeTab() === 'recipes'"
            (click)="onTabChange('recipes')"
          >
            My Recipes
          </button>
          <button
            class="tab"
            [class.active]="activeTab() === 'preparations'"
            (click)="onTabChange('preparations')"
          >
            Preparation History
          </button>
          <button
            class="tab"
            [class.active]="activeTab() === 'account'"
            (click)="activeTab.set('account')"
          >
            Account Settings
          </button>
        </nav>

        @switch (activeTab()) {
          @case ('appearance') {
            <div class="profile-section">
              <h3 class="section-title">Appearance Preferences</h3>
              <div class="card theme-controls">
                <div class="theme-row">
                  <span class="theme-label">Theme</span>
                  <div class="theme-buttons">
                    <button
                      class="theme-btn"
                      [class.active]="uiStore.theme() === 'light'"
                      (click)="onThemeChange('light')"
                    >
                      <app-icon name="sun" [size]="20" />
                      Light
                    </button>
                    <button
                      class="theme-btn"
                      [class.active]="uiStore.theme() === 'dark'"
                      (click)="onThemeChange('dark')"
                    >
                      <app-icon name="moon" [size]="20" />
                      Dark
                    </button>
                    <button
                      class="theme-btn"
                      [class.active]="uiStore.theme() === 'system'"
                      (click)="onThemeChange('system')"
                    >
                      <app-icon name="monitor" [size]="20" />
                      System
                    </button>
                  </div>
                </div>
                <div class="theme-row" style="margin-top: var(--space-4);">
                  <span class="theme-label">Unit System</span>
                  <div class="theme-buttons">
                    <button
                      class="theme-btn"
                      [class.active]="uiStore.unitSystem() === 'metric'"
                      (click)="onUnitChange('metric')"
                    >
                      Metric (ml)
                    </button>
                    <button
                      class="theme-btn"
                      [class.active]="uiStore.unitSystem() === 'imperial'"
                      (click)="onUnitChange('imperial')"
                    >
                      Imperial (oz)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          }
          @case ('recipes') {
            <div class="profile-section">
              <h3 class="section-title">My Created Recipes</h3>
              @if (loadingData()) {
                <app-skeleton type="row" />
              } @else if (authoredCocktails().length === 0) {
                <p class="empty-text">You haven't created any custom cocktail recipes yet.</p>
              } @else {
                <div class="list-container">
                  @for (cocktail of authoredCocktails(); track cocktail.id) {
                    <div class="list-item card">
                      <a [routerLink]="['/discover', cocktail.id]" class="item-link">
                        <span class="item-title">{{ cocktail.name }}</span>
                        <span class="item-date">{{ cocktail.createdAt | date: 'shortDate' }}</span>
                      </a>
                    </div>
                  }
                </div>
              }
            </div>
          }
          @case ('preparations') {
            <div class="profile-section">
              <h3 class="section-title">Recent Preparations</h3>
              @if (loadingData()) {
                <app-skeleton type="row" />
              } @else if (preparations().length === 0) {
                <p class="empty-text">No drinks prepared recently.</p>
              } @else {
                <div class="list-container">
                  @for (log of preparations(); track log.id) {
                    <div class="list-item card prep-item">
                      <div class="prep-info">
                        <span class="item-title">{{ log.cocktailName }}</span>
                        <span class="prep-details">
                          {{ log.servings }} serving(s) &bull; {{ log.createdAt | date: 'short' }}
                        </span>
                      </div>
                      @if (log.canUndo) {
                        <app-button
                          variant="outline"
                          (action)="onUndo(log.id)"
                          [loading]="orderStore.undoing()"
                        >
                          Undo
                        </app-button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
          @case ('account') {
            <div class="profile-section">
              <h3 class="section-title">Account Security</h3>
              <div class="card theme-controls" style="padding: var(--space-5);">
                <form (ngSubmit)="onEmailChangeSubmit()" class="email-change-form">
                  <div class="form-group" style="margin-bottom: var(--space-4);">
                    <label class="form-label" for="new-email">Request New Email Address</label>
                    <input
                      id="new-email"
                      type="email"
                      class="form-input"
                      [(ngModel)]="newEmail"
                      name="newEmail"
                      placeholder="new-email@example.com"
                      required
                      [disabled]="emailChangeSubmitting()"
                    />
                  </div>
                  <app-button
                    type="submit"
                    [disabled]="!newEmail.trim() || emailChangeSubmitting()"
                    [loading]="emailChangeSubmitting()"
                  >
                    <app-icon name="mail" [size]="18" />
                    Request Email Change
                  </app-button>
                </form>
              </div>
            </div>
          }
        }

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

      .profile-tabs {
        display: flex;
        gap: var(--space-2);
        border-bottom: 1px solid var(--color-border);
        margin-bottom: var(--space-6);
        overflow-x: auto;
      }

      .tab {
        background: none;
        border: none;
        padding: var(--space-3) var(--space-4);
        font-size: var(--font-size-body-small);
        color: var(--color-text-secondary);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        white-space: nowrap;
        transition: all var(--transition-fast);

        &.active,
        &:hover {
          color: var(--color-primary);
        }
        &.active {
          border-bottom-color: var(--color-primary);
          font-weight: var(--font-weight-medium);
        }
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

      .list-container {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .list-item {
        padding: var(--space-4);
      }

      .item-link {
        display: flex;
        justify-content: space-between;
        align-items: center;
        text-decoration: none;
        color: inherit;
      }

      .item-title {
        font-weight: var(--font-weight-medium);
      }

      .item-date {
        font-size: var(--font-size-caption);
        color: var(--color-text-tertiary);
      }

      .prep-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .prep-info {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .prep-details {
        font-size: var(--font-size-caption);
        color: var(--color-text-tertiary);
      }

      .empty-text {
        color: var(--color-text-tertiary);
        font-style: italic;
        font-size: var(--font-size-body-small);
      }

      .profile-actions {
        margin-top: var(--space-8);
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
export class ProfilePage implements OnInit {
  readonly authStore = inject(AuthStore);
  readonly uiStore = inject(UiStore);
  readonly orderStore = inject(OrderStore);
  private router = inject(Router);
  private http = inject(HttpClient);

  activeTab = signal<'appearance' | 'recipes' | 'preparations' | 'account'>('appearance');
  authoredCocktails = signal<any[]>([]);
  preparations = signal<any[]>([]);
  loadingData = signal(false);

  newEmail = '';
  emailChangeSubmitting = signal(false);

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      this.loadPreferences();
    }
  }

  onTabChange(tab: 'recipes' | 'preparations'): void {
    this.activeTab.set(tab);
    if (tab === 'recipes') {
      this.loadAuthoredRecipes();
    } else if (tab === 'preparations') {
      this.loadRecentPreparations();
    }
  }

  loadPreferences(): void {
    this.http.get<any>(`${environment.apiUrl}/users/me/preferences`).subscribe({
      next: (prefs) => {
        this.uiStore.setUnitSystem(prefs.unitSystem || 'metric');
      },
    });
  }

  loadAuthoredRecipes(): void {
    this.loadingData.set(true);
    this.http.get<any>(`${environment.apiUrl}/users/me/cocktails`).subscribe({
      next: (res) => {
        this.authoredCocktails.set(res.data || []);
        this.loadingData.set(false);
      },
      error: () => this.loadingData.set(false),
    });
  }

  loadRecentPreparations(): void {
    this.loadingData.set(true);
    this.http.get<any>(`${environment.apiUrl}/users/me/preparations`).subscribe({
      next: (res) => {
        this.preparations.set(res.data || []);
        this.loadingData.set(false);
      },
      error: () => this.loadingData.set(false),
    });
  }

  onThemeChange(theme: 'light' | 'dark' | 'system'): void {
    this.uiStore.setTheme(theme);
    this.savePreferences();
  }

  onUnitChange(unit: 'metric' | 'imperial'): void {
    this.uiStore.setUnitSystem(unit);
    this.savePreferences();
  }

  savePreferences(): void {
    const payload = {
      theme: this.uiStore.theme(),
      unitSystem: this.uiStore.unitSystem(),
    };
    this.http.patch(`${environment.apiUrl}/users/me/preferences`, payload).subscribe({
      next: () => {
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Preferences saved.',
          type: 'success',
          dismissAfter: 2000,
        });
      },
    });
  }

  onUndo(logId: string): void {
    this.orderStore.undo(logId).then(
      () => {
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Preparation undone successfully.',
          type: 'success',
        });
        this.loadRecentPreparations();
      },
      (err: any) => {
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: err.error?.message || 'Failed to undo preparation.',
          type: 'error',
        });
      },
    );
  }

  onEmailChangeSubmit(): void {
    if (!this.newEmail.trim() || this.emailChangeSubmitting()) return;
    this.emailChangeSubmitting.set(true);

    this.http
      .post<any>(`${environment.apiUrl}/auth/email-change/request`, {
        newEmail: this.newEmail.trim(),
      })
      .subscribe({
        next: (res) => {
          this.emailChangeSubmitting.set(false);
          this.newEmail = '';
          this.uiStore.addToast({
            id: crypto.randomUUID(),
            message: res.message || 'Verification link sent to your new email.',
            type: 'success',
          });
        },
        error: (err) => {
          this.emailChangeSubmitting.set(false);
          this.uiStore.addToast({
            id: crypto.randomUUID(),
            message: err.error?.message || 'Failed to request email change.',
            type: 'error',
          });
        },
      });
  }

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
