import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderStore } from './order.store';

export interface CocktailIngredient {
  id?: string;
  ingredient: { id: string; name: string; baseUnit?: string };
  measure?: string;
  amount: string;
  unit: string;
}

export interface Cocktail {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  isPublic: boolean;
  source: 'local' | 'external';
  externalId?: string;
  imageFull?: string;
  imageThumb?: string;
  ingredients: CocktailIngredient[];
  createdAt: string;
  author?: { id: string; displayName?: string };
  rating?: number;
  ratingCount?: number;
  makeability?: 'makeable' | 'almost' | 'unmakeable';
  missingIngredients?: string[];
}

export interface PaginationMeta {
  currentPage: number;
  nextPage: number | null;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class CocktailStore {
  private http = inject(HttpClient);
  readonly orderStore = inject(OrderStore);
  private apiUrl = `${environment.apiUrl}/cocktails`;

  readonly cocktails = signal<Cocktail[]>([]);
  readonly makeable = signal<Cocktail[]>([]);
  readonly almostMakeable = signal<Cocktail[]>([]);
  readonly currentCocktail = signal<Cocktail | null>(null);
  readonly pagination = signal<PaginationMeta>({
    currentPage: 1,
    nextPage: null,
    itemsPerPage: 10,
    totalItems: 0,
    totalPages: 0,
  });
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal<string>('');

  readonly hasMore = computed(() => this.pagination().nextPage !== null);

  search(query: string, page: number = 1, limit: number = 10): void {
    this.loading.set(true);
    this.searchQuery.set(query);
    const params: any = { page, limit };
    if (query) params.name = query;

    this.http.get<{ data: Cocktail[]; meta: PaginationMeta }>(this.apiUrl, { params }).subscribe({
      next: (res) => {
        if (page === 1) {
          this.cocktails.set(res.data);
        } else {
          this.cocktails.update((arr) => [...arr, ...res.data]);
        }
        this.pagination.set(res.meta);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  loadMore(): void {
    const next = this.pagination().nextPage;
    if (next) {
      this.search(this.searchQuery(), next);
    }
  }

  loadMakeable(page: number = 1, limit: number = 10): void {
    this.loading.set(true);
    this.http
      .get<{
        data: Cocktail[];
        meta: PaginationMeta;
      }>(`${environment.apiUrl}/bar-inventory/makeable`, { params: { page, limit } })
      .subscribe({
        next: (res) => {
          const all = res.data || [];
          this.makeable.set(all.filter((c) => c.makeability === 'makeable'));
          this.almostMakeable.set(all.filter((c) => c.makeability === 'almost'));
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  loadCocktail(id: string): void {
    this.loading.set(true);
    this.http.get<Cocktail>(`${this.apiUrl}/${id}`).subscribe({
      next: (cocktail) => {
        this.currentCocktail.set(cocktail);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  getCocktail(id: string): Observable<Cocktail> {
    return this.http.get<Cocktail>(`${this.apiUrl}/${id}`).pipe(
      tap((cocktail) => {
        this.currentCocktail.set(cocktail);
      }),
    );
  }

  prepareCocktail(cocktailId: string, servings: number = 1, force: boolean = false): void {
    this.orderStore
      .submitOrder(cocktailId, servings, force)
      .then((res) => {
        this.orderStore.startPolling(res.preparationLogId);
      })
      .catch((err) => {
        this.error.set(err.message || 'Failed to queue preparation');
      });
  }

  getPreparationStatus(logId: string): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.apiUrl}/preparations/${logId}/status`);
  }
}
