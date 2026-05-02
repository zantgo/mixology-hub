import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { UiStore } from '../../core/stores/ui.store';
import { AuthStore } from '../../core/stores/auth.store';
import { IconComponent } from '../shared/components/icon/icon.component';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  adminOnly?: boolean;
  authOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <div class="sidebar-content">
      <div class="sidebar-logo">
        <span class="logo-text">MH</span>
      </div>

      <nav class="sidebar-nav" role="navigation" aria-label="Main navigation">
        @for (item of visibleItems; track item.route) {
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            class="nav-item"
            [attr.aria-label]="item.label"
            [title]="item.label"
          >
            <app-icon [name]="item.icon" [size]="24" />
            <span class="nav-label">{{ item.label }}</span>
          </a>
        }
      </nav>

      <div class="sidebar-footer">
        <button
          class="theme-btn"
          (click)="toggleTheme()"
          [attr.aria-label]="'Switch theme. Current: ' + uiStore.theme()"
          title="Theme"
        >
          <app-icon [name]="themeIcon" [size]="20" />
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .sidebar-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: var(--space-4);
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      margin-bottom: var(--space-8);
    }

    .logo-text {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h4);
      font-weight: var(--font-weight-bold);
      color: var(--color-primary);
    }

    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--border-radius-md);
      color: var(--color-text-secondary);
      text-decoration: none;
      transition: background-color var(--transition-fast), color var(--transition-fast);
      min-height: 44px;

      &:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }

      &.active {
        background: rgba(217, 119, 54, 0.15);
        color: var(--color-primary);
      }
    }

    .nav-label {
      font-size: var(--font-size-body-small);
      font-weight: var(--font-weight-medium);
      white-space: nowrap;
      overflow: hidden;
    }

    .sidebar-footer {
      margin-top: auto;
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
    }

    .theme-btn {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      width: 100%;
      border-radius: var(--border-radius-md);
      color: var(--color-text-secondary);
      transition: background-color var(--transition-fast);
      min-height: 44px;

      &:hover {
        background: var(--color-bg-tertiary);
      }
    }

    @media (max-width: 767px) {
      .sidebar-logo {
        display: none;
      }
      .nav-label {
        display: block;
      }
    }

    @media (min-width: 768px) {
      .nav-label {
        display: none;
      }

      :host-context(.open) .nav-label {
        display: block;
      }
    }
  `]
})
export class SidebarComponent {
  readonly uiStore = inject(UiStore);
  readonly authStore = inject(AuthStore);

  readonly navItems: NavItem[] = [
    { label: 'Discover', icon: 'compass', route: '/discover' },
    { label: 'My Bar', icon: 'glass-water', route: '/my-bar' },
    { label: 'AI Bartender', icon: 'sparkles', route: '/ai-bartender' },
    { label: 'Favorites', icon: 'heart', route: '/favorites', authOnly: true },
    { label: 'Create Recipe', icon: 'plus-circle', route: '/create', authOnly: true },
    { label: 'Admin', icon: 'shield', route: '/admin', adminOnly: true }
  ];

  get visibleItems(): NavItem[] {
    const isAdmin = this.authStore.isAdmin();
    const isAuth = this.authStore.isAuthenticated();
    return this.navItems.filter(item => {
      if (item.adminOnly && !isAdmin) return false;
      if (item.authOnly && !isAuth) return false;
      return true;
    });
  }

  get themeIcon(): string {
    const theme = this.uiStore.theme();
    if (theme === 'light') return 'sun';
    if (theme === 'dark') return 'moon';
    return 'monitor';
  }

  toggleTheme(): void {
    const current = this.uiStore.theme();
    const next = current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
    this.uiStore.setTheme(next);
  }
}
