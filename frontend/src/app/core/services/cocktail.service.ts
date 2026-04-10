import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Cocktail } from '../models/cocktail.model';

@Injectable({
  providedIn: 'root'
})
export class CocktailService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/cocktails`;
  private ingredientsUrl = `${environment.apiUrl}/ingredients`;

  // Get cocktails
  getCocktails(): Observable<{ data: Cocktail[]; total: number; limit: number; offset: number }> {
    return this.http.get<{ data: Cocktail[]; total: number; limit: number; offset: number }>(this.apiUrl);
  }

  // Get ingredients (necessary to create a cocktail)
  getIngredients(): Observable<any[]> {
    return this.http.get<any[]>(this.ingredientsUrl);
  }

  // Create a new cocktail (legacy - without file upload)
  createCocktail(cocktail: Omit<Cocktail, 'id' | 'createdAt' | 'isPublic' | 'source'> & { imageUrl?: string }): Observable<Cocktail> {
    return this.http.post<Cocktail>(this.apiUrl, cocktail);
  }

  // Create a new cocktail with image upload
  createCocktailWithImage(cocktailData: Omit<Cocktail, 'id' | 'createdAt' | 'isPublic' | 'source' | 'imageUrl' | 'imageFull' | 'imageThumb'>, imageFile?: File): Observable<Cocktail> {
    const formData = new FormData();
    formData.append('data', JSON.stringify(cocktailData));
    
    if (imageFile) {
      formData.append('image', imageFile);
    }

    return this.http.post<Cocktail>(this.apiUrl, formData);
  }

  // Update cocktail (legacy - without file upload)
  updateCocktail(id: string, cocktail: Partial<Cocktail> & { imageUrl?: string }): Observable<Cocktail> {
    return this.http.patch<Cocktail>(`${this.apiUrl}/${id}`, cocktail);
  }

  // Update cocktail with image upload
  updateCocktailWithImage(id: string, cocktailData: Partial<Omit<Cocktail, 'id' | 'createdAt' | 'isPublic' | 'source' | 'imageUrl' | 'imageFull' | 'imageThumb'>>, imageFile?: File): Observable<Cocktail> {
    const formData = new FormData();
    formData.append('data', JSON.stringify(cocktailData));
    
    if (imageFile) {
      formData.append('image', imageFile);
    }

    return this.http.patch<Cocktail>(`${this.apiUrl}/${id}`, formData);
  }

  // Get cocktail by ID
  getCocktail(id: string): Observable<Cocktail> {
    return this.http.get<Cocktail>(`${this.apiUrl}/${id}`);
  }

  // Update cocktail
  updateCocktail(id: string, cocktail: Partial<Cocktail> & { imageUrl?: string }): Observable<Cocktail> {
    return this.http.put<Cocktail>(`${this.apiUrl}/${id}`, cocktail);
  }

  // Delete cocktail
  deleteCocktail(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
