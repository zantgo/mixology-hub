import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Ai {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/ai`;

  generateRecipe(ingredients: string[]): Observable<any> {
    return this.http.post<any>(this.apiUrl, { ingredients });
  }

  getHistory(page: number = 1, limit: number = 10): Observable<{ data: any[]; meta: any }> {
    return this.http.get<{ data: any[]; meta: any }>(`${this.apiUrl}?page=${page}&limit=${limit}`);
  }

  getRecipe(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  saveAsCocktail(id: string, name: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/save-as-cocktail`, { name });
  }

  deleteRecipe(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
