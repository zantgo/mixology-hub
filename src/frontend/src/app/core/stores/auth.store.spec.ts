import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthStore, UserProfile } from './auth.store';
import { environment } from '../../../environments/environment';

describe('AuthStore', () => {
  let store: AuthStore;
  let httpMock: HttpTestingController;

  const mockUser: UserProfile = {
    id: 'user-123',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'admin',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthStore, { provide: Router, useValue: { navigate: vi.fn() } }],
    });

    store = TestBed.inject(AuthStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    store.clearState();
  });

  it('should authenticate user and set state on login', () => {
    store.login('test@example.com', 'Password123!').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({ user: mockUser, accessToken: 'token-abc' });

    expect(store.isAuthenticated()).toBe(true);
    expect(store.isAdmin()).toBe(true);
    expect(store.user()).toEqual(mockUser);
    expect(store.getAccessToken()).toBe('token-abc');
  });

  it('should handle login errors gracefully', () => {
    store.login('test@example.com', 'wrong').subscribe({
      error: (err) => expect(err).toBeTruthy(),
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
    expect(store.error()).toBe('Invalid credentials');
  });

  it('should clear state on logout', () => {
    store.user.set(mockUser);
    store.isAuthenticated.set(true);

    store.logout();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(req.request.method).toBe('POST');
    req.flush({});

    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });
});
