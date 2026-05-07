import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { InventoryStore } from './inventory.store';

describe('InventoryStore', () => {
  let store: InventoryStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    store = TestBed.inject(InventoryStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should start with empty items', () => {
    expect(store.items()).toEqual([]);
    expect(store.total()).toBe(0);
    expect(store.loading()).toBe(false);
  });

  it('should have categories computed signal', () => {
    const cats = store.categories();
    expect(cats).toEqual([]);
  });

  it('should expose error signal', () => {
    expect(store.error()).toBeNull();
  });
});
