import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    @if (type === 'card') {
      <div class="skeleton-card skeleton">
        <div class="skeleton-img skeleton"></div>
        <div class="skeleton-body">
          <div class="skeleton-line skeleton" [style.width]="'70%'"></div>
          <div class="skeleton-line skeleton" [style.width]="'40%'"></div>
        </div>
      </div>
    } @else if (type === 'text') {
      <div class="skeleton-line skeleton" [style.width]="width"></div>
    } @else if (type === 'circle') {
      <div class="skeleton-circle skeleton" [style.width]="size" [style.height]="size"></div>
    } @else if (type === 'row') {
      <div class="skeleton-row skeleton">
        <div class="skeleton-circle skeleton" [style.width]="'40px'" [style.height]="'40px'"></div>
        <div class="skeleton-body">
          <div class="skeleton-line skeleton" [style.width]="'60%'"></div>
          <div class="skeleton-line skeleton" [style.width]="'30%'"></div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .skeleton-card {
        border-radius: var(--border-radius-lg);
        overflow: hidden;
      }

      .skeleton-img {
        aspect-ratio: 1;
        width: 100%;
        border-radius: 0;
      }

      .skeleton-body {
        padding: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .skeleton-line {
        height: 1rem;
        border-radius: var(--border-radius-sm);
      }

      .skeleton-circle {
        border-radius: 50%;
        flex-shrink: 0;
      }

      .skeleton-row {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3);
        border-radius: var(--border-radius-md);
      }
    `,
  ],
})
export class SkeletonComponent {
  @Input() type: 'card' | 'text' | 'circle' | 'row' = 'text';
  @Input() width: string = '100%';
  @Input() size: string = '40px';
}
