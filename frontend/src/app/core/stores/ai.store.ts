import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AiRecipe {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  ingredients: { name: string; amount: number; unit: string; measure?: string }[];
  theme?: string;
  difficulty?: string;
  language?: string;
  createdAt: string;
  isSaved?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AiStore {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/ai`;

  readonly pendingRecipe = signal<AiRecipe | null>(null);
  readonly history = signal<AiRecipe[]>([]);
  readonly currentRecipe = signal<AiRecipe | null>(null);
  readonly generating = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly hasPending = signal<boolean>(false);

  generate(ingredients: string[], theme?: string, difficulty?: string, servingSize?: number): void {
    this.generating.set(true);
    this.error.set(null);
    this.hasPending.set(true);

    this.http.post<AiRecipe>(this.apiUrl, { ingredients, theme, difficulty, servingSize }).subscribe({
      next: (recipe) => {
        this.pendingRecipe.set(recipe);
        this.hasPending.set(false);
        this.generating.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'AI generation failed');
        this.generating.set(false);
        this.hasPending.set(false);
      }
    });
  }

  saveAsCocktail(id: string, name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/save-as-cocktail`, { name }).pipe(
      tap(() => {
        const recipe = this.pendingRecipe();
        if (recipe?.id === id) {
          this.pendingRecipe.set(null);
        }
        this.loadHistory();
      }),
      catchError(err => {
        this.error.set(err.error?.message || 'Failed to save recipe');
        return throwError(() => err);
      })
    );
  }

  loadHistory(page: number = 1, limit: number = 10): void {
    this.http.get<{ data: AiRecipe[]; meta: any }>(this.apiUrl, { params: { page, limit } }).subscribe({
      next: (res) => {
        this.history.set(res.data || []);
      },
      error: () => {}
    });
  }

  loadRecipe(id: string): void {
    this.http.get<AiRecipe>(`${this.apiUrl}/${id}`).subscribe({
      next: (recipe) => this.currentRecipe.set(recipe),
      error: (err) => this.error.set(err.message)
    });
  }

  deleteRecipe(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.loadHistory()),
      catchError(err => {
        this.error.set(err.error?.message || 'Failed to delete recipe');
        return throwError(() => err);
      })
    );
  }
}
