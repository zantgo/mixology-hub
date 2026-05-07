import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideRouter([])],
    });
    store = TestBed.inject(AuthStore);
  });

  afterEach(() => {
    store.clearState();
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should start unauthenticated', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
    expect(store.isAdmin()).toBe(false);
  });

  it('should have getAccessToken return null initially', () => {
    expect(store.getAccessToken()).toBeNull();
  });

  it('should clear state when called', () => {
    store.clearState();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
  });

  it('should have readable loading and error signals', () => {
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });
});
