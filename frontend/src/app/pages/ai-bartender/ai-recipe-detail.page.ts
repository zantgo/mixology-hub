import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AiStore } from '../../core/stores/ai.store';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
  selector: 'app-ai-recipe-detail-page',
  standalone: true,
  imports: [RouterLink, SkeletonComponent, BadgeComponent],
  template: `
    <div class="container detail-page">
      @if (!recipe()) {
        <app-skeleton type="card" />
        <div style="height: 200px;"></div>
      } @else {
        <a routerLink="/ai-bartender" class="back-link">← Back to AI Bartender</a>
        <div class="recipe-card card">
          <div class="result-header">
            <h1 class="result-title">{{ recipe()!.name }}</h1>
            <app-badge type="ai" label="AI Generated" icon="🤖" />
          </div>
          @if (recipe()!.description) {
            <p class="result-description">{{ recipe()!.description }}</p>
          }
          <h4 class="result-subtitle">Ingredients</h4>
          <ul class="result-ingredients">
            @for (ing of recipe()!.ingredients; track $index) {
              <li class="result-ingredient">
                {{ ing.measure || ing.amount + ' ' + ing.unit }} {{ ing.name }}
              </li>
            }
          </ul>
          <h4 class="result-subtitle">Instructions</h4>
          <p class="result-instructions">{{ recipe()!.instructions }}</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-page {
      padding-top: var(--space-4);
      padding-bottom: var(--space-20);
    }
    .back-link {
      display: inline-block;
      color: var(--color-primary);
      text-decoration: none;
      margin-bottom: var(--space-6);
      font-size: var(--font-size-body-small);
    }
    .recipe-card {
      padding: var(--space-6);
    }
    .result-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3);
    }
    .result-title {
      font-family: var(--font-family-heading);
      font-size: var(--font-size-h2);
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
      border-bottom: 1px solid var(--color-border);
    }
    .result-instructions {
      color: var(--color-text-secondary);
      line-height: var(--line-height-loose);
      white-space: pre-line;
    }
  `]
})
export class AiRecipeDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  readonly aiStore = inject(AiStore);

  readonly recipe = this.aiStore.currentRecipe;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.aiStore.loadRecipe(id);
    }
  }
}
