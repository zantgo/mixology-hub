import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { OrderStore } from './order.store';

describe('OrderStore', () => {
  let store: OrderStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    store = TestBed.inject(OrderStore);
  });

  afterEach(() => {
    store.reset();
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should start with no active order', () => {
    expect(store.currentLogId()).toBeNull();
    expect(store.status()).toBeNull();
    expect(store.polling()).toBe(false);
  });

  it('should return correct terminal state', () => {
    expect(store.isTerminal).toBe(false);
  });

  it('should reset all state', () => {
    store.reset();
    expect(store.currentLogId()).toBeNull();
    expect(store.status()).toBeNull();
    expect(store.polling()).toBe(false);
    expect(store.undoing()).toBe(false);
  });

  it('should reject undo if already in progress', async () => {
    store['undoing'].set(true);
    await expect(store.undo('log-1')).rejects.toThrow('Undo already in progress');
    store['undoing'].set(false);
  });
});
