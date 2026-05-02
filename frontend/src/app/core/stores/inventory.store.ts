import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UiStore } from './ui.store';

export interface InventoryItem {
  id: string;
  ingredientId: string;
  ingredient?: { id: string; name: string; baseUnit?: string };
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  lowStock?: boolean;
}

export interface InventorySummary {
  totalItems: number;
  totalVolume: number;
  lowStockCount: number;
  categories: { name: string; count: number }[];
}

@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private http = inject(HttpClient);
  private uiStore = inject(UiStore);
  private apiUrl = `${environment.apiUrl}/user-inventory`;

  readonly items = signal<InventoryItem[]>([]);
  readonly summary = signal<InventorySummary>({ totalItems: 0, totalVolume: 0, lowStockCount: 0, categories: [] });
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly depleted = signal<boolean>(false);

  readonly categories = computed(() => {
    const cats = new Map<string, InventoryItem[]>();
    for (const item of this.items()) {
      const cat = item.category || 'Other';
      if (!cats.has(cat)) cats.set(cat, []);
      cats.get(cat)!.push(item);
    }
    return Array.from(cats.entries()).map(([name, items]) => ({ name, items }));
  });

  load(): void {
    this.loading.set(true);
    this.http.get<{ data: InventoryItem[] }>(this.apiUrl).subscribe({
      next: (res) => {
        this.items.set(res.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  loadSummary(): void {
    this.http.get<InventorySummary>(`${this.apiUrl}/summary`).subscribe({
      next: (s) => this.summary.set(s),
      error: () => {}
    });
  }

  add(item: { ingredientId: string; quantity: number; unit: string }): Observable<any> {
    return this.http.post(this.apiUrl, item).pipe(
      tap(() => {
        this.load();
        this.loadSummary();
      }),
      catchError(err => {
        this.error.set(err.error?.message || 'Failed to add ingredient');
        return throwError(() => err);
      })
    );
  }

  updateQuantity(id: string, quantity: number, unit: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, { quantity, unit }).pipe(
      tap(() => {
        this.load();
        this.loadSummary();
      }),
      catchError(err => {
        this.error.set(err.error?.message || 'Failed to update quantity');
        return throwError(() => err);
      })
    );
  }

  remove(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.load();
        this.loadSummary();
      }),
      catchError(err => {
        this.error.set(err.error?.message || 'Failed to remove ingredient');
        return throwError(() => err);
      })
    );
  }

  deplete(ingredients: { ingredientId: string; amount: number; unit: string }[]): Observable<any> {
    const snapshot = [...this.items()];
    this.depleted.set(false);
    const updated = this.items().map(item => {
      const d = ingredients.find(i => i.ingredientId === item.ingredientId);
      if (d) {
        return { ...item, quantity: Math.max(0, item.quantity - d.amount) };
      }
      return item;
    });
    this.items.set(updated);

    return this.http.post(`${this.apiUrl}/deplete`, { ingredients }).pipe(
      tap(() => {
        this.depleted.set(true);
        this.loadSummary();
      }),
      catchError(err => {
        this.items.set(snapshot);
        this.error.set(err.error?.message || 'Failed to deplete inventory');
        return throwError(() => err);
      })
    );
  }
}
