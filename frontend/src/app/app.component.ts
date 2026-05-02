import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { UserService } from './core/services/user.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div style="padding: 40px; font-family: system-ui, sans-serif; max-width: 800px; margin: auto;">
      <h1 style="color: #333;">MixologyHub - User Manager</h1>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3>Create a new User</h3>
        <button
          (click)="createRandomUser()"
          style="padding: 10px 15px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
          Auto-Generate Random User
        </button>
      </div>

      <h2>Registered Users ({{ users().length }})</h2>

      @if (users().length > 0) {
        @for (user of users(); track user.id) {
          <div
            style="background: white; border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center;">

            <div>
              <strong style="font-size: 1.1em; color: #007bff;">{{ user.email }}</strong><br>
              <small style="color: gray;">ID: {{ user.id }}</small><br>
              <small style="color: gray;">Created: {{ user.created_at | date:'short' }}</small>
            </div>

            <button
              (click)="deleteUser(user.id)"
              style="padding: 8px 12px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">
              Delete
            </button>
          </div>
        }
      } @else {
        <p style="color: #666; font-style: italic;">No users found in the database. Generate one!</p>
      }
    </div>
  `
})
export class AppComponent implements OnInit {
  private userService = inject(UserService);

  // Angular Signals to manage reactive state
  users = signal<any[]>([]);

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.userService.getUsers().subscribe({
      next: (response) => this.users.set(response.data),
      error: (err) => console.error('Error fetching users', err)
    });
  }

  createRandomUser() {
    const randomEmail = `user_${Math.floor(Math.random() * 1000)}@test.com`;
    const newUser = {
      email: randomEmail,
      password_hash: 'hashed_password_123'
    };

    this.userService.createUser(newUser).subscribe({
      next: () => this.loadUsers(),
      error: (err) => console.error('Error creating user', err)
    });
  }

  deleteUser(id: string) {
    this.userService.deleteUser(id).subscribe({
      next: () => this.loadUsers(),
      error: (err) => console.error('Error deleting user', err)
    });
  }
}
