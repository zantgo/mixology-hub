# Frontend UI Tests

> **PENDING B2B MIGRATION:** The `InventoryStore.prepareDrink` synchronous pattern (lines 30-45) models the old B2C optimistic UI with immediate signal update. Update to B2B async flow: enqueue → 202 Accepted → poll `/cocktails/preparations/:logId/status` → update signal on completion.

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
  it('should poll inventory signal on preparation and update on completion', () => {
    const inventoryStore = TestBed.inject(InventoryStore);
    const Decimal = require('decimal.js');
    
    // Set initial signal state (using decimal.js)
    inventoryStore.inventory.set([{ id: 'vodka', quantity: new Decimal('500') }]);
    
    // Trigger preparation action (using decimal.js)
    inventoryStore.prepareDrink('vodka', new Decimal('50'));
    
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
});
```

**Example TDD for Responsive Layout (UC 7.9):**
```typescript
describe('CocktailGridComponent - Responsive Layout', () => {
  it('should show 3 columns on desktop', () => {
    const breakpointObserver = TestBed.inject(BreakpointObserver);
    spyOn(breakpointObserver, 'isMatched').withArgs('(min-width: 1024px)').and.returnValue(true);
    
    const component = TestBed.createComponent(CocktailGridComponent).componentInstance;
    
    expect(component.columns).toBe(3);
  });

  it('should show 1 column on mobile', () => {
    const breakpointObserver = TestBed.inject(BreakpointObserver);
    spyOn(breakpointObserver, 'isMatched').withArgs('(min-width: 1024px)').and.returnValue(false);
    
    const component = TestBed.createComponent(CocktailGridComponent).componentInstance;
    
    expect(component.columns).toBe(1);
  });
});
```

**Example TDD for Loading States (UC 7.10):**
```typescript
describe('CocktailListComponent - Loading States', () => {
  it('should show skeleton loader while loading', () => {
    const component = TestBed.createComponent(CocktailListComponent);
    component.componentInstance.isLoading = true;
    component.detectChanges();
    
    const skeleton = component.nativeElement.querySelector('[data-testid="skeleton-loader"]');
    expect(skeleton).toBeTruthy();
  });

  it('should hide skeleton loader when data loads', () => {
    const component = TestBed.createComponent(CocktailListComponent);
    component.componentInstance.isLoading = false;
    component.componentInstance.cocktails = [{ id: '1', name: 'Mojito' }];
    component.detectChanges();
    
    const skeleton = component.nativeElement.querySelector('[data-testid="skeleton-loader"]');
    expect(skeleton).toBeFalsy();
    
    const cocktailItems = component.nativeElement.querySelectorAll('[data-testid="cocktail-item"]');
    expect(cocktailItems.length).toBe(1);
  });
});
```

**Example TDD for Empty States (UC 7.11):**
```typescript
describe('CocktailListComponent - Empty States', () => {
  it('should show empty state when no cocktails found', () => {
    const component = TestBed.createComponent(CocktailListComponent);
    component.componentInstance.isLoading = false;
    component.componentInstance.cocktails = [];
    component.detectChanges();
    
    const emptyState = component.nativeElement.querySelector('[data-testid="empty-state"]');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('No cocktails found');
  });

  it('should hide empty state when cocktails exist', () => {
    const component = TestBed.createComponent(CocktailListComponent);
    component.componentInstance.isLoading = false;
    component.componentInstance.cocktails = [{ id: '1', name: 'Mojito' }];
    component.detectChanges();
    
    const emptyState = component.nativeElement.querySelector('[data-testid="empty-state"]');
    expect(emptyState).toBeFalsy();
  });
});
```

**Example TDD for Form Validation (UC 7.12):**
```typescript
describe('CocktailFormComponent - Form Validation', () => {
  it('should show validation error for empty name', () => {
    const component = TestBed.createComponent(CocktailFormComponent);
    const form = component.componentInstance.cocktailForm;
    
    // Set empty name
    form.controls.name.setValue('');
    form.controls.name.markAsTouched();
    component.detectChanges();
    
    const error = component.nativeElement.querySelector('[data-testid="name-error"]');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('Name is required');
  });

  it('should show validation error for negative servings', () => {
    const component = TestBed.createComponent(CocktailFormComponent);
    const form = component.componentInstance.cocktailForm;
    
    // Set negative servings
    form.controls.servings.setValue(-1);
    form.controls.servings.markAsTouched();
    component.detectChanges();
    
    const error = component.nativeElement.querySelector('[data-testid="servings-error"]');
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('Servings must be at least 1');
  });
});
```

**Example TDD for Toast Notifications (UC 7.13):**
```typescript
describe('ToastService', () => {
  it('should show success toast', () => {
    const toastService = TestBed.inject(ToastService);
    const overlayContainer = TestBed.inject(OverlayContainer);
    
    toastService.showSuccess('Cocktail saved successfully!');
    
    const toast = overlayContainer.getContainerElement().querySelector('.toast-success');
    expect(toast).toBeTruthy();
    expect(toast?.textContent).toContain('Cocktail saved successfully!');
  });

  it('should auto-dismiss toast after 5 seconds', fakeAsync(() => {
    const toastService = TestBed.inject(ToastService);
    const overlayContainer = TestBed.inject(OverlayContainer);
    
    toastService.showInfo('Info message');
    tick(5000);
    
    const toast = overlayContainer.getContainerElement().querySelector('.toast-info');
    expect(toast).toBeFalsy(); // Should be dismissed
  }));
});
```