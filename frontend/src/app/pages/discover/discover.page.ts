import { Component, OnInit, inject, signal } from '@angular/core';
import { CocktailStore, Cocktail } from '../../core/stores/cocktail.store';
import { CocktailCardComponent } from '../../shared/components/cocktail-card/cocktail-card.component';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-discover-page',
  standalone: true,
  imports: [
    CocktailCardComponent,
    SearchBarComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ButtonComponent
  ],
  template: `
    <div class="container">
      <h1 class="page-title">Discover</h1>

      <div class="search-section">
        <app-search-bar
          placeholder="Search cocktails..."
          (search)="onSearch($event)"
        />
      </div>

      @if (cocktailStore.makeable().length > 0) {
        <section class="page-section">
          <h2 class="section-title">You Can Make</h2>
          <div class="carousel-scroll">
            @for (cocktail of cocktailStore.makeable(); track cocktail.id) {
              <div class="carousel-item">
                <app-cocktail-card [cocktail]="cocktail" />
              </div>
            }
          </div>
        </section>
      }

      <section class="page-section">
        <h2 class="section-title">
          @if (cocktailStore.searchQuery()) {
            Results for "{{ cocktailStore.searchQuery() }}"
          } @else {
            All Cocktails
          }
        </h2>

        @if (cocktailStore.loading() && cocktailStore.cocktails().length === 0) {
          <div class="grid">
            @for (i of [1,2,3,4,5,6]; track i) {
              <app-skeleton type="card" />
            }
          </div>
        } @else if (cocktailStore.cocktails().length === 0) {
          <app-empty-state
            icon="search-x"
            title="No cocktails found"
            description="Try adjusting your search or ask the AI bartender for a custom recipe."
            [actionLabel]="'Ask AI Bartender'"
          />
        } @else {
          <div class="grid">
            @for (cocktail of cocktailStore.cocktails(); track cocktail.id) {
              <app-cocktail-card [cocktail]="cocktail" />
            }
          </div>

          @if (cocktailStore.hasMore()) {
            <div class="load-more">
              <app-button variant="outline" (action)="cocktailStore.loadMore()" [loading]="cocktailStore.loading()">
                Load More
              </app-button>
            </div>
          }
        }
      </section>
    </div>
  `,
  styles: [`
    .search-section {
      margin-bottom: var(--space-6);
    }

    .carousel-scroll {
      display: flex;
      gap: var(--space-4);
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      padding-bottom: var(--space-2);

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .carousel-item {
      flex: 0 0 280px;
      scroll-snap-align: start;
    }

    .load-more {
      display: flex;
      justify-content: center;
      margin-top: var(--space-8);
    }
  `]
})
export class DiscoverPage implements OnInit {
  readonly cocktailStore = inject(CocktailStore);

  ngOnInit(): void {
    this.cocktailStore.search('');
    this.cocktailStore.loadMakeable();
  }

  onSearch(query: string): void {
    this.cocktailStore.search(query || '');
  }
}
