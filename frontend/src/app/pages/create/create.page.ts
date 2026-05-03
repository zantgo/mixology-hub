import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { CocktailService } from '../../core/services/cocktail.service';
import { UiStore } from '../../core/stores/ui.store';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { environment } from '../../../environments/environment';

interface IngredientRow {
  ingredientId: string;
  ingredientName: string;
  amount: number;
  unit: string;
  measure: string;
  searchResults: any[];
  searchOpen: boolean;
  searchTerm: string;
}

const ALLOWED_UNITS = ['ml', 'oz', 'l', 'cl', 'tbsp', 'tsp', 'dash', 'dashes', 'count', 'g', 'kg', 'parts', 'part', 'drops', 'drop', 'splashes', 'splash', 'slices', 'slice', 'wedges', 'wedge', 'twists', 'twist', 'sprigs', 'sprig', 'leaves', 'leaf'];

@Component({
  selector: 'app-create-page',
  standalone: true,
  imports: [FormsModule, ButtonComponent, IconComponent],
  template: `
    <div class="container">
      <h1 class="page-title">Create Recipe</h1>

      <form (ngSubmit)="onSubmit()" class="create-form card">
        <div class="form-group">
          <label class="form-label" for="name">Cocktail Name *</label>
          <input id="name" type="text" class="form-input" [(ngModel)]="name" name="name" placeholder="e.g. Classic Mojito" required [disabled]="submitting()" />
        </div>

        <div class="form-group">
          <label class="form-label" for="description">Description</label>
          <textarea id="description" class="form-input form-textarea" [(ngModel)]="description" name="description" rows="2" placeholder="A brief description of your cocktail..." [disabled]="submitting()"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label" for="instructions">Instructions *</label>
          <textarea id="instructions" class="form-input form-textarea" [(ngModel)]="instructions" name="instructions" rows="4" placeholder="Step-by-step preparation instructions..." required [disabled]="submitting()"></textarea>
        </div>

        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="isPublic" name="isPublic" [disabled]="submitting()" />
            Make this cocktail public
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">Image</label>
          <div class="image-upload">
            @if (imagePreview()) {
              <div class="image-preview">
                <img [src]="imagePreview()!" alt="Preview" />
                <button type="button" class="remove-image" (click)="removeImage()" [disabled]="submitting()">
                  <app-icon name="x" [size]="16" />
                </button>
              </div>
            } @else {
              <label class="upload-placeholder">
                <app-icon name="image" [size]="32" [color]="'var(--color-text-tertiary)'" />
                <span>Click to upload (JPG, PNG, WebP)</span>
                <input type="file" accept=".jpg,.jpeg,.png,.webp" (change)="onImageSelected($event)" [disabled]="submitting()" hidden />
              </label>
            }
          </div>
        </div>

        <h3 class="section-title">Ingredients *</h3>

        <div class="ingredients-list">
          @for (row of ingredients; track $index; let i = $index) {
            <div class="ingredient-row">
              <div class="ingredient-search">
                <input
                  type="text"
                  class="form-input"
                  [ngModel]="row.ingredientName"
                  (ngModelChange)="onIngredientSearch($index, $event)"
                  [name]="'ingredientSearch' + i"
                  placeholder="Search ingredient..."
                  [disabled]="submitting()"
                  (focus)="row.searchOpen = true"
                  (blur)="closeDropdown($index)"
                />
                @if (row.searchResults.length > 0 && row.searchOpen) {
                  <ul class="search-dropdown">
                    @for (result of row.searchResults; track result.id) {
                      <li (mousedown)="selectIngredient($index, result)">{{ result.name }}</li>
                    }
                  </ul>
                }
              </div>
              <input type="number" class="form-input amount-input" [(ngModel)]="row.amount" [name]="'amount' + i" placeholder="Qty" min="0" step="0.1" [disabled]="submitting()" />
              <select class="form-input unit-select" [(ngModel)]="row.unit" [name]="'unit' + i" (ngModelChange)="updateMeasure($index)" [disabled]="submitting()">
                @for (u of ALLOWED_UNITS; track u) {
                  <option [value]="u">{{ u }}</option>
                }
              </select>
              <input type="text" class="form-input measure-input" [(ngModel)]="row.measure" [name]="'measure' + i" placeholder="e.g. 2 oz" [disabled]="submitting()" />
              <button type="button" class="remove-btn" (click)="removeIngredient(i)" [disabled]="submitting()">
                <app-icon name="trash" [size]="18" [color]="'var(--color-error)'" />
              </button>
            </div>
          }
        </div>

        <button type="button" class="add-ingredient-btn" (click)="addIngredient()" [disabled]="submitting()">
          <app-icon name="plus" [size]="18" />
          Add Ingredient
        </button>

        @if (error()) {
          <p class="form-error">{{ error() }}</p>
        }

        <div class="form-actions">
          <app-button variant="outline" type="button" (action)="router.navigate(['/discover'])" [disabled]="submitting()">Cancel</app-button>
          <app-button type="submit" [loading]="submitting()" [disabled]="!isValid() || submitting()">
            <app-icon name="save" [size]="18" />
            Save Recipe
          </app-button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .create-form {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .form-label {
      font-size: var(--font-size-body-small);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
    }

    .form-input {
      width: 100%;
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      background: var(--color-bg-primary);
      color: var(--color-text-primary);
      font-size: var(--font-size-body);
      transition: border-color var(--transition-fast);
      box-sizing: border-box;

      &:focus { outline: none; border-color: var(--color-primary); }
      &:disabled { opacity: 0.6; }
    }

    .form-textarea { resize: vertical; font-family: inherit; }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--font-size-body-small);
      color: var(--color-text-secondary);
      cursor: pointer;
    }

    .image-upload { margin-top: var(--space-1); }

    .upload-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-8);
      border: 2px dashed var(--color-border);
      border-radius: var(--border-radius-md);
      cursor: pointer;
      color: var(--color-text-tertiary);
      font-size: var(--font-size-body-small);
      transition: border-color var(--transition-fast);

      &:hover { border-color: var(--color-primary); }
    }

    .image-preview {
      position: relative;
      width: 200px;
      height: 200px;
      overflow: hidden;
      border-radius: var(--border-radius-md);
    }

    .image-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .remove-image {
      position: absolute;
      top: 4px;
      right: 4px;
      background: var(--color-error);
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .section-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h5);
      margin: var(--space-4) 0 0;
    }

    .ingredients-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .ingredient-row {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
    }

    .ingredient-search { position: relative; flex: 2; min-width: 0; }

    .search-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 160px;
      overflow-y: auto;
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      z-index: 10;
      list-style: none;
      padding: var(--space-1) 0;
      margin: 2px 0 0;
    }

    .search-dropdown li {
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      font-size: var(--font-size-body-small);
      color: var(--color-text-primary);

      &:hover { background: var(--color-bg-tertiary); }
    }

    .amount-input { flex: 1; min-width: 60px; }
    .unit-select { flex: 1; min-width: 70px; }
    .measure-input { flex: 1.5; min-width: 80px; }

    .remove-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: var(--space-2);
      display: flex;
      align-items: center;
    }

    .add-ingredient-btn {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      background: none;
      border: 1px dashed var(--color-border);
      border-radius: var(--border-radius-md);
      padding: var(--space-3);
      cursor: pointer;
      color: var(--color-text-secondary);
      font-size: var(--font-size-body-small);
      width: 100%;
      justify-content: center;

      &:hover { border-color: var(--color-primary); color: var(--color-primary); }
    }

    .form-error {
      color: var(--color-error);
      font-size: var(--font-size-body-small);
      margin: 0;
    }

    .form-actions {
      display: flex;
      gap: var(--space-3);
      justify-content: flex-end;
      margin-top: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
    }
  `]
})
export class CreatePage {
  private cocktailApi = inject(CocktailService);
  private http = inject(HttpClient);
  readonly uiStore = inject(UiStore);
  readonly router = inject(Router);

