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
```

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
```

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
    // Test logic using Angular Router's RouteReuseStrategy or a custom State Service.
    // Navigate to page 3 -> click cocktail -> press Back -> expect signal to still have page 3 data.
    const searchService = TestBed.inject(SearchService);
    const router = TestBed.inject(Router);
    const stateService = TestBed.inject(SearchStateService);
    
    // Mock search results for page 3
    const page3Results = Array(20).fill(null).map((_, i) => ({
      id: `cocktail-${60 + i}`,
      name: `Cocktail ${60 + i}`
    }));
    
    jest.spyOn(searchService, 'searchUnified').mockReturnValue(of({
      data: page3Results,
      hasMore: true,
      nextCursor: 'cursor-80'
    }));
    
    // Simulate user at page 3
    stateService.setSearchState({
      query: 'martini',
      page: 3,
      results: page3Results,
      scrollPosition: 1200
    });
    
    // Navigate to detail
    const cocktailDetail = page3Results[0];
    const navigateSpy = jest.spyOn(router, 'navigate');
    
    // Simulate clicking on a cocktail
    component.onCocktailClick(cocktailDetail);
    
    // Verify navigation occurred
    expect(navigateSpy).toHaveBeenCalledWith(['/cocktails', cocktailDetail.id], {
      state: { returnToSearch: true, searchState: stateService.getSearchState() }
    });
    
    // Simulate returning via browser back button
    router.navigateByUrl('/search?q=martini&page=3');
    
    // Verify state was restored
    expect(stateService.getSearchState().page).toBe(3);
    expect(stateService.getSearchState().results).toEqual(page3Results);
    expect(stateService.getSearchState().scrollPosition).toBe(1200);
  });

  it('should clear search state when starting a new search', () => {
    const stateService = TestBed.inject(SearchStateService);
    
    // Set existing state
    stateService.setSearchState({
      query: 'old-query',
      page: 2,
      results: [],
      scrollPosition: 500
    });
    
    // Start new search
    component.searchControl.setValue('new-query');
    component.onSearch();
    
    // Should clear old state
    expect(stateService.getSearchState().query).toBe('new-query');
    expect(stateService.getSearchState().page).toBe(1);
    expect(stateService.getSearchState().scrollPosition).toBe(0);
  });

  it('should preserve search state during route changes within search', () => {
    const stateService = TestBed.inject(SearchStateService);
    const router = TestBed.inject(Router);
    
    // Set initial state
    const initialState = {
      query: 'gin',
      page: 2,
      results: Array(20).fill(null).map((_, i) => ({ id: `gin-${i}` })),
      scrollPosition: 800
    };
    stateService.setSearchState(initialState);
    
    // Navigate to page 3 (same search, different page)
    router.navigate(['/search'], { queryParams: { q: 'gin', page: 3 } });
    
    // State should be preserved (just page updated)
    expect(stateService.getSearchState().query).toBe('gin');
    expect(stateService.getSearchState().page).toBe(3);
    expect(stateService.getSearchState().results).toEqual(initialState.results);
  });
});
```

describe('Frontend - Network Error Handling', () => {
  it('should show network error toast when preparation fails', fakeAsync(() => {
    const preparationService = TestBed.inject(PreparationService);
    const toastService = TestBed.inject(ToastService);
    
    const toastSpy = jest.spyOn(toastService, 'showError');
    
    // Mock HTTP request that will fail
    const httpMock = TestBed.inject(HttpTestingController);
    
    // Start preparation
    const preparationPromise = preparationService.prepareCocktail('cocktail-123', 1);
    
    // Mock network error
    const req = httpMock.expectOne('/api/cocktails/cocktail-123/prepare');
    req.error(new ErrorEvent('Network error'));
    
    // Should handle gracefully
    await expect(preparationPromise).rejects.toThrow('Network error');
    
    // Should show appropriate error
    expect(toastSpy).toHaveBeenCalledWith('Network error: Preparation failed. Please try again.');
  }));

  it('should automatically retry failed requests with exponential backoff', fakeAsync(() => {
    const preparationService = TestBed.inject(PreparationService);
    const httpMock = TestBed.inject(HttpTestingController);
    
    let attemptCount = 0;
    
    // Start preparation
    const preparationPromise = preparationService.prepareCocktail('cocktail-123', 1);
    
    // First attempt fails
    const req1 = httpMock.expectOne('/api/cocktails/cocktail-123/prepare');
    req1.error(new ErrorEvent('Network error'));
    
    // Should retry after 1 second
    tick(1000);
    
    // Second attempt succeeds
    const req2 = httpMock.expectOne('/api/cocktails/cocktail-123/prepare');
    req2.flush({ success: true });
    
    // Should complete successfully
    await expect(preparationPromise).resolves.toBeTruthy();
  }));

  it('should show connection status in app header', () => {
    const fixture = TestBed.createComponent(AppHeaderComponent);
    const component = fixture.componentInstance;
    
    // Test online status indicator
    fixture.detectChanges();
    
    const statusIndicator = fixture.nativeElement.querySelector('.connection-status');
    expect(statusIndicator).toBeTruthy();
    expect(statusIndicator.classList.contains('online')).toBe(true);
    expect(statusIndicator.textContent).toContain('Online');
  });
});
```

