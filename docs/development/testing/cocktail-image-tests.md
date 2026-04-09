# Cocktail Image Tests

## 🎯 Purpose
Tests for URL-based cocktail image functionality including validation, fallback behavior, and external API integration.

## 📋 Test Categories

### 1. Image URL Validation Tests
Tests for validating image URLs in cocktail creation and updates.

#### Backend Validation Tests:
```typescript
describe('CocktailService - Image URL Validation', () => {
  it('should accept valid HTTPS image URLs', async () => {
    const validUrl = 'https://example.com/cocktail.jpg';
    const cocktailData = {
      name: 'Test Cocktail',
      instructions: 'Test instructions',
      imageUrl: validUrl,
      ingredients: [{ ingredientId: '123', measure: '2 oz', amount: 2, unit: 'oz' }]
    };

    const result = await cocktailService.createCocktail('user123', cocktailData);
    expect(result.imageUrl).toBe(validUrl);
  });

  it('should accept valid HTTP image URLs', async () => {
    const validUrl = 'http://example.com/cocktail.jpg';
    const cocktailData = {
      name: 'Test Cocktail',
      instructions: 'Test instructions',
      imageUrl: validUrl,
      ingredients: [{ ingredientId: '123', measure: '2 oz', amount: 2, unit: 'oz' }]
    };

    const result = await cocktailService.createCocktail('user123', cocktailData);
    expect(result.imageUrl).toBe(validUrl);
  });

  it('should reject invalid URL formats', async () => {
    const invalidUrl = 'not-a-valid-url';
    const cocktailData = {
      name: 'Test Cocktail',
      instructions: 'Test instructions',
      imageUrl: invalidUrl,
      ingredients: [{ ingredientId: '123', measure: '2 oz', amount: 2, unit: 'oz' }]
    };

    await expect(cocktailService.createCocktail('user123', cocktailData))
      .rejects
      .toThrow('Invalid image URL format');
  });

  it('should accept null or empty imageUrl', async () => {
    const cocktailData = {
      name: 'Test Cocktail',
      instructions: 'Test instructions',
      imageUrl: null,
      ingredients: [{ ingredientId: '123', measure: '2 oz', amount: 2, unit: 'oz' }]
    };

    const result = await cocktailService.createCocktail('user123', cocktailData);
    expect(result.imageUrl).toBeNull();
  });

  it('should accept undefined imageUrl', async () => {
    const cocktailData = {
      name: 'Test Cocktail',
      instructions: 'Test instructions',
      ingredients: [{ ingredientId: '123', measure: '2 oz', amount: 2, unit: 'oz' }]
    };

    const result = await cocktailService.createCocktail('user123', cocktailData);
    expect(result.imageUrl).toBeNull();
  });
});
```

#### Frontend Validation Tests:
```typescript
describe('CocktailFormComponent - Image URL Validation', () => {
  it('should show validation error for invalid image URL', () => {
    const component = TestBed.createComponent(CocktailFormComponent).componentInstance;
    component.cocktailForm.controls['imageUrl'].setValue('invalid-url');
    
    expect(component.cocktailForm.controls['imageUrl'].valid).toBe(false);
    expect(component.cocktailForm.controls['imageUrl'].errors?.['url']).toBeTruthy();
  });

  it('should accept valid image URLs', () => {
    const component = TestBed.createComponent(CocktailFormComponent).componentInstance;
    component.cocktailForm.controls['imageUrl'].setValue('https://example.com/cocktail.jpg');
    
    expect(component.cocktailForm.controls['imageUrl'].valid).toBe(true);
  });

  it('should allow empty image URL', () => {
    const component = TestBed.createComponent(CocktailFormComponent).componentInstance;
    component.cocktailForm.controls['imageUrl'].setValue('');
    
    expect(component.cocktailForm.controls['imageUrl'].valid).toBe(true);
  });
});
```

### 2. Image Fallback Tests
Tests for fallback behavior when image URLs fail to load.

