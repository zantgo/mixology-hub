import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (open) {
      <div class="modal-backdrop" (click)="onBackdropClick($event)" role="dialog" aria-modal="true" [attr.aria-label]="title">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="modal-close" (click)="close.emit()" aria-label="Close dialog">
              <app-icon name="x" [size]="20" />
            </button>
          </div>
          <div class="modal-body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-index-3);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      animation: fadeIn var(--duration-fast) var(--ease-out);
      padding: var(--space-4);
    }

    .modal-content {
      background: var(--color-bg-secondary);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-modal);
      width: 100%;
      max-width: 480px;
      max-height: 85vh;
      overflow-y: auto;
      animation: scaleIn var(--duration-normal) var(--ease-spring);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4) var(--space-6);
      border-bottom: 1px solid var(--color-border);
    }

    .modal-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h5);
      color: var(--color-text-primary);
    }

    .modal-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--border-radius-full);
      color: var(--color-text-secondary);

      &:hover {
        background: var(--color-bg-tertiary);
      }
    }

    .modal-body {
      padding: var(--space-6);
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class ModalComponent {
  @Input() open: boolean = false;
  @Input() title: string = '';
  @Output() close = new EventEmitter<void>();

  onBackdropClick(event: Event): void {
    this.close.emit();
  }
}
