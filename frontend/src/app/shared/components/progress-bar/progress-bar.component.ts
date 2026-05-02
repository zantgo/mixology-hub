import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  template: `
    <div class="progress-container" [attr.aria-label]="'Progress: ' + percentage + '%'" role="progressbar" [attr.aria-valuenow]="percentage">
      <div class="progress-fill" [style.width.%]="percentage" [class.high]="percentage >= 70" [class.medium]="percentage >= 30 && percentage < 70" [class.low]="percentage < 30"></div>
    </div>
    @if (showLabel) {
      <div class="progress-label">
        <span>{{ current }}/{{ total }} {{ unit }}</span>
        <span>{{ percentage }}%</span>
      </div>
    }
  `,
  styles: [`
    .progress-container {
      height: 8px;
      background: var(--color-bg-tertiary);
      border-radius: var(--border-radius-full);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--color-secondary);
      border-radius: var(--border-radius-full);
      transition: width var(--duration-normal) var(--ease-out);
    }

    .progress-fill.high {
      background: var(--color-success);
    }

    .progress-fill.medium {
      background: var(--color-warning);
    }

    .progress-fill.low {
      background: var(--color-error);
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      margin-top: var(--space-1);
      font-size: var(--font-size-caption);
      color: var(--color-text-tertiary);
    }
  `]
})
export class ProgressBarComponent {
  @Input() percentage: number = 0;
  @Input() current: number = 0;
  @Input() total: number = 0;
  @Input() unit: string = '';
  @Input() showLabel: boolean = true;
}
