import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { InventoryStore, InventoryItem } from '../../core/stores/inventory.store';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar/progress-bar.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
  selector: 'app-inventory-card',
  standalone: true,
  imports: [IconComponent, ProgressBarComponent, BadgeComponent],
  template: `
    <div class="inventory-card card">
      <div class="card-content">
        <div class="card-info">
          <div class="card-header">
            <h4 class="ingredient-name text-truncate">{{ item.name }}</h4>
            @if (item.category) {
              <app-badge type="custom" [label]="item.category" />
            }
          </div>

          <div class="quantity-controls">
            <button
              class="qty-btn"
              (click)="adjust(-1)"
              [disabled]="item.quantity <= 0"
              aria-label="Decrease quantity"
            >
              <app-icon name="minus" [size]="16" />
            </button>
            <span class="qty-value">
              {{ item.quantity }} <span class="qty-unit">{{ item.unit }}</span>
            </span>
            <button class="qty-btn" (click)="adjust(1)" aria-label="Increase quantity">
              <app-icon name="plus" [size]="16" />
            </button>
          </div>
        </div>

        @if (item.lowStock) {
          <span class="low-stock" role="alert">
            <app-icon name="alert-triangle" [size]="12" />
            Low stock
          </span>
        }

        <button
          class="remove-btn"
          (click)="remove.emit(item.id)"
          aria-label="Remove {{ item.name }} from inventory"
        >
          <app-icon name="trash-2" [size]="16" />
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .inventory-card {
        padding: 0;
      }

      .card-content {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-4);
      }

      .card-info {
        flex: 1;
        min-width: 0;
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-3);
      }

      .ingredient-name {
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        max-width: 200px;
      }

      .quantity-controls {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .qty-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: var(--color-bg-tertiary);
        border-radius: var(--border-radius-md);
        color: var(--color-text-secondary);
        transition: background-color var(--transition-fast);

        &:hover:not(:disabled) {
          background: var(--color-bg-tertiary);
          color: var(--color-primary);
        }

        &:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        &:active:not(:disabled) {
          transform: scale(0.9);
        }
      }

      .qty-value {
        font-size: var(--font-size-body);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-primary);
        min-width: 60px;
        text-align: center;
        font-family: var(--font-family-mono);
      }

      .qty-unit {
        font-size: var(--font-size-caption);
        color: var(--color-text-tertiary);
        font-family: var(--font-family-body);
      }

      .low-stock {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        color: var(--color-warning);
        font-size: var(--font-size-caption);
        flex-shrink: 0;
      }

      .remove-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        color: var(--color-text-tertiary);
        border-radius: var(--border-radius-md);
        flex-shrink: 0;

        &:hover {
          background: rgba(244, 67, 54, 0.1);
          color: var(--color-error);
        }
      }
    `,
  ],
})
export class InventoryCardComponent {
  @Input() item!: InventoryItem;
  @Output() remove = new EventEmitter<string>();
  @Output() quantityChange = new EventEmitter<{ id: string; quantity: number }>();

  private inventoryStore = inject(InventoryStore);

  adjust(delta: number): void {
    const newQty = Math.max(0, this.item.quantity + delta);
    const current = this.item.quantity;
    this.item.quantity = newQty;
    this.inventoryStore.updateQuantity(this.item.id, newQty, this.item.unit).subscribe();
  }
}
