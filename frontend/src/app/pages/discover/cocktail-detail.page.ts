import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CocktailStore } from '../../core/stores/cocktail.store';
import { InventoryStore } from '../../core/stores/inventory.store';
import { UiStore } from '../../core/stores/ui.store';
import { CocktailImageComponent } from '../../shared/components/cocktail-image/cocktail-image.component';
import { FavoriteButtonComponent } from '../../features/shared/favorite-button.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-cocktail-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    CocktailImageComponent,
    FavoriteButtonComponent,
    BadgeComponent,
    ButtonComponent,
    ModalComponent,
    SkeletonComponent,
    IconComponent
  ],
  template: `
    @if (cocktailStore.loading() || !cocktail()) {
      <div class="container" style="padding-top: 2rem;">
        <app-skeleton type="card" />
        <div style="height: 200px;"></div>
      </div>
    } @else {
      <div class="container detail-page">
        <div class="hero-image">
          <app-cocktail-image
            [imageFull]="cocktail()!.imageFull"
            [imageThumb]="cocktail()!.imageThumb"
            [cocktailName]="cocktail()!.name"
            [altText]="cocktail()!.name"
            width="100%"
            height="100%"
            objectFit="cover"
          />
          <div class="hero-favorite">
            <app-favorite-button [cocktailId]="cocktail()!.id" />
          </div>
        </div>

        <div class="detail-header">
          <h1 class="detail-title">{{ cocktail()!.name }}</h1>
          <div class="detail-meta">
            @if (cocktail()!.author) {
              <span class="author">
                <app-icon name="user" [size]="14" />
                {{ cocktail()!.author!.displayName || 'Unknown' }}
              </span>
            }
            @if (cocktail()!.rating) {
              <span class="rating">
                <app-icon name="star" [size]="14" [color]="'#FFD700'" />
                {{ cocktail()!.rating }}
                @if (cocktail()!.ratingCount) {
                  ({{ cocktail()!.ratingCount }})
                }
              </span>
            }
            @if (cocktail()!.makeability) {
              @if (cocktail()!.makeability === 'makeable') {
                <app-badge type="makeable" label="Makeable" icon="✓" />
              } @else if (cocktail()!.makeability === 'almost') {
                <app-badge type="almost" label="Almost Makeable" icon="!" />
              } @else {
                <app-badge type="unmakeable" label="Missing Ingredients" icon="✗" />
              }
            }
          </div>
        </div>

        @if (cocktail()!.description) {
          <p class="detail-description">{{ cocktail()!.description }}</p>
        }

        <section class="detail-section">
          <h3 class="section-title">Ingredients</h3>
          <ul class="ingredients-list">
            @for (ing of cocktail()!.ingredients; track ing.ingredient?.id || $index) {
              <li class="ingredient-item" [class.missing]="isMissing(ing.ingredient?.name)">
                <span class="ingredient-check">
                  @if (isMissing(ing.ingredient?.name)) {
                    <app-icon name="x-circle" [size]="18" [color]="'var(--color-error)'" />
                  } @else {
                    <app-icon name="check-circle" [size]="18" [color]="'var(--color-success)'" />
                  }
                </span>
                <span class="ingredient-name">{{ ing.measure || ing.amount + ' ' + ing.unit }}</span>
                <span class="ingredient-type text-truncate">{{ ing.ingredient?.name || 'Unknown' }}</span>
              </li>
            }
          </ul>
        </section>

        <section class="detail-section">
          <h3 class="section-title">Instructions</h3>
          <p class="instructions-text">{{ cocktail()!.instructions }}</p>
        </section>

        @if (cocktail()!.makeability === 'makeable' || cocktail()!.makeability === 'almost') {
          <div class="prepare-area">
            <app-button (action)="showPrepareModal = true">
              <app-icon name="glass-water" [size]="20" />
              Prepare This Cocktail
            </app-button>
          </div>
        }
      </div>
    }

    <app-modal [open]="showPrepareModal" title="Prepare Cocktail" (close)="showPrepareModal = false">
      <p style="margin-bottom: 1rem;">Are you sure you want to prepare this cocktail? This will deduct the required ingredients from your inventory.</p>
      <div style="display: flex; gap: 0.75rem;">
        <app-button variant="outline" (action)="showPrepareModal = false">Cancel</app-button>
        <app-button [loading]="preparing" (action)="onPrepare()">Confirm Prepare</app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    .detail-page {
      padding-bottom: var(--space-20);
    }

    .hero-image {
      position: relative;
      width: 100%;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: var(--border-radius-lg);
      background: var(--color-bg-tertiary);
      margin-bottom: var(--space-6);
    }

    .hero-favorite {
      position: absolute;
      top: var(--space-3);
      right: var(--space-3);
    }

    .detail-header {
      margin-bottom: var(--space-4);
    }

    .detail-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h1);
      margin-bottom: var(--space-3);
    }

    .detail-meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-3);
      font-size: var(--font-size-body-small);
      color: var(--color-text-secondary);
    }

    .author, .rating {
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }

    .detail-description {
      font-size: var(--font-size-body);
      color: var(--color-text-secondary);
      line-height: var(--line-height-loose);
      margin-bottom: var(--space-8);
    }

    .detail-section {
      margin-bottom: var(--space-8);
    }

    .section-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h4);
      margin-bottom: var(--space-4);
    }

    .ingredients-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .ingredient-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      background: var(--color-bg-tertiary);
      border-radius: var(--border-radius-md);

      &.missing {
        opacity: 0.6;
      }
    }

    .ingredient-check {
      flex-shrink: 0;
      display: flex;
    }

    .ingredient-name {
      font-family: var(--font-family-mono);
      font-size: var(--font-size-body-small);
      color: var(--color-text-primary);
      min-width: 80px;
    }

    .ingredient-type {
      font-size: var(--font-size-body-small);
      color: var(--color-text-secondary);
      max-width: 150px;
    }

    .instructions-text {
      font-size: var(--font-size-body);
      color: var(--color-text-secondary);
      line-height: var(--line-height-loose);
      white-space: pre-line;
    }

    .prepare-area {
      display: flex;
      justify-content: center;
      padding: var(--space-8) 0;
      position: sticky;
      bottom: calc(var(--bottom-nav-height) + var(--space-4));
      background: var(--color-bg-primary);
    }

    @media (min-width: 768px) {
      .prepare-area {
        bottom: var(--space-4);
      }
    }
  `]
})
export class CocktailDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  readonly cocktailStore = inject(CocktailStore);
  readonly inventoryStore = inject(InventoryStore);
  readonly uiStore = inject(UiStore);

  showPrepareModal = false;
  preparing = false;

  get cocktail() {
    return this.cocktailStore.currentCocktail;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cocktailStore.loadCocktail(id);
    }
  }

  isMissing(name?: string): boolean {
    if (!name) return false;
    const item = this.inventoryStore.items().find(
      i => i.name?.toLowerCase() === name.toLowerCase()
    );
    return !item || item.quantity <= 0;
  }

  onPrepare(): void {
    const c = this.cocktail();
    if (!c) return;

    this.preparing = true;
    const ingredients = c.ingredients.map(ing => ({
      ingredientId: ing.ingredient?.id || '',
      amount: ing.amount,
      unit: ing.unit
    }));

    this.inventoryStore.deplete(ingredients).subscribe({
      next: () => {
        this.preparing = false;
        this.showPrepareModal = false;
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: `${c.name} prepared. Stock deducted.`,
          type: 'success',
          action: 'undo'
        });
      },
      error: () => {
        this.preparing = false;
        this.showPrepareModal = false;
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Failed to prepare cocktail. Check your connection.',
          type: 'error',
          action: 'retry'
        });
      }
    });
  }
}
