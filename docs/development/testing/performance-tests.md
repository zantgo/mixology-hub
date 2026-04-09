# Performance Tests

*Note: Performance testing examples would include:*

**Example structure for query optimization tests:**
```typescript
describe('MakeableCocktailsService - Performance', () => {
  it('should complete makeable query in under 100ms with 100+ ingredients', async () => {
    const makeableService = new MakeableCocktailsService();
    
    // Mock large inventory
    const largeInventory = Array(150).fill(null).map((_, i) => ({
      ingredientId: `ingredient-${i}`,
      quantity: 1000
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
    await cocktailService.searchUnified('a', { limit: 50 });
    expect(queryLogger.getQueryCount()).toBeLessThanOrEqual(3); 
  });
});

**Example TDD for Cursor Pagination Math:**
```typescript
describe('Cursor Pagination - Composite Cursor Logic', () => {
  it('should correctly parse the composite cursor and apply strict < and = filters', () => {
    // Test the SQL QueryBuilder generated by the cursor:
    // WHERE created_at < :cursor_time OR (created_at = :cursor_time AND id < :cursor_id)
    
    const cursor = '2024-01-15T10:30:00Z_abc123';
    const [cursorTime, cursorId] = cursor.split('_');
    
    const queryBuilder = cocktailRepository
      .createQueryBuilder('cocktail')
      .where('cocktail.created_at < :cursorTime', { cursorTime })
      .orWhere('(cocktail.created_at = :cursorTime AND cocktail.id < :cursorId)', { 
        cursorTime, 
        cursorId 
      })
      .orderBy('cocktail.created_at', 'DESC')
      .addOrderBy('cocktail.id', 'DESC')
      .limit(20);
    
    const sql = queryBuilder.getSql();
    
    // Verify the SQL contains correct WHERE clause structure
    expect(sql).toContain('cocktail.created_at < :cursorTime');
    expect(sql).toContain('cocktail.created_at = :cursorTime AND cocktail.id < :cursorId');
    expect(sql).toContain('ORDER BY cocktail.created_at DESC, cocktail.id DESC');
    expect(sql).toContain('LIMIT 20');
  });

  it('should handle null cursor (first page) correctly', () => {
    const queryBuilder = cocktailRepository
      .createQueryBuilder('cocktail')
      .orderBy('cocktail.created_at', 'DESC')
      .addOrderBy('cocktail.id', 'DESC')
      .limit(20);
    
    const sql = queryBuilder.getSql();
    
    // First page should have no WHERE clause for cursor
    expect(sql).not.toContain('cocktail.created_at <');
    expect(sql).toContain('ORDER BY cocktail.created_at DESC, cocktail.id DESC');
    expect(sql).toContain('LIMIT 20');
  });

  it('should generate next cursor from last item in page', () => {
    const lastItem = {
      created_at: new Date('2024-01-15T10:30:00Z'),
      id: 'abc123'
    };
    
    const nextCursor = `${lastItem.created_at.toISOString()}_${lastItem.id}`;
    
    expect(nextCursor).toBe('2024-01-15T10:30:00.000Z_abc123');
  });

  it('should prevent duplicate items across pages with same timestamp', () => {
    // Create test data with same timestamp but different IDs
    const items = [
      { created_at: '2024-01-15T10:30:00Z', id: 'item3' },
      { created_at: '2024-01-15T10:30:00Z', id: 'item2' },
      { created_at: '2024-01-15T10:30:00Z', id: 'item1' },
      { created_at: '2024-01-15T10:29:59Z', id: 'item0' }
    ];
    
    // Simulate pagination with cursor on item2
    const cursor = '2024-01-15T10:30:00Z_item2';
    const [cursorTime, cursorId] = cursor.split('_');
    
    // Should return items created_at < cursorTime OR (created_at = cursorTime AND id < cursorId)
    // This should include item1 and item0, but NOT item2 or item3
    const expectedItems = [
      { created_at: '2024-01-15T10:30:00Z', id: 'item1' },
      { created_at: '2024-01-15T10:29:59Z', id: 'item0' }
    ];
    
    // Implementation would filter items accordingly
    const filtered = items.filter(item => 
      item.created_at < cursorTime || 
      (item.created_at === cursorTime && item.id < cursorId)
    );
    
    expect(filtered).toEqual(expectedItems);
  });
});
```
```