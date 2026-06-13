import { Component, OnInit, OnDestroy, inject, effect, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CocktailStore } from '../../core/stores/cocktail.store';
import { InventoryStore } from '../../core/stores/inventory.store';
import { OrderStore } from '../../core/stores/order.store';
import { UiStore } from '../../core/stores/ui.store';
import { AuthStore } from '../../core/stores/auth.store';
import { CocktailImageComponent } from '../../shared/components/cocktail-image/cocktail-image.component';
import { FavoriteButtonComponent } from '../../features/shared/favorite-button.component';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { UnitConvertPipe } from '../../shared/pipes/unit-convert.pipe';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-cocktail-detail-page',
  standalone: true,
  imports: [
    RouterLink,
    CocktailImageComponent,
    FavoriteButtonComponent,
    StarRatingComponent,
    BadgeComponent,
    ButtonComponent,
    ModalComponent,
    SkeletonComponent,
    IconComponent,
    UnitConvertPipe,
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
                <app-star-rating
                  [value]="cocktail()!.rating ?? 0"
                  [count]="cocktail()!.ratingCount ?? 0"
                  [cocktailId]="cocktail()!.id"
                  [interactive]="true"
                  [userRating]="myRating()"
                  (rated)="onRated($event)"
                />
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

                <span class="ingredient-name">
                  @if (ing.amount && ing.unit) {
                    @if (uiStore.unitSystem() === 'imperial' && ing.unit === 'ml') {
                      {{ ing.amount | unitConvert: 'ml' : 'oz' }} oz
                    } @else if (uiStore.unitSystem() === 'metric' && ing.unit === 'oz') {
                      {{ ing.amount | unitConvert: 'oz' : 'ml' }} ml
                    } @else {
                      {{ ing.amount }} {{ ing.unit }}
                    }
                  } @else {
                    {{ ing.measure }}
                  }
                </span>
                <span class="ingredient-type text-truncate">{{
                  ing.ingredient?.name || 'Unknown'
                }}</span>
              </li>
            }
          </ul>
        </section>

        <section class="detail-section">
          <h3 class="section-title">Instructions</h3>
          <p class="instructions-text">{{ cocktail()!.instructions }}</p>
        </section>

        <section class="detail-section">
          <h3 class="section-title">Rate This Cocktail</h3>
          <app-star-rating
            [value]="cocktail()!.rating ?? 0"
            [count]="cocktail()!.ratingCount ?? 0"
            [cocktailId]="cocktail()!.id"
            [interactive]="true"
            [userRating]="myRating()"
            (rated)="onRated($event)"
          />
        </section>

        @if (orderStore.status() === 'completed') {
          <div class="prepare-area">
            <app-badge type="makeable" label="Prepared!" icon="✓" />
          </div>
        } @else if (orderStore.status() === 'cancelled') {
          <div class="prepare-area">
            <app-badge type="unmakeable" label="Order Cancelled" icon="✗" />
          </div>
        } @else if (orderStore.polling()) {
          <div class="prepare-area status-column">
            <app-button [loading]="true">
              <app-icon name="glass-water" [size]="20" />
              @if (orderStore.status() === 'evaluating') {
                Evaluating Stock Integrity...
              } @else if (orderStore.status() === 'preparing') {
                Pouring and Preparing...
              } @else {
                Queueing in Production Line...
              }
            </app-button>
            @if (orderStore.status() === 'queued' || orderStore.status() === 'evaluating') {
              <app-button
                variant="outline"
                (action)="onCancel()"
                [disabled]="orderStore.cancelling()"
              >
                Cancel Order
              </app-button>
            }
          </div>
        } @else if (
          cocktail()!.makeability === 'makeable' || cocktail()!.makeability === 'almost'
        ) {
          <div class="prepare-area">
            <app-button (action)="showPrepareModal = true">
              <app-icon name="glass-water" [size]="20" />
              Prepare This Cocktail
            </app-button>
          </div>
        }
      </div>
    }

    <app-modal
      [open]="showPrepareModal && !orderStore.polling()"
      title="Prepare Cocktail"
      (close)="showPrepareModal = false"
    >
      <p style="margin-bottom: 1rem;">
        Your order will be queued and processed by the bar's inventory system. You'll see the status
        update here.
      </p>
      <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <span>Servings:</span>
        <app-button variant="outline" (action)="decreaseServings()">−</app-button>
        <span style="min-width: 2rem; text-align: center;">{{ servings }}</span>
        <app-button variant="outline" (action)="increaseServings()">+</app-button>
      </div>
      <div style="display: flex; gap: 0.75rem;">
        <app-button variant="outline" (action)="showPrepareModal = false">Cancel</app-button>
        <app-button (action)="onPrepare()">Send Order</app-button>
      </div>
    </app-modal>
  `,
  styles: [
    `
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

      .author,
      .rating {
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
      }

      .ingredient-item.missing {
        opacity: 0.6;
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

      .status-column {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        align-items: center;
      }

      @media (min-width: 768px) {
        .prepare-area {
          bottom: var(--space-4);
        }
      }
    `,
  ],
})
export class CocktailDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private announcer = inject(LiveAnnouncer);
  readonly cocktailStore = inject(CocktailStore);
  readonly inventoryStore = inject(InventoryStore);
  readonly orderStore = inject(OrderStore);
  readonly uiStore = inject(UiStore);
  readonly authStore = inject(AuthStore);

  showPrepareModal = false;
  servings = 1;
  myRating = signal<number>(0);

  constructor() {
    effect(() => {
      const status = this.orderStore.status();
      if (status === 'completed') {
        this.announcer.announce('cocktail prepared', 'assertive');
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: `${this.orderStore.cocktailName() || 'Cocktail'} prepared successfully!`,
          type: 'success',
        });
        this.inventoryStore.load();
      } else if (status === 'failed_insufficient_stock') {
        this.announcer.announce('preparation failed', 'assertive');
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Not enough stock. Please restock the bar inventory.',
          type: 'error',
        });
      } else if (status === 'failed_other') {
        this.announcer.announce('preparation failed', 'assertive');
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Order failed due to a system error. Please try again.',
          type: 'error',
        });
      } else if (status === 'cancelled') {
        this.announcer.announce('order cancelled', 'assertive');
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Order cancelled successfully.',
          type: 'info',
        });
      }
    });
  }

  get cocktail() {
    return this.cocktailStore.currentCocktail;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cocktailStore.loadCocktail(id);
      this.loadUserRating(id);
    }
  }

  ngOnDestroy(): void {
    this.orderStore.stopPolling();
  }

  loadUserRating(id: string): void {
    if (!this.authStore.isAuthenticated()) return;
    this.http.get<number>(`${environment.apiUrl}/cocktails/${id}/my-rating`).subscribe({
      next: (rating) => {
        if (rating) {
          this.myRating.set(rating);
        }
      },
    });
  }

  isMissing(name?: string): boolean {
    if (!name) return false;
    const item = this.inventoryStore
      .items()
      .find((i) => i.name?.toLowerCase() === name.toLowerCase());
    return !item || item.quantity <= 0;
  }

  onRated(event: { score: number; average: number; count: number }): void {
    this.myRating.set(event.score);
    this.uiStore.addToast({
      id: crypto.randomUUID(),
      message: `Rated ${event.score} star${event.score > 1 ? 's' : ''}!`,
      type: 'success',
    });
  }

  decreaseServings(): void {
    this.servings = Math.max(1, this.servings - 1);
  }

  increaseServings(): void {
    this.servings = Math.min(20, this.servings + 1);
  }

  onPrepare(): void {
    const c = this.cocktail();
    if (!c) return;

    this.showPrepareModal = false;
    this.cocktailStore.prepareCocktail(c.id, this.servings);

    this.uiStore.addToast({
      id: crypto.randomUUID(),
      message: 'Order queued. Waiting for inventory confirmation...',
      type: 'info',
    });
  }

  onCancel(): void {
    const logId = this.orderStore.currentLogId();
    if (logId) {
      this.orderStore.cancel(logId).then(() => {
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Order cancelled successfully.',
          type: 'info',
        });
      });
    }
  }
}
