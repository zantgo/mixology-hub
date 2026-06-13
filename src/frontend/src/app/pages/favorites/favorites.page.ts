import { Component, OnInit, inject, computed } from '@angular/core';
import { FavoriteStore } from '../../core/stores/favorite.store';
import { CocktailCardComponent } from '../../shared/components/cocktail-card/cocktail-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [CocktailCardComponent, SkeletonComponent, EmptyStateComponent, ButtonComponent],
  template: `
    <div class="container">
      <h1 class="page-title">Favorites</h1>

      @if (favoriteStore.loading()) {
        <div class="grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <app-skeleton type="card" />
          }
        </div>
      } @else if (activeFavorites().length === 0 && archivedFavorites().length === 0) {
        <app-empty-state
          icon="heart"
          title="No favorites yet"
          description="Tap the heart icon on any cocktail to save it here."
        />
      } @else {
        @if (activeFavorites().length > 0) {
          <div class="grid">
            @for (item of activeFavorites(); track item.id) {
              @if (item.cocktail) {
                <app-cocktail-card [cocktail]="$any(item.cocktail)" />
              }
              @if (item.external_cocktail_data) {
                <app-cocktail-card [cocktail]="$any(item.external_cocktail_data)" />
              }
            }
          </div>
        }

        @if (archivedFavorites().length > 0) {
          <div class="archived-section">
            <h2 class="archived-section-title">Archived Recipes</h2>
            <p class="archived-section-subtitle">The following recipes have been deleted or archived by their authors.</p>
            <div class="grid">
              @for (item of archivedFavorites(); track item.id) {
                @if (item.cocktail) {
                  <div class="card archived-card">
                    <div class="archived-body">
                      <h3 class="archived-title text-truncate">{{ item.cocktail.name }}</h3>
                      <p class="archived-badge">Deleted by author</p>
                      <app-button variant="outline" (action)="favoriteStore.remove(item.id)">
                        Remove
                      </app-button>
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .archived-section {
        margin-top: var(--space-10);
        padding-top: var(--space-6);
        border-top: 1px dashed var(--color-border);
      }
      .archived-section-title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-h4);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-1);
      }
      .archived-section-subtitle {
        font-size: var(--font-size-body-small);
        color: var(--color-text-tertiary);
        margin-bottom: var(--space-4);
      }
      .archived-card {
        border: 1px dashed var(--color-border);
        background: var(--color-bg-secondary);
        opacity: 0.65;
        transition: opacity var(--transition-fast);
        &:hover {
          opacity: 0.9;
        }
      }
      .archived-body {
        padding: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        align-items: flex-start;
      }
      .archived-title {
        font-family: var(--font-family-heading);
        font-size: var(--font-size-h5);
        color: var(--color-text-secondary);
        width: 100%;
      }
      .archived-badge {
        font-size: var(--font-size-caption);
        color: var(--color-error);
        background: rgba(244, 67, 54, 0.1);
        padding: var(--space-1) var(--space-2);
        border-radius: var(--border-radius-sm);
        font-weight: var(--font-weight-semibold);
      }
    `,
  ],
})
export class FavoritesPage implements OnInit {
  readonly favoriteStore = inject(FavoriteStore);

  readonly activeFavorites = computed(() =>
    this.favoriteStore.items().filter(
      (item) =>
        (item.cocktail && !item.cocktail.isDeleted) ||
        item.external_cocktail_data
    )
  );

  readonly archivedFavorites = computed(() =>
    this.favoriteStore.items().filter(
      (item) => item.cocktail && item.cocktail.isDeleted
    )
  );

  ngOnInit(): void {
    this.favoriteStore.load();
  }
}
