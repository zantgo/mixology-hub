import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  getUsers() {
    return this.http.get<any[]>(this.apiUrl);
  }

  createUser(user: any) {
    return this.http.post<any>(this.apiUrl, user);
  }

  deleteUser(id: string) {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
