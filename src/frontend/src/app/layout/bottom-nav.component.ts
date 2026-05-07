import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../shared/components/icon/icon.component';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    <nav class="bottom-nav" role="navigation" aria-label="Bottom navigation">
      @for (item of navItems; track item.route) {
        <a
          [routerLink]="item.route"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: item.route === '/discover' }"
          class="nav-item"
          [attr.aria-label]="item.label"
        >
          <app-icon [name]="item.icon" [size]="24" />
          <span class="nav-label">{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: [
    `
      .bottom-nav {
        display: flex;
        justify-content: space-around;
        align-items: center;
        height: var(--bottom-nav-height);
        padding: 0 var(--space-2);
        padding-bottom: env(safe-area-inset-bottom, 0);
        background: var(--color-bg-secondary);
        border-top: 1px solid var(--color-border);
      }

      .nav-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-1);
        min-width: 44px;
        min-height: 44px;
        padding: var(--space-1);
        color: var(--color-text-tertiary);
        text-decoration: none;
        border-radius: var(--border-radius-md);
        transition: color var(--transition-fast);

        &:hover {
          color: var(--color-text-secondary);
        }

        &.active {
          color: var(--color-primary);
        }
      }

      .nav-label {
        font-size: 0.625rem;
        font-weight: var(--font-weight-medium);
        text-align: center;
      }
    `,
  ],
})
export class BottomNavComponent {
  readonly navItems: NavItem[] = [
    { label: 'Discover', icon: 'compass', route: '/discover' },
    { label: 'My Bar', icon: 'glass-water', route: '/my-bar' },
    { label: 'AI', icon: 'sparkles', route: '/ai-bartender' },
    { label: 'Saved', icon: 'heart', route: '/favorites' },
  ];
}
