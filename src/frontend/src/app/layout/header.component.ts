import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiStore } from '../core/stores/ui.store';
import { AuthStore } from '../core/stores/auth.store';
import { IconComponent } from '../shared/components/icon/icon.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="header">
      <div class="header-left">
        <button
          class="menu-btn"
          (click)="uiStore.toggleSidebar()"
          aria-label="Toggle menu"
          [attr.aria-expanded]="uiStore.sidebarOpen()"
        >
          <app-icon name="menu" [size]="24" />
        </button>
        <a routerLink="/discover" class="brand">
          <span class="brand-text">MixologyHub</span>
        </a>
      </div>

      <div class="header-right">
        @if (!uiStore.online()) {
          <span class="offline-badge" role="alert">
            <app-icon name="wifi-off" [size]="16" />
            <span>Offline</span>
          </span>
        }

        @if (authStore.isAuthenticated()) {
          <a routerLink="/profile" class="profile-btn" aria-label="Profile">
            <app-icon name="user" [size]="20" />
          </a>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 56px;
        padding: 0 var(--space-4);
        background: var(--color-bg-secondary);
        border-bottom: 1px solid var(--color-border);
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        color: var(--color-text-secondary);
        border-radius: var(--border-radius-md);
        transition: background-color var(--transition-fast);

        &:hover {
          background: var(--color-bg-tertiary);
        }
      }

      .brand-text {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-h5);
        font-weight: var(--font-weight-bold);
        color: var(--color-primary);
        text-decoration: none;
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .offline-badge {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        background: var(--color-error);
        color: #fff;
        border-radius: var(--border-radius-full);
        font-size: var(--font-size-caption);
        font-weight: var(--font-weight-medium);
      }

      .profile-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        color: var(--color-text-secondary);
        border-radius: var(--border-radius-full);
        transition: background-color var(--transition-fast);

        &:hover {
          background: var(--color-bg-tertiary);
        }
      }
    `,
  ],
})
export class HeaderComponent {
  readonly uiStore = inject(UiStore);
  readonly authStore = inject(AuthStore);
}
