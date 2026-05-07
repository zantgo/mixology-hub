import { Component, OnInit, inject } from '@angular/core';
import { FavoriteStore } from '../../core/stores/favorite.store';
import { CocktailCardComponent } from '../../shared/components/cocktail-card/cocktail-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [CocktailCardComponent, SkeletonComponent, EmptyStateComponent],
  template: `
    <div class="container">
      <h1 class="page-title">Favorites</h1>

      @if (favoriteStore.loading()) {
        <div class="grid">
          @for (i of [1, 2, 3, 4]; track i) {
            <app-skeleton type="card" />
          }
        </div>
      } @else if (favoriteStore.items().length === 0) {
        <app-empty-state
          icon="heart"
          title="No favorites yet"
          description="Tap the heart icon on any cocktail to save it here."
        />
      } @else {
        <div class="grid">
          @for (item of favoriteStore.items(); track item.id) {
            <app-cocktail-card [cocktail]="$any(item)" />
          }
        </div>
      }
    </div>
  `,
  styles: [],
})
export class FavoritesPage implements OnInit {
  readonly favoriteStore = inject(FavoriteStore);

  ngOnInit(): void {
    this.favoriteStore.load();
  }
}
