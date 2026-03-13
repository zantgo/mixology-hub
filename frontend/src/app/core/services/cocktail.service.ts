import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CocktailService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/cocktails`;
  private ingredientsUrl = `${environment.apiUrl}/ingredients`;

  // Obtener cócteles
  getCocktails(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Obtener ingredientes (necesario para poder crear un cóctel)
  getIngredients(): Observable<any[]> {
    return this.http.get<any[]>(this.ingredientsUrl);
  }

  // Crear un cóctel nuevo
  createCocktail(cocktail: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, cocktail);
  }
}