  name = '';
  description = '';
  instructions = '';
  isPublic = true;
  imageFile?: File;
  imagePreview = signal<string | null>(null);
  ingredients: IngredientRow[] = [];
  submitting = signal(false);
  error = signal<string | null>(null);
  ALLOWED_UNITS = ALLOWED_UNITS;

  private searchSubjects = new Map<number, Subject<string>>();

  constructor() {
    this.addIngredient();
  }

  addIngredient(): void {
    const idx = this.ingredients.length;
    this.ingredients.push({
      ingredientId: '',
      ingredientName: '',
      amount: 1,
      unit: 'ml',
      measure: '',
      searchResults: [],
      searchOpen: false,
      searchTerm: '',
    });
    const subject = new Subject<string>();
    subject.pipe(debounceTime(300), distinctUntilChanged()).subscribe((term) => {
      if (term.length < 1) {
        this.ingredients[idx].searchResults = [];
        return;
      }
      this.http.get<any[]>(`${environment.apiUrl}/ingredients?name=${encodeURIComponent(term)}&limit=10`).subscribe({
        next: (res: any) => {
          this.ingredients[idx].searchResults = res.data || res || [];
        },
        error: () => {
          this.ingredients[idx].searchResults = [];
        }
      });
    });
    this.searchSubjects.set(idx, subject);
  }

