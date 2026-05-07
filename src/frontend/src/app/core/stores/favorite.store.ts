import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Favorite {
  id: string;
  cocktailId?: string;
  externalCocktailId?: string;
  cocktail?: {
    id: string;
    name: string;
    imageThumb?: string;
    imageFull?: string;
  };
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class FavoriteStore {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/favorites`;

  readonly items = signal<Favorite[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  load(page: number = 1, limit: number = 10): void {
    this.loading.set(true);
    this.http
      .get<{ data: Favorite[]; meta: any }>(this.apiUrl, { params: { page, limit } })
      .subscribe({
        next: (res) => {
          this.items.set(res.data || []);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  toggle(cocktailId: string): void {
    const existing = this.items().find((f) => f.cocktailId === cocktailId);
    if (existing) {
      this.remove(existing.id);
    } else {
      this.add(cocktailId);
    }
  }

  isFavorite(cocktailId: string): boolean {
    return this.items().some((f) => f.cocktailId === cocktailId);
  }

  private add(cocktailId: string): void {
    const optimistic: Favorite = {
      id: 'temp-' + Date.now(),
      cocktailId,
      createdAt: new Date().toISOString(),
    };
    this.items.update((arr) => [optimistic, ...arr]);

    this.http.post<Favorite>(this.apiUrl, { cocktailId }).subscribe({
      next: (favorite) => {
        this.items.update((arr) => arr.map((f) => (f.id === optimistic.id ? favorite : f)));
      },
      error: () => {
        this.items.update((arr) => arr.filter((f) => f.id !== optimistic.id));
        this.error.set('Failed to update favorite');
      },
    });
  }

  remove(id: string): void {
    const snapshot = [...this.items()];
    this.items.update((arr) => arr.filter((f) => f.id !== id));

    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      error: () => {
        this.items.set(snapshot);
        this.error.set('Failed to remove favorite');
      },
    });
  }
}
