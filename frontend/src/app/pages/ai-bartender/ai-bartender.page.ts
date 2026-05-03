import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AiStore } from '../../core/stores/ai.store';
import { InventoryStore } from '../../core/stores/inventory.store';
import { UiStore } from '../../core/stores/ui.store';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-ai-bartender-page',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonComponent,
    BadgeComponent,
    IconComponent,
    SkeletonComponent
  ],
  template: `
    <div class="container page-section">
      <h1 class="page-title">AI Bartender</h1>

      <div class="ai-form card">
        <div class="form-section">
          <label class="form-label" for="ai-ingredients">
            What flavors are you craving? <span class="hint">(comma-separated)</span>
          </label>
          <input
            id="ai-ingredients"
            type="text"
            class="form-input"
            [(ngModel)]="ingredientsInput"
            placeholder="e.g., rum, lime, mint, sugar"
            [disabled]="aiStore.generating()"
          />
        </div>

        <div class="form-section">
          <label class="form-label" for="ai-theme">Theme (optional)</label>
          <select
            id="ai-theme"
            class="form-input"
            [(ngModel)]="theme"
            [disabled]="aiStore.generating()"
          >
            <option value="">No theme</option>
            <option value="tiki">Tiki</option>
            <option value="classic">Classic</option>
            <option value="frozen">Frozen</option>
            <option value="modern">Modern</option>
          </select>
        </div>

        <div class="form-section">
          <label class="form-label" for="ai-language">Language</label>
          <select
            id="ai-language"
            class="form-input"
            [(ngModel)]="language"
            [disabled]="aiStore.generating()"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
          </select>
        </div>

        <div class="form-section">
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="useOnlyMyBar" [disabled]="inventoryStore.items().length === 0 || aiStore.generating()" />
            Use ONLY ingredients from My Bar
          </label>
          @if (inventoryStore.items().length === 0) {
            <p class="form-hint">Your bar is empty. Add ingredients to use this option.</p>
          }
        </div>

        <app-button
          (action)="onGenerate()"
          [loading]="aiStore.generating()"
          [disabled]="!ingredientsInput.trim() || aiStore.generating()"
          style="width: 100%;"
        >
          <app-icon name="sparkles" [size]="20" />
          Generate Recipe
        </app-button>
      </div>

      @if (aiStore.generating()) {
        <div class="ai-loader">
          <div class="shaker-animation">
            <app-icon name="sparkles" [size]="48" [color]="'var(--color-primary)'" className="shaker-icon" />
          </div>
          <p class="loader-text">Crafting your perfect cocktail...</p>
          <app-skeleton type="card" />
        </div>
      }

      @if (aiStore.pendingRecipe()) {
        <div class="ai-result card fade-in">
          <div class="result-header">
            <h2 class="result-title">{{ aiStore.pendingRecipe()!.name }}</h2>
            <app-badge type="ai" label="AI Generated" icon="🤖" />
          </div>

          @if (aiStore.pendingRecipe()!.description) {
            <p class="result-description">{{ aiStore.pendingRecipe()!.description }}</p>
          }

          <h4 class="result-subtitle">Ingredients</h4>
          <ul class="result-ingredients">
            @for (ing of aiStore.pendingRecipe()!.ingredients; track $index) {
              <li class="result-ingredient">
                {{ ing.measure || ing.amount + ' ' + ing.unit }} {{ ing.name }}
              </li>
            }
          </ul>

          <h4 class="result-subtitle">Instructions</h4>
          <p class="result-instructions">{{ aiStore.pendingRecipe()!.instructions }}</p>

          <div class="result-actions">
            <app-button variant="outline" (action)="onDiscard()">
              <app-icon name="thumbs-down" [size]="16" /> Discard
            </app-button>
            <app-button (action)="showSaveInput = true">
              <app-icon name="save" [size]="16" /> Save Recipe
            </app-button>
          </div>

          @if (showSaveInput) {
            <div class="save-form">
              <input
                type="text"
                class="form-input"
                [(ngModel)]="saveName"
                placeholder="Recipe name"
                aria-label="Recipe name"
              />
              <div class="save-actions">
                <app-button variant="ghost" (action)="showSaveInput = false">Cancel</app-button>
                <app-button [disabled]="!saveName.trim()" (action)="onSave()">Save</app-button>
              </div>
            </div>
          }
        </div>
      }

      @if (aiStore.history().length > 0) {
        <section class="page-section">
          <h3 class="section-title">Previous Generations</h3>
          <div class="history-list">
            @for (recipe of aiStore.history(); track recipe.id) {
              <a [routerLink]="['/ai-bartender', recipe.id]" class="history-item card">
                <span class="history-name">{{ recipe.name }}</span>
                <span class="history-date">{{ recipe.createdAt | date:'short' }}</span>
              </a>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .ai-form {
      padding: var(--space-6);
      margin-bottom: var(--space-8);
    }

    .form-section {
      margin-bottom: var(--space-4);
    }

    .form-label {
      display: block;
      font-size: var(--font-size-body-small);
      font-weight: var(--font-weight-medium);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-2);
    }

    .hint {
      font-weight: var(--font-weight-regular);
      color: var(--color-text-tertiary);
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--font-size-body-small);
      color: var(--color-text-secondary);
      cursor: pointer;
    }

    .ai-loader {
      text-align: center;
      padding: var(--space-12) 0;
    }

    .shaker-animation {
      margin-bottom: var(--space-6);
    }

    .shaker-icon {
      animation: shake 0.5s ease-in-out infinite;
    }

    @keyframes shake {
      0%, 100% { transform: rotate(0); }
      25% { transform: rotate(5deg); }
      75% { transform: rotate(-5deg); }
    }

    .loader-text {
      font-size: var(--font-size-body);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-6);
    }

    .ai-result {
      padding: var(--space-6);
      margin-bottom: var(--space-8);
    }

    .result-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3);
    }

    .result-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h3);
    }

    .result-description {
      color: var(--color-text-secondary);
      margin-bottom: var(--space-4);
    }

    .result-subtitle {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h6);
      margin-bottom: var(--space-2);
      margin-top: var(--space-4);
    }

    .result-ingredients {
      list-style: none;
      padding: 0;
    }

    .result-ingredient {
      padding: var(--space-2) 0;
      font-family: var(--font-family-mono);
      font-size: var(--font-size-body-small);
      color: var(--color-text-primary);
      border-bottom: 1px solid var(--color-border);
    }

    .result-instructions {
      color: var(--color-text-secondary);
      line-height: var(--line-height-loose);
      white-space: pre-line;
    }

    .result-actions {
      display: flex;
      gap: var(--space-3);
      margin-top: var(--space-6);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
    }

    .save-form {
      margin-top: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
    }

    .save-actions {
      display: flex;
      gap: var(--space-3);
      margin-top: var(--space-3);
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4);
      text-decoration: none;
      color: var(--color-text-primary);
      transition: background-color var(--transition-fast);

      &:hover {
        background: var(--color-bg-tertiary);
      }
    }

    .history-name {
      font-weight: var(--font-weight-medium);
    }

    .history-date {
      font-size: var(--font-size-caption);
      color: var(--color-text-tertiary);
    }
  `]
})
export class AiBartenderPage implements OnInit {
  readonly aiStore = inject(AiStore);
  readonly inventoryStore = inject(InventoryStore);
  readonly uiStore = inject(UiStore);