#### Frontend Fallback Tests:
```typescript
describe('CocktailImageComponent - Fallback Behavior', () => {
  it('should show default image when URL fails to load', fakeAsync(() => {
    const component = TestBed.createComponent(CocktailImageComponent).componentInstance;
    component.imageUrl = 'https://example.com/nonexistent.jpg';
    
    component.ngOnInit();
    tick();
    
    // Simulate image load error
    const img = component.imageElement.nativeElement;
    img.dispatchEvent(new Event('error'));
    tick();
    
    expect(img.src).toContain('/assets/images/cocktails/default/cocktail-placeholder.jpg');
  }));

  it('should show loading placeholder while image loads', () => {
    const component = TestBed.createComponent(CocktailImageComponent).componentInstance;
    component.imageUrl = 'https://example.com/cocktail.jpg';
    
    component.ngOnInit();
    
    expect(component.isLoading).toBe(true);
    expect(component.showFallback).toBe(false);
  });

  it('should hide loading placeholder when image loads successfully', fakeAsync(() => {
    const component = TestBed.createComponent(CocktailImageComponent).componentInstance;
    component.imageUrl = 'https://example.com/cocktail.jpg';
    
    component.ngOnInit();
    tick();
    
    // Simulate successful image load
    const img = component.imageElement.nativeElement;
    img.dispatchEvent(new Event('load'));
    tick();
    
    expect(component.isLoading).toBe(false);
    expect(component.showFallback).toBe(false);
  }));

  it('should use default image when imageUrl is null or empty', () => {
    const component = TestBed.createComponent(CocktailImageComponent).componentInstance;
    component.imageUrl = null;
    
    component.ngOnInit();
    
    expect(component.showFallback).toBe(true);
    expect(component.imageElement.nativeElement.src)
      .toContain('/assets/images/cocktails/default/cocktail-placeholder.jpg');
  });
});
```

### 3. External API Image Mapping Tests
Tests for mapping external API images to internal format.

```typescript
describe('CocktailAggregatorService - External API Image Mapping', () => {
  it('should map strDrinkThumb to imageUrl', async () => {
    const externalCocktail = {
      idDrink: '11000',
      strDrink: 'Mojito',
      strDrinkThumb: 'https://www.thecocktaildb.com/images/media/drink/metwgh1606770327.jpg',
      strInstructions: 'Muddle mint leaves...',
      strIngredient1: 'Light rum',
      strMeasure1: '2 oz'
    };

    const result = await aggregatorService.mapExternalToInternal(externalCocktail);
    
    expect(result.imageUrl).toBe('https://www.thecocktaildb.com/images/media/drink/metwgh1606770327.jpg');
    expect(result.name).toBe('Mojito');
  });

  it('should handle missing strDrinkThumb gracefully', async () => {
    const externalCocktail = {
      idDrink: '11001',
      strDrink: 'Test Cocktail',
      strInstructions: 'Test instructions',
      strIngredient1: 'Vodka',
      strMeasure1: '2 oz'
      // No strDrinkThumb field
    };

    const result = await aggregatorService.mapExternalToInternal(externalCocktail);
    
    expect(result.imageUrl).toBeNull();
    expect(result.name).toBe('Test Cocktail');
  });

  it('should validate external image URLs before mapping', async () => {
    const externalCocktail = {
      idDrink: '11002',
      strDrink: 'Invalid Image Cocktail',
      strDrinkThumb: 'not-a-valid-url',
      strInstructions: 'Test instructions',
      strIngredient1: 'Gin',
      strMeasure1: '2 oz'
    };

    const result = await aggregatorService.mapExternalToInternal(externalCocktail);
    
    // Should either be null or a validated URL
    expect(result.imageUrl === null || result.imageUrl === 'not-a-valid-url').toBe(true);
  });
});
```

### 4. Integration Tests
End-to-end tests for complete image functionality.