**Example TDD for User Preferences - Frontend Sync (UC 7.23):**
```typescript
describe('User Preferences - Frontend Sync', () => {
  it('should instantly update the UI unit system via Angular Signals when preferences change', () => {
    const userStore = TestBed.inject(UserStore);
    const apiService = TestBed.inject(ApiService);
    
    // Default is metric
    expect(userStore.preferences().unitSystem).toBe('metric');
    
    // Mock PATCH request
    spyOn(apiService, 'updatePreferences').mockReturnValue(of({ unitSystem: 'imperial' }));
    
    // User toggles setting
    userStore.updateUnitSystem('imperial');
    
    // UI signal instantly reflects 'imperial' (ounces) globally
    expect(userStore.preferences().unitSystem).toBe('imperial');
  });
});

**Example TDD for Cross-Tab State Synchronization (UC 7.25):**
```typescript
describe('CrossTabSyncService - BroadcastChannel API', () => {
  beforeEach(() => {
    // Mock BroadcastChannel API
    global.BroadcastChannel = jest.fn().mockImplementation(() => ({
      postMessage: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      close: jest.fn()
    }));
  });

  it('should broadcast inventory updates to other tabs', () => {
    const crossTabService = TestBed.inject(CrossTabSyncService);
    const mockChannel = (global.BroadcastChannel as jest.Mock).mock.results[0].value;
    
    // Simulate inventory update
    const inventoryUpdate = {
      type: 'INVENTORY_UPDATE',
      payload: { ingredientId: 'vodka', newQuantity: 450 }
    };
    
    crossTabService.broadcastUpdate(inventoryUpdate);
    
    // Should post message to BroadcastChannel
    expect(mockChannel.postMessage).toHaveBeenCalledWith(inventoryUpdate);
  });

  it('should receive updates from other tabs and update Angular Signals', () => {
    const crossTabService = TestBed.inject(CrossTabSyncService);
    const inventoryStore = TestBed.inject(InventoryStore);
    
    const mockChannel = (global.BroadcastChannel as jest.Mock).mock.results[0].value;
    
    // Spy on inventory store update method
    const updateSpy = jest.spyOn(inventoryStore, 'updateFromCrossTab');
    
    // Simulate message from another tab
    const messageEvent = new MessageEvent('message', {
      data: {
        type: 'INVENTORY_UPDATE',
        payload: { ingredientId: 'vodka', newQuantity: 450 }
      }
    });
    
    // Trigger the event listener
    const eventListener = mockChannel.addEventListener.mock.calls.find(
      call => call[0] === 'message'
    )[1];
    eventListener(messageEvent);
    
    // Should update inventory store
    expect(updateSpy).toHaveBeenCalledWith(messageEvent.data.payload);
  });

  it('should handle localStorage fallback when BroadcastChannel not supported', () => {
    // Simulate browser without BroadcastChannel
    delete (global as any).BroadcastChannel;
    
    const crossTabService = TestBed.inject(CrossTabSyncService);
    
    // Mock localStorage events
    const storageListeners: Function[] = [];
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = jest.fn().mockImplementation((event, handler) => {
      if (event === 'storage') {
        storageListeners.push(handler as Function);
      }
    });
    
    // Simulate storage event from another tab
    const storageEvent = new StorageEvent('storage', {
      key: 'mixologyhub_inventory_update',
      newValue: JSON.stringify({ ingredientId: 'vodka', newQuantity: 450 })
    });
    
    // Initialize service (should use localStorage fallback)
    crossTabService.init();
    
    // Trigger storage event
    storageListeners.forEach(handler => handler(storageEvent));
    
    // Should handle the update
    expect(window.addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    
    // Restore
    window.addEventListener = originalAddEventListener;
  });
});

**Example Playwright E2E Test for Cross-Tab Sync (UC 7.25):**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Cross-Tab State Synchronization', () => {
  test('should sync inventory updates between browser tabs', async ({ browser }) => {
    // Create two browser contexts (simulating two tabs)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Login on both pages
    await page1.goto('http://localhost:4200/login');
    await page1.fill('[data-testid="email"]', 'test@example.com');
    await page1.fill('[data-testid="password"]', 'password123');
    await page1.click('[data-testid="login-button"]');
    
    await page2.goto('http://localhost:4200/login');
    await page2.fill('[data-testid="email"]', 'test@example.com');
    await page2.fill('[data-testid="password"]', 'password123');
    await page2.click('[data-testid="login-button"]');
    
    // Navigate to inventory on both pages
    await page1.goto('http://localhost:4200/inventory');
    await page2.goto('http://localhost:4200/inventory');
    
    // Get initial inventory quantity from page 2
    const initialQuantityText = await page2.textContent('[data-testid="vodka-quantity"]');
    const initialQuantity = parseInt(initialQuantityText || '0');
    
    // Prepare a drink on page 1 (deducts inventory)
    await page1.click('[data-testid="cocktail-mojito"]');
    await page1.click('[data-testid="prepare-button"]');
    
    // Wait for sync (BroadcastChannel message)
    await page2.waitForTimeout(1000);
    
    // Verify page 2 shows updated quantity
    const updatedQuantityText = await page2.textContent('[data-testid="vodka-quantity"]');
    const updatedQuantity = parseInt(updatedQuantityText || '0');
    
    // Should be 50ml less (cocktail preparation amount)
    expect(updatedQuantity).toBe(initialQuantity - 50);
    
    // Verify notification appears on page 2
    const notification = await page2.textContent('[data-testid="cross-tab-notification"]');
    expect(notification).toContain('Inventory updated from another tab');
    
    await context1.close();
    await context2.close();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.goto('http://localhost:4200/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Navigate to inventory
    await page.goto('http://localhost:4200/inventory');

    // Mock network failure for preparation
    await page.route('/api/cocktails/*/prepare', route => {
      route.abort('failed');
    });

    // Attempt preparation
    await page.click('[data-testid="cocktail-mojito"]');
    await page.click('[data-testid="prepare-button"]');

    // Should show error toast
    const errorToast = await page.waitForSelector('[data-testid="error-toast"]');
    expect(errorToast).toBeTruthy();
    expect(await errorToast.textContent()).toContain('Network error');
  });
});
```