  ingredientsInput = '';
  theme = '';
  language = 'en';
  useOnlyMyBar = false;
  showSaveInput = false;
  saveName = '';

  ngOnInit(): void {
    this.aiStore.loadHistory();
  }

  onGenerate(): void {
    const ingredients = this.useOnlyMyBar
      ? this.inventoryStore.items().map(i => i.name)
      : this.ingredientsInput.split(',').map(s => s.trim()).filter(Boolean);

    if (ingredients.length === 0) {
      this.uiStore.addToast({
        id: crypto.randomUUID(),
        message: 'Please enter at least one ingredient.',
        type: 'warning'
      });
      return;
    }

    this.aiStore.generate(ingredients, this.theme || undefined, undefined, 2, this.language);
  }

  onDiscard(): void {
    const recipe = this.aiStore.pendingRecipe();
    if (recipe) {
      this.aiStore.deleteRecipe(recipe.id).subscribe();
    }
  }

  onSave(): void {
    const recipe = this.aiStore.pendingRecipe();
    if (recipe && this.saveName.trim()) {
      this.aiStore.saveAsCocktail(recipe.id, this.saveName.trim()).subscribe({
        next: () => {
          this.showSaveInput = false;
          this.saveName = '';
          this.uiStore.addToast({
            id: crypto.randomUUID(),
            message: 'Recipe saved to your collection!',
            type: 'success'
          });
        },
        error: () => {
          this.uiStore.addToast({
            id: crypto.randomUUID(),
            message: 'Failed to save recipe.',
            type: 'error'
          });
        }
      });
    }
  }
}