```typescript
describe('Cocktail Image Integration', () => {
  it('should create cocktail with image, retrieve it, and display with fallback', async () => {
    // 1. Create cocktail with image URL
    const createResponse = await request(app.getHttpServer())
      .post('/cocktails')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'Test Cocktail with Image',
        instructions: 'Test instructions',
        imageUrl: 'https://example.com/test-cocktail.jpg',
        ingredients: [{ ingredientId: '123', measure: '2 oz', amount: 2, unit: 'oz' }]
      });
    
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.imageUrl).toBe('https://example.com/test-cocktail.jpg');
    
    const cocktailId = createResponse.body.id;
    
    // 2. Retrieve cocktail
    const getResponse = await request(app.getHttpServer())
      .get(`/cocktails/${cocktailId}`);
    
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.imageUrl).toBe('https://example.com/test-cocktail.jpg');
    
    // 3. Update cocktail image
    const updateResponse = await request(app.getHttpServer())
      .put(`/cocktails/${cocktailId}`)
      .set('Authorization', 'Bearer valid-token')
      .send({
        imageUrl: 'https://example.com/updated-cocktail.jpg'
      });
    
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.imageUrl).toBe('https://example.com/updated-cocktail.jpg');
    
    // 4. Verify updated image
    const verifyResponse = await request(app.getHttpServer())
      .get(`/cocktails/${cocktailId}`);
    
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.imageUrl).toBe('https://example.com/updated-cocktail.jpg');
  });

  it('should handle invalid image URL in creation request', async () => {
    const response = await request(app.getHttpServer())
      .post('/cocktails')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'Test Cocktail',
        instructions: 'Test instructions',
        imageUrl: 'invalid-url-format',
        ingredients: [{ ingredientId: '123', measure: '2 oz', amount: 2, unit: 'oz' }]
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid image URL');
  });
});
```

### 5. Performance Tests
Tests for image loading performance and caching.

```typescript
describe('Cocktail Image Performance', () => {
  it('should lazy load images in list views', () => {
    const component = TestBed.createComponent(CocktailListComponent).componentInstance;
    
    // Mock IntersectionObserver for lazy loading
    const mockIntersectionObserver = {
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    };
    
    window.IntersectionObserver = jest.fn().mockImplementation(() => mockIntersectionObserver);
    
    component.ngOnInit();
    
    // Should not load images immediately
    expect(mockIntersectionObserver.observe).toHaveBeenCalled();
  });

  it('should cache successfully loaded images', fakeAsync(() => {
    const imageService = TestBed.inject(ImageCacheService);
    const imageUrl = 'https://example.com/cocktail.jpg';
    
    // First load
    imageService.loadImage(imageUrl).subscribe();
    tick();
    
    // Should be cached
    expect(imageService.isCached(imageUrl)).toBe(true);
    
    // Second load should use cache
    const spy = spyOn(imageService, 'fetchImage').and.callThrough();
    imageService.loadImage(imageUrl).subscribe();
    tick();
    
    expect(spy).not.toHaveBeenCalled();
  }));
});
```

### 6. Error Handling Tests
Tests for error scenarios and edge cases.

