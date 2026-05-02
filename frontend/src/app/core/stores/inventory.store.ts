import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InventoryItem {
  id: string;
  ingredientId?: string;
  ingredient?: { id: string; name: string; baseUnit?: string };
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  lowStock?: boolean;
}

export interface InventoryResponse {
  data: InventoryItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/bar-inventory`;

  readonly items = signal<InventoryItem[]>([]);
  readonly total = signal<number>(0);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

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
    this.http.get<InventoryResponse>(this.apiUrl).subscribe({
      next: (res) => {
        this.items.set(
          (res.data || []).map((item) => ({
            ...item,
            ingredientId: item.ingredient?.id || item.ingredientId,
            name: item.ingredient?.name || item.name,
            unit: item.ingredient?.baseUnit || item.unit,
          })),
        );
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  add(item: { ingredientId: string; quantity: number; unit: string }): Observable<any> {
    return this.http.post(this.apiUrl, item).pipe(
      tap(() => this.load()),
      catchError((err) => {
        this.error.set(err.error?.message || 'Failed to add ingredient');
        return throwError(() => err);
      }),
    );
  }

  remove(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.load()),
      catchError((err) => {
        this.error.set(err.error?.message || 'Failed to remove ingredient');
        return throwError(() => err);
      }),
    );
  }

  updateQuantity(id: string, quantity: number, unit: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, { quantity, unit }).pipe(
      tap(() => this.load()),
      catchError((err) => {
        this.error.set(err.error?.message || 'Failed to update quantity');
        return throwError(() => err);
      }),
    );
  }
}
