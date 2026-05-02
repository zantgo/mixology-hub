import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { UiStore } from '../../../core/stores/ui.store';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="toast" [class]="toast.type" role="alert" [attr.aria-live]="toast.type === 'error' ? 'assertive' : 'polite'">
      <span class="toast-icon">
        <app-icon [name]="iconName" [size]="20" />
      </span>
      <span class="toast-message">{{ toast.message }}</span>
      @if (toast.action && toast.actionLabel) {
        <button class="toast-action" (click)="onAction()">{{ toast.actionLabel }}</button>
      }
      @if (toast.dismissible !== false) {
        <button class="toast-close" (click)="onDismiss()" aria-label="Dismiss notification">
          <app-icon name="x" [size]="16" />
        </button>
      }
    </div>
  `,
  styles: [`
    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      background: var(--color-bg-secondary);
      border-radius: var(--border-radius-md);
      box-shadow: var(--shadow-toast);
      min-height: 48px;
      animation: slideUpFade var(--duration-normal) var(--ease-out);
      position: relative;
      border-left: 3px solid transparent;
    }

    .toast.success {
      border-left-color: var(--color-success);
    }

    .toast.error {
      border-left-color: var(--color-error);
    }

    .toast.warning {
      border-left-color: var(--color-warning);
    }

    .toast.info {
      border-left-color: var(--color-info);
    }

    .toast-icon {
      flex-shrink: 0;
      display: flex;
    }

    .toast.success .toast-icon { color: var(--color-success); }
    .toast.error .toast-icon { color: var(--color-error); }
    .toast.warning .toast-icon { color: var(--color-warning); }
    .toast.info .toast-icon { color: var(--color-info); }

    .toast-message {
      flex: 1;
      font-size: var(--font-size-body-small);
      color: var(--color-text-primary);
      line-height: var(--line-height-normal);
    }

    .toast-action {
      padding: var(--space-1) var(--space-2);
      font-size: var(--font-size-body-small);
      font-weight: var(--font-weight-semibold);
      color: var(--color-primary);
      background: none;
      border: none;
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      min-height: 32px;

      &:hover {
        background: rgba(217, 119, 54, 0.1);
      }
    }

    .toast-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      color: var(--color-text-tertiary);
      border-radius: var(--border-radius-full);

      &:hover {
        background: var(--color-bg-tertiary);
      }
    }

    @keyframes slideUpFade {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class ToastComponent {
  @Input() toast!: import('../../../core/stores/ui.store').Toast;
  @Output() dismiss = new EventEmitter<string>();
  private uiStore = inject(UiStore);

  get iconName(): string {
    switch (this.toast.type) {
      case 'success': return 'check-circle';
      case 'error': return 'alert-circle';
      case 'warning': return 'alert-triangle';
      case 'info': return 'info';
      default: return 'info';
    }
  }

  onAction(): void {
    this.uiStore.removeToast(this.toast.id);
  }

  onDismiss(): void {
    this.uiStore.removeToast(this.toast.id);
  }
}
