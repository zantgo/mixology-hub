import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SearchBarComponent } from '../../shared/components/search-bar/search-bar.component';
import { UnitSelectComponent } from '../../shared/components/unit-select/unit-select.component';

@Component({
  selector: 'app-add-ingredient-sheet',
  standalone: true,
  imports: [FormsModule, IconComponent, SearchBarComponent, UnitSelectComponent],
  template: `
    @if (open) {
      <div class="sheet-backdrop" (click)="close.emit()">
        <div class="sheet-content" (click)="$event.stopPropagation()">
          <div class="sheet-handle"></div>
          <h3 class="sheet-title">Add Ingredient</h3>

          <app-search-bar
            placeholder="Search ingredients..."
            (search)="onSearch($event)"
          />

          @if (results().length) {
            <div class="results-list">
              @for (ingredient of results(); track ingredient.id) {
                <button class="result-item" (click)="selectIngredient(ingredient)">
                  <span class="result-name">{{ ingredient.name }}</span>
                  <app-icon name="plus" [size]="16" />
                </button>
              }
            </div>
          }

          @if (selected()) {
            <div class="quantity-form">
              <h4 class="form-title">Add {{ selected()?.name }}</h4>
              <div class="qty-row">
                <input
                  type="text"
                  inputmode="decimal"
                  class="form-input qty-input"
                  [ngModel]="quantity"
                  (ngModelChange)="onQuantityChange($event)"
                  placeholder="Quantity"
                  aria-label="Quantity"
                />
                <app-unit-select [(ngModel)]="unit" />
              </div>
              <button class="btn-add" (click)="confirm()" [disabled]="!quantity">
                Add to My Bar
              </button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-index-3);
      display: flex;
      align-items: flex-end;
      background: rgba(0, 0, 0, 0.5);
      animation: fadeIn var(--duration-fast) var(--ease-out);
    }

    .sheet-content {
      background: var(--color-bg-secondary);
      border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      padding: var(--space-4) var(--space-6) var(--space-8);
      animation: slideUp var(--duration-normal) var(--ease-out);
    }

    .sheet-handle {
      width: 40px;
      height: 4px;
      background: var(--color-border);
      border-radius: var(--border-radius-full);
      margin: 0 auto var(--space-4);
    }

    .sheet-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h4);
      margin-bottom: var(--space-4);
    }

    .results-list {
      margin-top: var(--space-3);
      max-height: 200px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .result-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3);
      border-radius: var(--border-radius-md);
      color: var(--color-text-primary);
      min-height: 44px;

      &:hover {
        background: var(--color-bg-tertiary);
      }
    }

    .result-name {
      font-size: var(--font-size-body);
    }

    .quantity-form {
      margin-top: var(--space-6);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
    }

    .form-title {
      font-size: var(--font-size-body);
      margin-bottom: var(--space-3);
    }

    .qty-row {
      display: flex;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .qty-input {
      flex: 1;
    }

    .btn-add {
      width: 100%;
      height: 48px;
      background: var(--color-primary);
      color: #fff;
      border: none;
      border-radius: var(--border-radius-md);
      font-size: var(--font-size-body);
      font-weight: var(--font-weight-medium);
      cursor: pointer;

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      &:hover:not(:disabled) {
        background: var(--color-primary-dark);
      }
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class AddIngredientSheetComponent {
  @Input() open: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() added = new EventEmitter<{ ingredientId: string; quantity: number; unit: string }>();

  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  results = signal<any[]>([]);
  selected = signal<any | null>(null);
  quantity: number = 1;
  unit: string = 'ml';

  onSearch(query: string): void {
    if (!query || query.length < 2) {
      this.results.set([]);
      return;
    }
    this.http.get<any>(`${this.apiUrl}/ingredients`, { params: { name: query, limit: 10 } })
      .subscribe({
        next: (res) => this.results.set(res.data || []),
        error: () => this.results.set([])
      });
  }

  selectIngredient(ingredient: any): void {
    this.selected.set(ingredient);
    if (ingredient.baseUnit) {
      this.unit = ingredient.baseUnit;
    }
  }

  onQuantityChange(value: string): void {
    if (value === '' || value === undefined) {
      this.quantity = 0;
      return;
    }
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      this.quantity = num;
    }
  }

  confirm(): void {
    const sel = this.selected();
    if (sel && this.quantity > 0) {
      this.added.emit({
        ingredientId: sel.id,
        quantity: this.quantity,
        unit: this.unit
      });
    }
  }
}
