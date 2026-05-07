import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PaginationMeta } from '../models/cocktail.model';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  getUsers(page: number = 1, limit: number = 10) {
    return this.http.get<{ data: any[]; meta: PaginationMeta }>(
      `${this.apiUrl}?page=${page}&limit=${limit}`,
    );
  }

  createUser(user: any) {
    return this.http.post<any>(this.apiUrl, user);
  }

  deleteUser(id: string) {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
