import { Component, Input } from '@angular/core';

export type BadgeType = 'makeable' | 'almost' | 'unmakeable' | 'ai' | 'custom';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: `
    <span class="badge" [class]="type" [attr.role]="role" [attr.aria-label]="ariaLabel">
      @if (icon) {
        <span class="badge-icon" aria-hidden="true">{{ icon }}</span>
      }
      <span>{{ label }}</span>
    </span>
  `,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--border-radius-full);
        font-size: var(--font-size-caption);
        font-weight: var(--font-weight-semibold);
        line-height: 1;
      }

      .badge.makeable {
        background: rgba(46, 125, 50, 0.2);
        color: var(--color-makeable);
      }

      .badge.almost {
        background: rgba(255, 152, 0, 0.2);
        color: var(--color-almost);
      }

      .badge.unmakeable {
        background: rgba(244, 67, 54, 0.2);
        color: var(--color-unmakeable);
      }

      .badge.ai {
        background: rgba(33, 150, 243, 0.2);
        color: var(--color-info);
      }

      .badge.custom {
        background: rgba(156, 39, 176, 0.2);
        color: #9c27b0;
      }

      .badge-icon {
        font-size: 10px;
      }
    `,
  ],
})
export class BadgeComponent {
  @Input() type: BadgeType = 'makeable';
  @Input() label: string = '';
  @Input() icon?: string;
  @Input() role: string = 'status';

  get ariaLabel(): string {
    return `Status: ${this.label}`;
  }
}
