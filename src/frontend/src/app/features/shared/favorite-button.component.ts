import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { FavoriteStore } from '../../core/stores/favorite.store';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-favorite-button',
  standalone: true,
  imports: [IconComponent],
  template: `
    <button
      class="favorite-btn"
      [class.active]="isFav()"
      [class.heart-bounce]="bouncing()"
      [attr.aria-label]="isFav() ? 'Remove from favorites' : 'Add to favorites'"
      [attr.aria-pressed]="isFav()"
      (click)="toggle($event)"
      (keydown.enter)="toggle($event)"
    >
      <app-icon
        [name]="isFav() ? 'heart' : 'heart'"
        [size]="20"
        [color]="isFav() ? 'var(--color-error)' : 'var(--color-text-tertiary)'"
      />
    </button>
  `,
  styles: [
    `
      .favorite-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--border-radius-full);
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(4px);
        color: var(--color-text-tertiary);
        transition: transform var(--duration-fast) var(--ease-bounce);

        &.active {
          color: var(--color-error);
          background: rgba(244, 67, 54, 0.15);
        }

        &:hover {
          transform: scale(1.1);
        }

        &:active {
          transform: scale(0.9);
        }
      }

      @keyframes heartBounce {
        0% { transform: scale(1); }
        30% { transform: scale(1.3); }
        50% { transform: scale(0.9); }
        70% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }

      .heart-bounce {
        animation: heartBounce 0.4s ease-out;
      }
    `,
  ],
})
export class FavoriteButtonComponent {
  @Input() cocktailId!: string;

  private favoriteStore = inject(FavoriteStore);
  readonly bouncing = signal(false);

  isFav(): boolean {
    return this.favoriteStore.isFavorite(this.cocktailId);
  }

  toggle(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.favoriteStore.toggle(this.cocktailId);
    this.bouncing.set(true);
    setTimeout(() => this.bouncing.set(false), 0);
  }
}