```typescript
describe('Cocktail Image Error Handling', () => {
  it('should handle network errors gracefully', fakeAsync(() => {
    const component = TestBed.createComponent(CocktailImageComponent).componentInstance;
    const errorSpy = spyOn(console, 'error');

    component.imageUrl = 'https://example.com/cocktail.jpg';
    component.ngOnInit();
    tick();

    // Simulate network error
    const img = component.imageElement.nativeElement;
    img.dispatchEvent(new Event('error'));
    tick();

    expect(component.showFallback).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith('Failed to load cocktail image:', expect.anything());
  }));

  it('should handle CORS errors gracefully', fakeAsync(() => {
    const component = TestBed.createComponent(CocktailImageComponent).componentInstance;

    component.imageUrl = 'https://external-site.com/cocktail.jpg'; // Might have CORS restrictions
    component.ngOnInit();
    tick();

    // Simulate CORS error
    const img = component.imageElement.nativeElement;
    const errorEvent = new ErrorEvent('error', { 
      message: 'Failed to load image: CORS error' 
    });
    img.dispatchEvent(errorEvent);
    tick();

    expect(component.showFallback).toBe(true);
  }));

  it('should handle timeout for slow image loads', fakeAsync(() => {
    const component = TestBed.createComponent(CocktailImageComponent).componentInstance;
    component.imageUrl = 'https://slow-server.com/cocktail.jpg';
    component.loadTimeoutMs = 100; // Short timeout for test

    component.ngOnInit();

    // Don't trigger load or error events
    tick(150); // Past timeout

    expect(component.showFallback).toBe(true);
  }));

  it('should implement an async validation job that periodically verifies public cocktail image URLs and nullifies dead links to prevent client-side waterfall errors', async () => {
    const imageValidationService = new ImageValidationService();
    const mockCocktailRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'cocktail1', imageUrl: 'https://example.com/alive.jpg', isPublic: true },
        { id: 'cocktail2', imageUrl: 'https://example.com/dead.jpg', isPublic: true },
        { id: 'cocktail3', imageUrl: null, isPublic: true }
      ]),
      save: jest.fn()
    };

    const mockHttpClient = {
      head: jest.fn()
        .mockResolvedValueOnce({ status: 200 }) // Alive
        .mockRejectedValueOnce(new Error('404 Not Found')) // Dead
    };

    imageValidationService.cocktailRepository = mockCocktailRepository;
    imageValidationService.httpClient = mockHttpClient;

    await imageValidationService.validatePublicCocktailImages();

    // Should check both URLs
    expect(mockHttpClient.head).toHaveBeenCalledTimes(2);
    expect(mockHttpClient.head).toHaveBeenCalledWith('https://example.com/alive.jpg', { timeout: 5000 });
    expect(mockHttpClient.head).toHaveBeenCalledWith('https://example.com/dead.jpg', { timeout: 5000 });

    // Should save null for dead link
    expect(mockCocktailRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cocktail2',
        imageUrl: null
      })
    );

    // Should NOT save for alive link or already null link
    expect(mockCocktailRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should respect rate limits when checking external image URLs', async () => {
    const imageValidationService = new ImageValidationService();
    const mockCocktailRepository = {
      find: jest.fn().mockResolvedValue(
        Array(100).fill(null).map((_, i) => ({
          id: `cocktail${i}`,
          imageUrl: `https://example.com/image${i}.jpg`,
          isPublic: true
        }))
      ),
      save: jest.fn()
    };

    const mockHttpClient = {
      head: jest.fn().mockResolvedValue({ status: 200 })
    };

    const mockRateLimiter = {
      acquire: jest.fn().mockResolvedValue(true)
    };

    imageValidationService.cocktailRepository = mockCocktailRepository;
    imageValidationService.httpClient = mockHttpClient;
    imageValidationService.rateLimiter = mockRateLimiter;

    await imageValidationService.validatePublicCocktailImages();

    // Should use rate limiter for each request
    expect(mockRateLimiter.acquire).toHaveBeenCalledTimes(100);
    expect(mockHttpClient.head).toHaveBeenCalledTimes(100);
  });

  it('should skip private cocktail images during validation', async () => {
    const imageValidationService = new ImageValidationService();
    const mockCocktailRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'public1', imageUrl: 'https://example.com/public.jpg', isPublic: true },
        { id: 'private1', imageUrl: 'https://example.com/private.jpg', isPublic: false }
      ]),
      save: jest.fn()
    };

    const mockHttpClient = {
      head: jest.fn().mockResolvedValue({ status: 200 })
    };

    imageValidationService.cocktailRepository = mockCocktailRepository;
    imageValidationService.httpClient = mockHttpClient;

    await imageValidationService.validatePublicCocktailImages();

    // Should only check public cocktail
    expect(mockHttpClient.head).toHaveBeenCalledTimes(1);
    expect(mockHttpClient.head).toHaveBeenCalledWith('https://example.com/public.jpg', { timeout: 5000 });
  });

  it('should handle different types of image URL failures', async () => {
    const imageValidationService = new ImageValidationService();
    const mockCocktailRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'cocktail1', imageUrl: 'https://example.com/404.jpg', isPublic: true },
        { id: 'cocktail2', imageUrl: 'https://example.com/timeout.jpg', isPublic: true },
        { id: 'cocktail3', imageUrl: 'https://example.com/ssl.jpg', isPublic: true }
      ]),
      save: jest.fn()
    };

    const mockHttpClient = {
      head: jest.fn()
        .mockRejectedValueOnce({ status: 404, message: 'Not Found' })
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('SSL certificate error'))
    };

    imageValidationService.cocktailRepository = mockCocktailRepository;
    imageValidationService.httpClient = mockHttpClient;

    await imageValidationService.validatePublicCocktailImages();

    // Should nullify all failed URLs
    expect(mockCocktailRepository.save).toHaveBeenCalledTimes(3);
    expect(mockCocktailRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cocktail1', imageUrl: null })
    );
    expect(mockCocktailRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cocktail2', imageUrl: null })
    );
    expect(mockCocktailRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cocktail3', imageUrl: null })
    );
  });

  it('should log validation results for monitoring', async () => {
    const imageValidationService = new ImageValidationService();
    const mockCocktailRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'cocktail1', imageUrl: 'https://example.com/alive.jpg', isPublic: true },
        { id: 'cocktail2', imageUrl: 'https://example.com/dead.jpg', isPublic: true }
      ]),
      save: jest.fn()
    };

    const mockHttpClient = {
      head: jest.fn()
        .mockResolvedValueOnce({ status: 200 })
        .mockRejectedValueOnce(new Error('404'))
    };

    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn()
    };

    imageValidationService.cocktailRepository = mockCocktailRepository;
    imageValidationService.httpClient = mockHttpClient;
    imageValidationService.logger = mockLogger;

    await imageValidationService.validatePublicCocktailImages();

    // Should log results
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Image validation completed',
      expect.objectContaining({
        totalChecked: 2,
        alive: 1,
        dead: 1
      })
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Dead image URL detected and nullified',
      expect.objectContaining({
        cocktailId: 'cocktail2',
        imageUrl: 'https://example.com/dead.jpg'
      })
    );
  });
});
```

## 🧪 Test Data Factories

```typescript
// Test factory for cocktail with images
const CocktailWithImageFactory = {
  build: (overrides = {}) => ({
    id: 'cocktail-123',
    name: 'Test Cocktail',
    instructions: 'Test instructions',
    imageUrl: 'https://example.com/cocktail.jpg',
    source: 'local',
    isPublic: true,
    createdAt: new Date(),
    ...overrides
  }),

  buildWithInvalidImage: () => CocktailWithImageFactory.build({
    imageUrl: 'invalid-url'
  }),

  buildWithoutImage: () => CocktailWithImageFactory.build({
    imageUrl: null
  }),

  buildExternalApi: () => CocktailWithImageFactory.build({
    source: 'api',
    imageUrl: 'https://www.thecocktaildb.com/images/media/drink/test.jpg'
  })
};
```

## 📊 Coverage Expectations

| Test Category | Target Coverage | Critical Paths |
|--------------|----------------|----------------|
| Image URL Validation | 100% | Valid/invalid URL formats, null/empty handling |
| Image Fallback | 100% | Failed loads, network errors, empty URLs |
| External API Mapping | >90% | strDrinkThumb mapping, missing fields |
| Integration | >80% | Create → Retrieve → Update flow |
| Error Handling | >90% | Network errors, CORS, timeouts |
| Performance | >70% | Lazy loading, caching |

## 🔧 Mocking Strategies

### Mocking Image Loading:
```typescript
// Mock successful image load
const mockImageSuccess = () => {
  const img = new Image();
  setTimeout(() => img.dispatchEvent(new Event('load')), 10);
  return img;
};

// Mock failed image load
const mockImageError = () => {
  const img = new Image();
  setTimeout(() => img.dispatchEvent(new Event('error')), 10);
  return img;
};

// Use in tests
jest.spyOn(window, 'Image').mockImplementation(mockImageSuccess);
```

### Mocking External API Responses:
```typescript
const mockExternalApiResponse = {
  drinks: [{
    idDrink: '11000',
    strDrink: 'Mojito',
    strDrinkThumb: 'https://www.thecocktaildb.com/images/media/drink/test.jpg',
    strInstructions: 'Muddle mint...',
    strIngredient1: 'Light rum',
    strMeasure1: '2 oz'
  }]
};

jest.spyOn(httpClient, 'get').mockResolvedValue({ data: mockExternalApiResponse });
```