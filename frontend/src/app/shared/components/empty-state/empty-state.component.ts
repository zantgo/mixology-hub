import { Component, Input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="empty-state">
      <div class="empty-icon">
        <app-icon [name]="icon" [size]="48" [color]="'var(--color-text-tertiary)'" />
      </div>
      <h3 class="empty-title">{{ title }}</h3>
      <p class="empty-description">{{ description }}</p>
      @if (actionLabel) {
        <button class="empty-action btn-primary" (click)="onAction()">
          {{ actionLabel }}
        </button>
      }
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-16) var(--space-4);
      text-align: center;
      animation: fadeIn var(--duration-normal) var(--ease-out);
    }

    .empty-icon {
      margin-bottom: var(--space-6);
      opacity: 0.5;
      animation: pulse 2s ease-in-out infinite;
    }

    .empty-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h4);
      color: var(--color-text-primary);
      margin-bottom: var(--space-2);
    }

    .empty-description {
      font-size: var(--font-size-body);
      color: var(--color-text-secondary);
      max-width: 320px;
      margin-bottom: var(--space-6);
      line-height: var(--line-height-normal);
    }

    .empty-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-3) var(--space-6);
      min-height: 48px;
      min-width: 44px;
      border: none;
      border-radius: var(--border-radius-md);
      background: var(--color-primary);
      color: #fff;
      font-family: var(--font-family-body);
      font-size: var(--font-size-body);
      font-weight: var(--font-weight-medium);
      cursor: pointer;
      transition: background-color var(--duration-fast);

      &:hover {
        background: var(--color-primary-dark);
      }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon: string = 'glass-water';
  @Input() title: string = 'Nothing here yet';
  @Input() description: string = '';
  @Input() actionLabel?: string;
}
