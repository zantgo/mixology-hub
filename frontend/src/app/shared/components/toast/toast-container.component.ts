import { Component, inject } from '@angular/core';
import { UiStore } from '../../../core/stores/ui.store';
import { ToastComponent } from './toast.component';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [ToastComponent],
  template: `
    @if (uiStore.toasts().length) {
      <div class="toast-container" aria-live="polite" aria-label="Notifications">
        @for (toast of uiStore.toasts(); track toast.id) {
          <app-toast [toast]="toast" />
        }
      </div>
    }
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: calc(var(--bottom-nav-height) + var(--space-2));
      left: 50%;
      transform: translateX(-50%);
      z-index: var(--z-index-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      width: calc(100% - var(--space-8));
      max-width: 400px;
      pointer-events: none;

      > * {
        pointer-events: auto;
      }
    }

    @media (min-width: 768px) {
      .toast-container {
        bottom: var(--space-4);
      }
    }
  `]
})
export class ToastContainerComponent {
  readonly uiStore = inject(UiStore);
}
