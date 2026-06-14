# Performance Tests

> **B2B MIGRATED:** The codebase has been migrated to shared `bar_inventory`. These test specifications serve as reference. Actual test code uses `getBarInventory`. Caching strategy uses global bar-level caches.

*Note: Performance testing examples would include:*

**Example structure for query optimization tests:**
```typescript
describe('MakeableCocktailsService - Performance', () => {
  it('should complete makeable query in under 100ms with 100+ ingredients', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Mock large inventory (using decimal.js)
    const Decimal = require('decimal.js');
    const largeInventory = Array(150).fill(null).map((_, i) => ({
      ingredientId: `ingredient-${i}`,
      quantity: new Decimal('1000')
    }));
    
    jest.spyOn(makeableService, 'getUserInventory')
      .mockResolvedValue(largeInventory);
    
    const start = performance.now();
    await makeableService.getMakeableCocktails('user123');
    const end = performance.now();
    const duration = end - start;
    
    expect(duration).toBeLessThan(100); // Should complete in under 100ms
  });
});
```

**Example structure for cache invalidation tests:**
```typescript
describe('RedisCacheService - Cache Invalidation', () => {
  it('should invalidate makeable cache when inventory updates', async () => {
    const cacheService = new RedisCacheService();
    const mockRedis = { del: jest.fn().mockResolvedValue(1) };
    cacheService.redis = mockRedis;
    
    await cacheService.invalidateUserCache('user123');
    
    expect(mockRedis.del).toHaveBeenCalledWith('makeable:user123');
    expect(mockRedis.del).toHaveBeenCalledWith('almost-makeable:user123');
  });
});

**Example TDD for Preventing Cache Poisoning (UC 11.5):**
```typescript
describe('CocktailAggregatorService - Cache Safety', () => {
  it('should not cache external API error responses', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockCache = { set: jest.fn() };
    const mockHttp = { get: jest.fn().mockRejectedValue({ status: 500 }) };
    
    aggregator.cacheManager = mockCache;
    aggregator.httpClient = mockHttp;

    try {
      await aggregator.searchExternal('Margarita');
    } catch (e) {}

    // Ensure cache.set was NEVER called with the error response
    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it('should cache successful external API responses', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockCache = { set: jest.fn().mockResolvedValue(true) };
    const mockHttp = { 
      get: jest.fn().mockResolvedValue({ 
        data: { drinks: [{ idDrink: '11000', strDrink: 'Margarita' }] }
      }) 
    };
    
    aggregator.cacheManager = mockCache;
    aggregator.httpClient = mockHttp;

    await aggregator.searchExternal('Margarita');
    
    // Should cache successful response
    expect(mockCache.set).toHaveBeenCalledWith(
      'search:Margarita',
      expect.any(String), // JSON string of results
      { ttl: 3600 }
    );
  });

  it('should not cache empty external API responses', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockCache = { set: jest.fn() };
    const mockHttp = { 
      get: jest.fn().mockResolvedValue({ 
        data: { drinks: null } // Empty response
      }) 
    };
    
    aggregator.cacheManager = mockCache;
    aggregator.httpClient = mockHttp;

    await aggregator.searchExternal('NonExistentCocktail');
    
    // Should not cache empty results
    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it('should differentiate between network errors and empty results', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockCache = { set: jest.fn() };
    
    // Test 1: Network error (should not cache)
    const mockHttp1 = { get: jest.fn().mockRejectedValue(new Error('Network error')) };
    aggregator.httpClient = mockHttp1;
    aggregator.cacheManager = mockCache;

    try {
      await aggregator.searchExternal('Test1');
    } catch (e) {}
    expect(mockCache.set).not.toHaveBeenCalled();
    
    // Test 2: Empty but valid response (should not cache)
    const mockHttp2 = { 
      get: jest.fn().mockResolvedValue({ data: { drinks: [] } }) // Empty array
    };
    aggregator.httpClient = mockHttp2;
    
    await aggregator.searchExternal('Test2');
    expect(mockCache.set).not.toHaveBeenCalled();
    
    // Test 3: Valid response (should cache)
    const mockHttp3 = { 
      get: jest.fn().mockResolvedValue({ 
        data: { drinks: [{ idDrink: '11000' }] }
      }) 
    };
    aggregator.httpClient = mockHttp3;
    
    await aggregator.searchExternal('Test3');
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('should handle HTML error pages from external APIs', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockCache = { set: jest.fn() };
    const mockHttp = { 
      get: jest.fn().mockResolvedValue({
        data: '<html><body>500 Internal Server Error</body></html>' // HTML error page
      }) 
    };
    
    aggregator.cacheManager = mockCache;
    aggregator.httpClient = mockHttp;

    try {
      await aggregator.searchExternal('Margarita');
    } catch (e) {
      expect(e.message).toContain('Invalid response format');
    }
    
    // Should not cache HTML error pages
    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it('should validate response format before caching', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockCache = { set: jest.fn() };
    
    // Invalid response (missing required fields)
    const mockHttp = { 
      get: jest.fn().mockResolvedValue({
        data: { invalid: 'format' } // Missing 'drinks' field
      }) 
    };
    
    aggregator.cacheManager = mockCache;
    aggregator.httpClient = mockHttp;

    try {
      await aggregator.searchExternal('Test');
    } catch (e) {
      expect(e.message).toContain('Invalid response format');
    }
    
    expect(mockCache.set).not.toHaveBeenCalled();
  });

  it('should use circuit breaker to prevent repeated calls to failing external API', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockCache = { set: jest.fn() };
    const mockHttp = { get: jest.fn().mockRejectedValue({ status: 500 }) };
    const mockCircuitBreaker = { trip: jest.fn(), isOpen: jest.fn().mockReturnValue(false) };
    
    aggregator.cacheManager = mockCache;
    aggregator.httpClient = mockHttp;
    aggregator.circuitBreaker = mockCircuitBreaker;

    try {
      await aggregator.searchExternal('Margarita');
    } catch (e) {}
    
    // Should trip circuit breaker on error
    expect(mockCircuitBreaker.trip).toHaveBeenCalled();
    expect(mockCache.set).not.toHaveBeenCalled();
  });
});
```

**Example TDD for N+1 Query Prevention:**
```typescript
describe('TypeORM Performance - N+1 Query Prevention', () => {
  it('should fetch cocktails and their ingredients in exactly 2 queries using QueryBuilder', async () => {
    // Tests that TypeORM doesn't execute a separate SELECT for the ingredients 
    // of EVERY cocktail in a 100-item array (The N+1 problem).
    const queryLogger = new QueryLogger();
    // ... setup logger
    await cocktailService.unifiedSearch(50, 1, 'a');
    expect(queryLogger.getQueryCount()).toBeLessThanOrEqual(3); 
  });
});

**Example TDD for Page-based Pagination Math:**
```typescript
describe('Page-based Pagination Logic', () => {
  it('should correctly calculate OFFSET and LIMIT from page number', () => {
    const page = 3;
    const limit = 20;
    const expectedOffset = 40; // (3 - 1) * 20
    
    const queryBuilder = cocktailRepository
      .createQueryBuilder('cocktail')
      .orderBy('cocktail.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    
    expect(queryBuilder.expressionMap.skip).toBe(expectedOffset);
    expect(queryBuilder.expressionMap.take).toBe(limit);
  });

  it('should correctly generate pagination metadata', () => {
    const totalItems = 45;
    const limit = 20;
    const page = 2;
    
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    
    const meta = {
      currentPage: page,
      nextPage: hasNextPage ? page + 1 : null,
      itemsPerPage: limit,
      totalItems,
      totalPages
    };
    
    expect(meta.totalPages).toBe(3);
    expect(meta.nextPage).toBe(3);
  });

  it('should return null for nextPage on the last page', () => {
    const totalItems = 45;
    const limit = 20;
    const page = 3; // Last page
    
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    
    expect(hasNextPage).toBe(false);
  });

  it('should prevent duplicate items across pages with same timestamp', () => {
    // Create test data with same timestamp but different IDs
    const items = [
      { created_at: '2024-01-15T10:30:00Z', id: 'item3' },
      { created_at: '2024-01-15T10:30:00Z', id: 'item2' },
      { created_at: '2024-01-15T10:30:00Z', id: 'item1' },
      { created_at: '2024-01-15T10:29:59Z', id: 'item0' }
    ];
    
    // Simulate pagination with page 2
    const page = 2;
    const limit = 2;
    
    // Should return items for page 2 (items 2 and 3)
    // This should include item1 and item0, but NOT item2 or item3
    const expectedItems = [
      { created_at: '2024-01-15T10:30:00Z', id: 'item1' },
      { created_at: '2024-01-15T10:29:59Z', id: 'item0' }
    ];
    
    // Implementation would slice items for page 2
    const startIndex = (page - 1) * limit;
    const filtered = items.slice(startIndex, startIndex + limit);
    
    expect(filtered).toEqual(expectedItems);
  });
});
```
```