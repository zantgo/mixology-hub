import { Component, OnInit, inject } from '@angular/core';
import { InventoryStore } from '../../core/stores/inventory.store';
import { UiStore } from '../../core/stores/ui.store';
import { InventoryCardComponent } from '../../features/inventory/inventory-card.component';
import { AddIngredientSheetComponent } from '../../features/inventory/add-ingredient-sheet.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-my-bar-page',
  standalone: true,
  imports: [
    InventoryCardComponent,
    AddIngredientSheetComponent,
    EmptyStateComponent,
    SkeletonComponent,
    ButtonComponent
  ],
  template: `
    <div class="container page-section">
      <div class="page-header">
        <h1 class="page-title">My Bar</h1>
        <app-button (action)="showAddSheet = true">
          + Add Ingredient
        </app-button>
      </div>

      @if (showAddSheet) {
        <app-add-ingredient-sheet
          [open]="true"
          (close)="showAddSheet = false"
          (added)="onAdd($event)"
        />
      }

      @if (inventoryStore.loading()) {
        <div style="display: flex; flex-direction: column; gap: 12px;">
          @for (i of [1,2,3,4,5]; track i) {
            <app-skeleton type="row" />
          }
        </div>
      } @else if (inventoryStore.items().length === 0) {
        <app-empty-state
          icon="glass-water"
          title="Your bar is empty"
          description="Add your first ingredient to start discovering cocktails you can make."
          [actionLabel]="'Add your first ingredient'"
        />
      } @else {
        @for (category of inventoryStore.categories(); track category.name) {
          <div class="category-section">
            <h3 class="category-title">{{ category.name }}</h3>
            <div class="inventory-list">
              @for (item of category.items; track item.id) {
                <app-inventory-card
                  [item]="item"
                  (remove)="onRemove($event)"
                />
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-6);
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .page-title {
      margin-bottom: 0;
    }

    .category-section {
      margin-bottom: var(--space-8);
    }

    .category-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h5);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-3);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .inventory-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
  `]
})
export class MyBarPage implements OnInit {
  readonly inventoryStore = inject(InventoryStore);
  readonly uiStore = inject(UiStore);

  showAddSheet = false;

  ngOnInit(): void {
    this.inventoryStore.load();
    this.inventoryStore.loadSummary();
  }

  onAdd(event: { ingredientId: string; quantity: number; unit: string }): void {
    this.inventoryStore.add(event).subscribe({
      next: () => {
        this.showAddSheet = false;
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Ingredient added to your bar.',
          type: 'success'
        });
      },
      error: () => {
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Failed to add ingredient.',
          type: 'error'
        });
      }
    });
  }

  onRemove(id: string): void {
    this.inventoryStore.remove(id).subscribe({
      next: () => {
        this.uiStore.addToast({
          id: crypto.randomUUID(),
          message: 'Ingredient removed.',
          type: 'success'
        });
      }
    });
  }
}
