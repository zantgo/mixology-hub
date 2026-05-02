import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CocktailImageComponent } from '../cocktail-image/cocktail-image.component';
import { BadgeComponent, BadgeType } from '../badge/badge.component';
import { FavoriteButtonComponent } from '../../../features/shared/favorite-button.component';
import { Cocktail } from '../../../core/stores/cocktail.store';

@Component({
  selector: 'app-cocktail-card',
  standalone: true,
  imports: [RouterLink, CocktailImageComponent, BadgeComponent, FavoriteButtonComponent],
  template: `
    <article
      class="cocktail-card card"
      role="article"
      [attr.aria-labelledby]="titleId"
    >
      <a [routerLink]="['/discover', cocktail.id]" class="card-link">
        <div class="card-image">
          <app-cocktail-image
            [imageFull]="cocktail.imageFull"
            [imageThumb]="cocktail.imageThumb"
            [cocktailName]="cocktail.name"
            [altText]="cocktail.name + ' image'"
            width="100%"
            height="100%"
            objectFit="cover"
          />
          <div class="card-badges">
            @if (cocktail.makeability) {
              <app-badge
                [type]="cocktail.makeability as BadgeType"
                [label]="makeabilityLabel"
                [icon]="makeabilityIcon"
              />
            }
            @if (cocktail.source === 'ai') {
              <app-badge type="ai" label="AI Generated" icon="🤖" />
            }
          </div>
          <div class="card-favorite">
            <app-favorite-button
              [cocktailId]="cocktail.id"
            />
          </div>
        </div>
        <div class="card-body">
          <h3 [id]="titleId" class="card-title line-clamp-2">{{ cocktail.name }}</h3>
          @if (cocktail.description) {
            <p class="card-description line-clamp-3">{{ cocktail.description }}</p>
          }
          @if (cocktail.rating) {
            <div class="card-rating">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="star-icon">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>{{ cocktail.rating }}</span>
              @if (cocktail.ratingCount) {
                <span class="rating-count">({{ cocktail.ratingCount }})</span>
              }
            </div>
          }
        </div>
      </a>
    </article>
  `,
  styles: [`
    .cocktail-card {
      width: 100%;
    }

    .card-link {
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .card-image {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      background: var(--color-bg-tertiary);
    }

    .card-badges {
      position: absolute;
      top: var(--space-2);
      left: var(--space-2);
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .card-favorite {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
    }

    .card-body {
      padding: var(--space-4);
    }

    .card-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h5);
      font-weight: var(--font-weight-semibold);
      color: var(--color-text-primary);
      margin-bottom: var(--space-2);
    }

    .card-description {
      font-size: var(--font-size-body-small);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-3);
    }

    .card-rating {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--font-size-caption);
      color: var(--color-text-secondary);
    }

    .star-icon {
      color: #FFD700;
    }

    .rating-count {
      color: var(--color-text-tertiary);
    }
  `]
})
export class CocktailCardComponent {
  @Input() cocktail!: Cocktail;

  @Output() action = new EventEmitter<string>();

  private titleId = 'cocktail-title-' + Math.random().toString(36).slice(2, 9);

  get makeabilityLabel(): string {
    switch (this.cocktail.makeability) {
      case 'makeable': return 'Makeable';
      case 'almost': return 'Almost';
      case 'unmakeable': return 'Missing';
      default: return '';
    }
  }

  get makeabilityIcon(): string {
    switch (this.cocktail.makeability) {
      case 'makeable': return '✓';
      case 'almost': return '!';
      case 'unmakeable': return '✗';
      default: return '';
    }
  }
}
