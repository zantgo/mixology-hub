import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { InventoryStore, InventoryItem } from './inventory.store';
import { environment } from '../../../environments/environment';

describe('InventoryStore', () => {
  let store: InventoryStore;
  let httpMock: HttpTestingController;

  const mockItem: InventoryItem = {
    id: 'inv-123',
    ingredientId: 'ing-456',
    name: 'Vodka',
    quantity: 500,
    unit: 'ml',
    category: 'Spirits',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [InventoryStore],
    });

    store = TestBed.inject(InventoryStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should load inventory items and compute categories', () => {
    store.load();

    const req = httpMock.expectOne(`${environment.apiUrl}/bar-inventory`);
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [mockItem],
      total: 1,
      page: 1,
      limit: 10,
    });

    expect(store.items()).toHaveLength(1);
    expect(store.items()[0].name).toBe('Vodka');
    expect(store.categories()).toEqual([
      { name: 'Spirits', items: [expect.objectContaining({ name: 'Vodka' })] },
    ]);
  });

  it('should update quantity and reload inventory', () => {
    store.updateQuantity('inv-123', 600, 'ml').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/bar-inventory/inv-123`);
    expect(req.request.method).toBe('PUT');
    req.flush({});

    // Verify reloading
    const reloadReq = httpMock.expectOne(`${environment.apiUrl}/bar-inventory`);
    expect(reloadReq.request.method).toBe('GET');
  });
});
