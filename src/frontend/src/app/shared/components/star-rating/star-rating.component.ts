import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  template: `
    <div class="star-rating" [class.interactive]="interactive" [attr.aria-label]="ariaLabel">
      @for (star of stars; track star) {
        <button
          type="button"
          class="star"
          [class.filled]="star <= displayValue"
          [class.half]="
            !interactive && star === Math.ceil(value) && value % 1 >= 0.25 && value % 1 < 0.75
          "
          [disabled]="!interactive || submitting"
          [attr.aria-label]="'Rate ' + star + ' star' + (star > 1 ? 's' : '')"
          (click)="onRate(star)"
          (mouseenter)="interactive && (hoverValue = star)"
          (mouseleave)="interactive && (hoverValue = 0)"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      }
      @if (count !== undefined && count > 0) {
        <span class="count">({{ count }})</span>
      }
      @if (interactive && userRating !== undefined) {
        <span class="your-rating">Your rating: {{ userRating }}</span>
      }
    </div>
  `,
  styles: [
    `
      .star-rating {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      .star {
        background: none;
        border: none;
        cursor: default;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .star svg {
        width: 20px;
        height: 20px;
        fill: var(--color-border);
        stroke: var(--color-border);
        transition:
          fill var(--transition-fast),
          stroke var(--transition-fast);
      }

      .star.filled svg {
        fill: #ffd700;
        stroke: #ffd700;
      }

      .interactive .star {
        cursor: pointer;
      }

      .interactive .star:hover svg {
        fill: #ffd700;
        stroke: #ffd700;
      }

      .star:disabled {
        opacity: 0.7;
      }

      .count {
        font-size: var(--font-size-caption);
        color: var(--color-text-tertiary);
        margin-left: 4px;
      }

      .your-rating {
        font-size: var(--font-size-caption);
        color: var(--color-primary);
        margin-left: 8px;
        font-weight: var(--font-weight-medium);
      }
    `,
  ],
})
export class StarRatingComponent {
  private http = inject(HttpClient);

  @Input() value = 0;
  @Input() count?: number;
  @Input() cocktailId?: string;
  @Input() interactive = false;
  @Input() userRating?: number;

  @Output() rated = new EventEmitter<{ score: number; average: number; count: number }>();

  stars = [1, 2, 3, 4, 5];
  hoverValue = 0;
  submitting = false;
  Math = Math;

  get displayValue(): number {
    return this.hoverValue || this.value;
  }

  get ariaLabel(): string {
    if (this.count !== undefined) {
      return `Rating: ${this.value} out of 5 stars from ${this.count} ratings`;
    }
    return `Rating: ${this.value} out of 5 stars`;
  }

  onRate(score: number): void {
    if (!this.interactive || !this.cocktailId || this.submitting) return;
    this.submitting = true;

    this.http
      .post<{
        averageRating: number;
        userRating: number;
        ratingCount: number;
      }>(`${environment.apiUrl}/cocktails/${this.cocktailId}/rate`, { score })
      .subscribe({
        next: (res) => {
          this.value = res.averageRating;
          this.count = res.ratingCount;
          this.userRating = res.userRating;
          this.submitting = false;
          this.rated.emit({ score, average: res.averageRating, count: res.ratingCount });
        },
        error: () => {
          this.submitting = false;
        },
      });
  }
}
