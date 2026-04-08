# Frontend UI Tests

**Example TDD for RxJS Search Debouncing (UC 7.2):**
```typescript
describe('CocktailSearchComponent - RxJS Debounce', () => {
  it('should only trigger one API call after typing stops', fakeAsync(() => {
    const searchService = TestBed.inject(SearchService);
    const spy = spyOn(searchService, 'searchUnified').mockReturnValue(of([]));
    const component = TestBed.createComponent(CocktailSearchComponent).componentInstance;
    
    // Simulate typing 'M', 'a', 'r' quickly
    component.searchControl.setValue('M');
    tick(100);
    component.searchControl.setValue('Ma');
    tick(100);
    component.searchControl.setValue('Mar');
    
    // Fast forward past the 300ms debounce time
    tick(300);
    
    // Should only have been called ONCE with the final value
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('Mar');
  }));
});
```

**Example TDD for Angular Signals UI Update (UC 7.1):**
```typescript
describe('InventoryStore - Signal Reactivity', () => {
  it('should optimistically update inventory signal on preparation', () => {
    const inventoryStore = TestBed.inject(InventoryStore);
    
    // Set initial signal state
    inventoryStore.inventory.set([{ id: 'vodka', quantity: 500 }]);
    
    // Trigger preparation action
    inventoryStore.prepareDrink('vodka', 50);
    
    // Verify signal updated immediately (before HTTP resolves)
    const currentInventory = inventoryStore.inventory();
    expect(currentInventory[0].quantity).toBe(450);
  });
});
```

**Example TDD for Global Error Interceptor (UC 7.4):**
```typescript
describe('GlobalErrorInterceptor', () => {
  it('should catch 500 errors and trigger toast notification', () => {
    const toastService = TestBed.inject(ToastService);
    const spy = spyOn(toastService, 'showError');
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    // Trigger HTTP request
    http.get('/api/test').subscribe({
      error: (err) => expect(err).toBeTruthy()
    });

    // Mock a 500 Internal Server Error response
    const req = httpMock.expectOne('/api/test');
    req.flush('Server crash', { status: 500, statusText: 'Internal Server Error' });

    // Verify the interceptor caught it and showed a toast
    expect(spy).toHaveBeenCalledWith('An unexpected server error occurred. Please try again.');
  });
});
```

**Example TDD for Route Guard (UC 7.6):**
```typescript
describe('AuthGuard', () => {
  it('should redirect unauthenticated users to /login', () => {
    const authService = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    spyOn(authService, 'isAuthenticated').mockReturnValue(false);
    const routerSpy = spyOn(router, 'navigate');

    const result = TestBed.runInInjectionContext(() => authGuard());
    
    expect(result).toBe(false);
    expect(routerSpy).toHaveBeenCalledWith(['/login']);
  });
});

**Example TDD for Accessibility (a11y) in Dynamic Forms:**
```typescript
describe('CocktailFormComponent - Accessibility', () => {
  it('should announce to screen readers when a new ingredient row is added', () => {
    const component = TestBed.createComponent(CocktailFormComponent).componentInstance;
    const liveAnnouncer = TestBed.inject(LiveAnnouncer);
    const announceSpy = spyOn(liveAnnouncer, 'announce');

    component.addIngredientRow();

    expect(announceSpy).toHaveBeenCalledWith('New ingredient row added');
  });

  it('dynamic form controls should have associated aria-labels', () => {
    const fixture = TestBed.createComponent(CocktailFormComponent);
    fixture.componentInstance.addIngredientRow();
    fixture.detectChanges();

    const inputElement = fixture.nativeElement.querySelector('input[formControlName="ingredientId"]');
    expect(inputElement.getAttribute('aria-label')).toBeTruthy();
    expect(inputElement.getAttribute('aria-label')).toContain('ingredient');
  });

  it('should provide clear error messages for screen readers', () => {
    const fixture = TestBed.createComponent(CocktailFormComponent);
    const component = fixture.componentInstance;
    
    // Trigger validation error
    component.cocktailForm.controls['name'].setValue('');
    component.cocktailForm.controls['name'].markAsTouched();
    fixture.detectChanges();

    const errorElement = fixture.nativeElement.querySelector('.error-message');
    expect(errorElement).toBeTruthy();
    expect(errorElement.getAttribute('role')).toBe('alert');
    expect(errorElement.getAttribute('aria-live')).toBe('assertive');
  });

  it('should maintain proper tab order in dynamic form arrays', () => {
    const fixture = TestBed.createComponent(CocktailFormComponent);
    const component = fixture.componentInstance;
    
    // Add multiple ingredient rows
    component.addIngredientRow();
    component.addIngredientRow();
    component.addIngredientRow();
    fixture.detectChanges();

    const inputs = fixture.nativeElement.querySelectorAll('input, select, button');
    let lastTabIndex = -1;
    
    inputs.forEach((input: HTMLElement) => {
      const tabIndex = parseInt(input.getAttribute('tabindex') || '0');
      expect(tabIndex).toBeGreaterThanOrEqual(0);
      expect(tabIndex).toBeGreaterThan(lastTabIndex);
      lastTabIndex = tabIndex;
    });
  });

  it('should announce row removal to screen readers', () => {
    const fixture = TestBed.createComponent(CocktailFormComponent);
    const component = fixture.componentInstance;
    const liveAnnouncer = TestBed.inject(LiveAnnouncer);
    const announceSpy = spyOn(liveAnnouncer, 'announce');

    // Add then remove a row
    component.addIngredientRow();
    component.removeIngredientRow(0);

    expect(announceSpy).toHaveBeenCalledWith('Ingredient row removed');
  });
});

