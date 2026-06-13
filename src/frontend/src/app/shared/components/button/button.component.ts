import { Component, Input, Output, EventEmitter, signal } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'icon';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="variant"
      [class.ripple]="showRipple()"
      [attr.aria-label]="ariaLabel"
      [attr.aria-pressed]="ariaPressed"
      (click)="onClick()"
    >
      @if (loading) {
        <span
          class="spinner"
          aria-hidden="true"
          [style.borderColor]="
            variant === 'outline' || variant === 'ghost' || variant === 'icon'
              ? 'rgba(217, 119, 54, 0.3)'
              : 'rgba(255, 255, 255, 0.3)'
          "
          [style.borderTopColor]="
            variant === 'outline' || variant === 'ghost' || variant === 'icon'
              ? 'var(--color-primary)'
              : '#fff'
          "
        ></span>
      }
      <span [class.hidden]="loading">
        <ng-content />
      </span>
    </button>
  `,
  styles: [
    `
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-6);
        min-height: 48px;
        min-width: 44px;
        border-radius: var(--border-radius-md);
        font-family: var(--font-family-body);
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-medium);
        cursor: pointer;
        transition:
          background-color var(--duration-fast),
          transform var(--duration-fast),
          opacity var(--duration-fast);
        position: relative;

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        &:active:not(:disabled) {
          transform: scale(0.97);
        }

        @media (hover: none) and (pointer: coarse) {
          &:active:not(:disabled) {
            transform: scale(0.95);
            opacity: 0.85;
          }
        }
      }

      .ripple {
        position: relative;
        overflow: hidden;
      }

      .ripple::after {
        content: '';
        position: absolute;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        opacity: 1;
        animation: ripple 0.6s linear;
      }

      @keyframes ripple {
        to {
          transform: scale(4);
          opacity: 0;
        }
      }

      button.primary {
        background: var(--color-primary);
        color: #fff;

        &:hover:not(:disabled) {
          background: var(--color-primary-dark);
        }

        &:active:not(:disabled) {
          background: var(--color-primary-light);
        }
      }

      button.secondary {
        background: var(--color-secondary);
        color: #fff;

        &:hover:not(:disabled) {
          background: var(--color-secondary-dark);
        }
      }

      button.outline {
        background: transparent;
        color: var(--color-primary);
        border: 1px solid var(--color-primary);

        &:hover:not(:disabled) {
          background: rgba(217, 119, 54, 0.1);
        }
      }

      button.ghost {
        background: transparent;
        color: var(--color-text-secondary);

        &:hover:not(:disabled) {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
        }
      }

      button.icon {
        padding: 0;
        width: 44px;
        height: 44px;
        min-width: 44px;
        min-height: 44px;
        background: transparent;
        color: var(--color-text-secondary);
        border-radius: var(--border-radius-full);

        &:hover:not(:disabled) {
          background: var(--color-bg-tertiary);
        }
      }

      .hidden {
        visibility: hidden;
      }

      .spinner {
        position: absolute;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;
  @Input() ariaLabel?: string;
  @Input() ariaPressed?: string;
  @Output() action = new EventEmitter<void>();

  readonly showRipple = signal(false);

  onClick(): void {
    if (!this.disabled && !this.loading) {
      this.action.emit();
      this.showRipple.set(true);
      setTimeout(() => this.showRipple.set(false), 600);
    }
  }
}
