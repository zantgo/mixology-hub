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

  // Get cocktails
  getCocktails(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Get ingredients (necessary to create a cocktail)
  getIngredients(): Observable<any[]> {
    return this.http.get<any[]>(this.ingredientsUrl);
  }

  // Create a new cocktail
  createCocktail(cocktail: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, cocktail);
  }
}