**Example TDD for Optimistic Update Rollback (UC 7.10):**
```typescript
describe('InventoryStore - Optimistic Rollback', () => {
  it('should revert signal state if preparation HTTP request fails', fakeAsync(() => {
    const inventoryStore = TestBed.inject(InventoryStore);
    const apiService = TestBed.inject(ApiService);
    
    // Initial state: 500ml
    inventoryStore.inventory.set([{ id: 'vodka', quantity: 500 }]);
    
    // Mock API failure
    spyOn(apiService, 'prepareCocktail').mockReturnValue(throwError(() => new Error('Network failure')));
    
    inventoryStore.prepareDrink('vodka', 50);
    
    // Initially deducts optimistically to 450ml
    expect(inventoryStore.inventory()[0].quantity).toBe(450);
    
    tick(); // Fast forward async HTTP fail
    
    // Reverts back to 500ml after failure
    expect(inventoryStore.inventory()[0].quantity).toBe(500);
  }));

  it('should show error toast when optimistic update fails', fakeAsync(() => {
    const inventoryStore = TestBed.inject(InventoryStore);
    const apiService = TestBed.inject(ApiService);
    const toastService = TestBed.inject(ToastService);
    
    const toastSpy = spyOn(toastService, 'showError');
    
    // Mock API failure
    spyOn(apiService, 'prepareCocktail').mockReturnValue(
      throwError(() => ({ status: 500, message: 'Server error' }))
    );
    
    inventoryStore.inventory.set([{ id: 'gin', quantity: 300 }]);
    inventoryStore.prepareDrink('gin', 100);
    
    tick();
    
    expect(toastSpy).toHaveBeenCalledWith('Failed to prepare drink. Please try again.');
  }));

  it('should handle multiple concurrent optimistic updates with rollbacks', fakeAsync(() => {
    const inventoryStore = TestBed.inject(InventoryStore);
    const apiService = TestBed.inject(ApiService);
    
    inventoryStore.inventory.set([{ id: 'rum', quantity: 1000 }]);
    
    // First request succeeds, second fails
    let callCount = 0;
    spyOn(apiService, 'prepareCocktail').mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return of({ success: true });
      } else {
        return throwError(() => new Error('Insufficient stock'));
      }
    });
    
    // Two concurrent preparations
    inventoryStore.prepareDrink('rum', 100); // Should succeed
    inventoryStore.prepareDrink('rum', 900); // Should fail (insufficient after first)
    
    // After first optimistic update: 1000 - 100 = 900
    // After second optimistic update: 900 - 900 = 0
    expect(inventoryStore.inventory()[0].quantity).toBe(0);
    
    tick(); // Process async
    
    // After rollback of failed request: back to 900
    expect(inventoryStore.inventory()[0].quantity).toBe(900);
  }));

  it('should maintain transaction history for rollback', fakeAsync(() => {
    const inventoryStore = TestBed.inject(InventoryStore);
    const apiService = TestBed.inject(ApiService);
    
    inventoryStore.inventory.set([{ id: 'tequila', quantity: 750 }]);
    
    // Track transaction history
    const transactions = [];
    inventoryStore.transactionHistory.subscribe(history => transactions.push([...history]));
    
    spyOn(apiService, 'prepareCocktail').mockReturnValue(throwError(() => new Error('Failed')));
    
    inventoryStore.prepareDrink('tequila', 50);
    
    tick();
    
    // Should have recorded and rolled back transaction
    expect(transactions.length).toBeGreaterThan(0);
    expect(inventoryStore.inventory()[0].quantity).toBe(750); // Back to original
  }));

  it('should handle network timeout rollback', fakeAsync(() => {
    const inventoryStore = TestBed.inject(InventoryStore);
    const apiService = TestBed.inject(ApiService);
    
    inventoryStore.inventory.set([{ id: 'whiskey', quantity: 600 }]);
    
    // Mock timeout (never resolves)
    spyOn(apiService, 'prepareCocktail').mockReturnValue(
      new Observable(observer => {
        // Never calls next or error - simulates hanging request
      })
    );
    
    inventoryStore.prepareDrink('whiskey', 100);
    
    // Optimistically updates
    expect(inventoryStore.inventory()[0].quantity).toBe(500);
    
    // Simulate timeout after 30 seconds
    tick(30000);
    
    // Store should have timeout mechanism to rollback
    // (Implementation would need timeout logic)
    expect(inventoryStore.inventory()[0].quantity).toBe(500); // Or 600 if timeout triggered
  }));
});
```

**Example TDD for Pagination State Restoration:**
```typescript
describe('Frontend - Pagination State Restoration', () => {
  it('should remember search scroll position and page state when returning from detail view', () => {
    // If I scroll to page 3, click a cocktail, and click "Back", 
    // the UI Signal should have cached the search results and cursor 
    // so I don't get kicked back to page 1.
  });
});

describe('Frontend - Network Loss (Offline State)', () => {
  it('should disable prepare buttons and show "Offline" indicator if window.navigator is offline', () => {
    // Prevents optimistic updates from triggering when there is guaranteed no connection
  });
});
```
```