  removeIngredient(i: number): void {
    if (this.ingredients.length <= 1) return;
    this.ingredients.splice(i, 1);
    this.searchSubjects.get(i)?.complete();
    this.searchSubjects.delete(i);
  }

  onIngredientSearch(i: number, term: string): void {
    const row = this.ingredients[i];
    if (!row) return;
    row.ingredientName = term;
    row.searchOpen = true;
    this.searchSubjects.get(i)?.next(term);
  }

  selectIngredient(i: number, result: any): void {
    const row = this.ingredients[i];
    if (!row) return;
    row.ingredientId = result.id;
    row.ingredientName = result.name;
    row.searchOpen = false;
    row.searchResults = [];
    this.updateMeasure(i);
  }

  closeDropdown(i: number): void {
    setTimeout(() => {
      const row = this.ingredients[i];
      if (row) row.searchOpen = false;
    }, 200);
  }

  updateMeasure(i: number): void {
    const row = this.ingredients[i];
    if (!row) return;
    row.measure = `${row.amount} ${row.unit}`;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > 2 * 1024 * 1024) {
        this.error.set('Image must be under 2 MB');
        return;
      }
      this.imageFile = file;
      const reader = new FileReader();
      reader.onload = () => this.imagePreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.imageFile = undefined;
    this.imagePreview.set(null);
  }

  isValid(): boolean {
    return !!this.name.trim() && !!this.instructions.trim() && this.ingredients.length > 0 && this.ingredients.every((r) => !!r.ingredientId && r.amount > 0);
  }

  onSubmit(): void {
    if (!this.isValid() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);

    const data: any = {
      name: this.name.trim(),
      description: this.description.trim() || undefined,
      instructions: this.instructions.trim(),
      isPublic: this.isPublic,
      ingredients: this.ingredients.map((r) => ({
        ingredientId: r.ingredientId,
        amount: r.amount,
        unit: r.unit,
        measure: r.measure || `${r.amount} ${r.unit}`,
      })),
    };

    this.cocktailApi.createCocktailWithImage(data, this.imageFile).subscribe({
      next: (cocktail) => {
        this.submitting.set(false);
        this.uiStore.addToast({ id: crypto.randomUUID(), message: 'Recipe created!', type: 'success' });
        this.router.navigate(['/discover', cocktail.id]);
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.message || 'Failed to create recipe');
      },
    });
  }
}
