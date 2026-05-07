import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { FavoriteStore } from './favorite.store';

describe('FavoriteStore', () => {
  let store: FavoriteStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    store = TestBed.inject(FavoriteStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should start empty', () => {
    expect(store.items()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('should return false for non-favorited cocktail', () => {
    expect(store.isFavorite('nonexistent')).toBe(false);
  });

  it('should expose error signal', () => {
    expect(store.error()).toBeNull();
  });
});
