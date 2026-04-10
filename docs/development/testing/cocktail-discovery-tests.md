# Cocktail Discovery Tests

**Example TDD for Unified Pagination (UC 2.6):**
```typescript
describe('CocktailAggregatorService - Unified Pagination', () => {
  it('should correctly merge local and external results for cursor pagination', async () => {
    const aggregatorService = new CocktailAggregatorService();
    
    // Mock: 2 local results, 50 external results
    jest.spyOn(aggregatorService, 'searchLocal').mockResolvedValue({
      data: [{ id: 'local1', createdAt: '2026-04-08T10:00:00.000Z' }, { id: 'local2', createdAt: '2026-04-08T09:00:00.000Z' }],
      nextCursor: null,
      hasMore: false
    });
    
    jest.spyOn(aggregatorService, 'searchExternal').mockResolvedValue(
      Array(50).fill(null).map((_, i) => ({ id: `external${i}`, createdAt: `2026-04-08T08:${59-i}:00.000Z` }))
    );
    
    // First request: limit=10, no cursor
    const page1 = await aggregatorService.searchUnified('margarita', { limit: 10 });
    expect(page1.data).toHaveLength(10);
    expect(page1.data[0].id).toBe('local1');
    expect(page1.data[1].id).toBe('local2');
    expect(page1.data[2].id).toBe('external0'); // First 8 external results
    expect(page1.nextCursor).toBeTruthy(); // Should have a cursor for next page
    
    // Second request: use cursor from first page
    const page2 = await aggregatorService.searchUnified('margarita', { 
      limit: 10, 
      cursor: page1.nextCursor 
    });
    expect(page2.data).toHaveLength(10);
    expect(page2.data[0].id).toBe('external8'); // Continues from where page 1 left off
  });
});
```

**Example TDD for Redis Caching Logic (UC 2.3):**
```typescript
describe('CocktailAggregatorService - Redis Caching', () => {
  it('should return cached data without calling external API', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockCache = { get: jest.fn().mockResolvedValue(JSON.stringify({ drinks: [] })) };
    const mockHttp = { get: jest.fn() };
    
    aggregator.cacheManager = mockCache;
    aggregator.httpClient = mockHttp;

    await aggregator.searchExternal('Margarita');

    // Should check cache, find data, and NOT call HTTP client
    expect(mockCache.get).toHaveBeenCalledWith('search:Margarita');
    expect(mockHttp.get).not.toHaveBeenCalled();
  });

  it('should cache external API responses with TTL', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockCache = { 
      get: jest.fn().mockResolvedValue(null), // Cache miss
      set: jest.fn().mockResolvedValue(true)
    };
    const mockHttp = { 
      get: jest.fn().mockResolvedValue({ data: { drinks: [] } })
    };
    
    aggregator.cacheManager = mockCache;
    aggregator.httpClient = mockHttp;

    await aggregator.searchExternal('Margarita');

    // Should call external API, then cache the result
    expect(mockHttp.get).toHaveBeenCalled();
    expect(mockCache.set).toHaveBeenCalledWith(
      'search:Margarita',
      expect.any(String),
      { ttl: 3600 } // 1 hour TTL
    );
  });
});
```

**Example TDD for Dangling External Favorites (UC 6.5):**
```typescript
describe('FavoritesService - Dangling External Favorites', () => {
  it('should handle 404 errors from external API gracefully', async () => {
    const favoritesService = new FavoritesService();
    const aggregatorService = new CocktailAggregatorService();
    
    // Mock user has a favorite for external cocktail ID 99999
    jest.spyOn(favoritesService, 'getUserFavorites').mockResolvedValue([
      { cocktailId: null, externalCocktailId: '99999' }
    ]);
    
    // Mock external API returns 404
    jest.spyOn(aggregatorService, 'getExternalCocktailDetails')
      .mockRejectedValue({ status: 404, message: 'Not Found' });
    
    favoritesService.aggregatorService = aggregatorService;
    
    const result = await favoritesService.getHydratedFavorites('user123');
    
    // Should return the favorite with "unavailable" flag
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('externalCocktailId', '99999');
    expect(result[0]).toHaveProperty('isAvailable', false);
    expect(result[0]).toHaveProperty('error', 'Recipe Unavailable');
  });
});

**Example TDD for Local vs. External Duplicate Resolution (UC 2.14):**
```typescript
describe('CocktailAggregatorService - Deduplication', () => {
  it('should prioritize Local DB over External API for exact name matches', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const localMojito = { id: 'local-123', name: 'Mojito', source: 'local' };
    const externalMojito = { id: 'ext-11000', name: 'Mojito', source: 'api' };
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({ data: [localMojito], hasMore: false });
    jest.spyOn(aggregator, 'searchExternal').mockResolvedValue([externalMojito]);
    
    const result = await aggregator.searchUnified('Mojito', { limit: 10, page: 1 });
    
    expect(result.data).toHaveLength(1);
    expect(result.data[0].source).toBe('local');
    expect(result.data.find(d => d.id === 'ext-11000')).toBeUndefined();
  });

  it('should handle case-insensitive name matching for deduplication', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const localMargarita = { id: 'local-456', name: 'Margarita', source: 'local' };
    const externalMargarita = { id: 'ext-11007', name: 'margarita', source: 'api' }; // lowercase
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({ data: [localMargarita], hasMore: false });
    jest.spyOn(aggregator, 'searchExternal').mockResolvedValue([externalMargarita]);
    
    const result = await aggregator.searchUnified('margarita', { limit: 10, page: 1 });
    
    expect(result.data).toHaveLength(1);
    expect(result.data[0].source).toBe('local');
  });

  it('should NOT deduplicate when names are similar but not identical', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const localOldFashioned = { id: 'local-789', name: 'Old Fashioned', source: 'local' };
    const externalWhiskeySour = { id: 'ext-11008', name: 'Whiskey Sour', source: 'api' };
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({ data: [localOldFashioned], hasMore: false });
    jest.spyOn(aggregator, 'searchExternal').mockResolvedValue([externalWhiskeySour]);
    
    const result = await aggregator.searchUnified('whiskey', { limit: 10, page: 1 });
    
    expect(result.data).toHaveLength(2); // Both should appear
    expect(result.data.find(d => d.name === 'Old Fashioned')).toBeDefined();
    expect(result.data.find(d => d.name === 'Whiskey Sour')).toBeDefined();
  });
});
```

**Example TDD for Searching with Empty or Special Characters (UC 2.15):**
```typescript
describe('CocktailAggregatorService - Input Validation', () => {
  it('should return empty array for search query with only special characters', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const result = await aggregator.searchUnified(' %%% ', { limit: 10, page: 1 });
    
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should return empty array for search query with only whitespace', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const result = await aggregator.searchUnified('     ', { limit: 10, page: 1 });
    
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should trim and validate search query before processing', async () => {
    const aggregator = new CocktailAggregatorService();
    const mockSearchLocal = jest.spyOn(aggregator, 'searchLocal');
    const mockSearchExternal = jest.spyOn(aggregator, 'searchExternal');
    
    // Query with leading/trailing spaces
    await aggregator.searchUnified('  mojito  ', { limit: 10, page: 1 });
    
    // Should call search methods with trimmed query
    expect(mockSearchLocal).toHaveBeenCalledWith('mojito', expect.any(Object));
    expect(mockSearchExternal).toHaveBeenCalledWith('mojito');
  });

  it('should reject malicious SQL injection patterns', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const maliciousQuery = "'; DROP TABLE cocktails; --";
    const result = await aggregator.searchUnified(maliciousQuery, { limit: 10, page: 1 });
    
    // Should return empty results without executing dangerous queries
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

**Example TDD for Handling External API Rate Limits (UC 2.16):**
```typescript
describe('CocktailAggregatorService - External API Rate Limiting', () => {
  it('should gracefully handle 429 Too Many Requests from external API', async () => {
    const aggregator = new CocktailAggregatorService();
    
    // Mock external API returning 429
    const mockHttp = {
      get: jest.fn().mockRejectedValue({
        response: {
          status: 429,
          data: { message: 'Too Many Requests' }
        }
      })
    };
    aggregator.httpClient = mockHttp;
    
    // Mock circuit breaker
    const mockCircuitBreaker = {
      trip: jest.fn(),
      isOpen: jest.fn().mockReturnValue(false)
    };
    aggregator.circuitBreaker = mockCircuitBreaker;
    
    // Mock local search returns results
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: [{ id: 'local-123', name: 'Local Mojito', source: 'local' }],
      hasMore: false
    });
    
    const result = await aggregator.searchUnified('mojito', { limit: 10, page: 1 });
    
    // Should return only local results
    expect(result.data).toHaveLength(1);
    expect(result.data[0].source).toBe('local');
    expect(result.externalApiAvailable).toBe(false);
    
    // Should trip circuit breaker
    expect(mockCircuitBreaker.trip).toHaveBeenCalled();
  });

  it('should use circuit breaker to prevent external API calls when tripped', async () => {
    const aggregator = new CocktailAggregatorService();
    
    // Mock circuit breaker is open (tripped)
    const mockCircuitBreaker = {
      isOpen: jest.fn().mockReturnValue(true),
      timeUntilReset: jest.fn().mockReturnValue(30000) // 30 seconds
    };
    aggregator.circuitBreaker = mockCircuitBreaker;
    
    // Mock local search
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: [{ id: 'local-456', name: 'Local Margarita', source: 'local' }],
      hasMore: false
    });
    
    const result = await aggregator.searchUnified('margarita', { limit: 10, page: 1 });
    
    // Should not call external API when circuit breaker is open
    expect(result.data).toHaveLength(1);
    expect(result.data[0].source).toBe('local');
    expect(result.externalApiAvailable).toBe(false);
    expect(result.circuitBreakerResetIn).toBe(30000);
  });

  it('should reset circuit breaker after cooldown period', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCircuitBreaker = {
      isOpen: jest.fn()
        .mockReturnValueOnce(true)  // First call: open
        .mockReturnValueOnce(false), // Second call: closed (after reset)
      reset: jest.fn(),
      timeUntilReset: jest.fn().mockReturnValue(0) // Reset complete
    };
    aggregator.circuitBreaker = mockCircuitBreaker;
    
    // First search - circuit breaker open
    const result1 = await aggregator.searchUnified('test', { limit: 10, page: 1 });
    expect(result1.externalApiAvailable).toBe(false);
    
    // Simulate time passing
    jest.advanceTimersByTime(61000); // 61 seconds
    
    // Second search - circuit breaker should reset
    const result2 = await aggregator.searchUnified('test', { limit: 10, page: 1 });
    expect(mockCircuitBreaker.reset).toHaveBeenCalled();
  });
});

**Example TDD for Public Cocktail Integrity (UC 2.17):**
```typescript
describe('CocktailService - Public Editing Guard', () => {
  it('should prevent editing ingredients of public cocktails with active favorites', async () => {
    const cocktailService = new CocktailService();
    
    // Mock that this cocktail has 5 users who favorited it
    jest.spyOn(cocktailService.favoritesRepo, 'count').mockResolvedValue(5);
    
    await expect(cocktailService.updateCocktail('cocktail123', 'author123', {
      ingredients: [{ ingredientId: 'bleach-123', measure: '1 oz' }]
    })).rejects.toThrow('Cannot modify ingredients of a public cocktail currently favorited by other users.');
  });

  it('should allow editing non-ingredient fields of public cocktails', async () => {
    const cocktailService = new CocktailService();
    
    // Mock cocktail has favorites but user wants to edit description only
    jest.spyOn(cocktailService.favoritesRepo, 'count').mockResolvedValue(3);
    const mockSave = jest.spyOn(cocktailService.cocktailRepo, 'save').mockResolvedValue({} as any);
    
    await cocktailService.updateCocktail('cocktail123', 'author123', {
      description: 'Updated description',
      instructions: 'New mixing instructions'
      // No ingredients changed
    });
    
    expect(mockSave).toHaveBeenCalled();
  });

  it('should fork recipe when author wants to edit ingredients of favorited public cocktail', async () => {
    const cocktailService = new CocktailService();
    
    // Mock cocktail has 2 favorites
    jest.spyOn(cocktailService.favoritesRepo, 'count').mockResolvedValue(2);
    
    // Mock fork creation
    const mockFork = jest.spyOn(cocktailService, 'forkCocktail').mockResolvedValue({
      id: 'forked-123',
      name: 'Mojito (Edited)',
      parentId: 'cocktail123'
    });
    
    const updateData = {
      ingredients: [{ ingredientId: 'new-rum', measure: '2 oz' }],
      name: 'Mojito (Edited)'
    };
    
    const result = await cocktailService.updateCocktail('cocktail123', 'author123', updateData);
    
    expect(mockFork).toHaveBeenCalledWith('cocktail123', 'author123', updateData);
    expect(result.id).toBe('forked-123');
    expect(result.parentId).toBe('cocktail123');
  });

  it('should allow editing ingredients of private cocktails regardless of favorites', async () => {
    const cocktailService = new CocktailService();
    
    // Mock private cocktail (is_public = false)
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue({
      id: 'cocktail123',
      is_public: false,
      created_by: 'author123'
    });
    
    // Even if it has favorites (user's own favorites)
    jest.spyOn(cocktailService.favoritesRepo, 'count').mockResolvedValue(1);
    
    const mockSave = jest.spyOn(cocktailService.cocktailRepo, 'save').mockResolvedValue({} as any);
    
    await cocktailService.updateCocktail('cocktail123', 'author123', {
      ingredients: [{ ingredientId: 'vodka', measure: '2 oz' }]
    });
    
    expect(mockSave).toHaveBeenCalled();
  });
});
```

**Example TDD for Advanced Filtering (UC 2.18):**
```typescript
describe('CocktailAggregatorService - Advanced Filtering', () => {
  it('should filter out cocktails containing excluded ingredients', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { id: '1', name: 'Margarita', ingredients: [{ name: 'Tequila' }, { name: 'Lime Juice' }] },
      { id: '2', name: 'Virgin Margarita', ingredients: [{ name: 'Lime Juice' }, { name: 'Simple Syrup' }] },
      { id: '3', name: 'Tequila Sunrise', ingredients: [{ name: 'Tequila' }, { name: 'Orange Juice' }] }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    const result = await aggregator.searchUnified('margarita', {
      limit: 10,
      page: 1,
      ingredients_exclude: ['Tequila']
    });
    
    // Should exclude cocktails containing Tequila
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Virgin Margarita');
  });

  it('should handle multiple excluded ingredients', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { id: '1', name: 'Mojito', ingredients: [{ name: 'Rum' }, { name: 'Mint' }, { name: 'Lime' }] },
      { id: '2', name: 'Mocktail Mojito', ingredients: [{ name: 'Mint' }, { name: 'Lime' }] },
      { id: '3', name: 'Rum Punch', ingredients: [{ name: 'Rum' }, { name: 'Juice' }] }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    const result = await aggregator.searchUnified('mojito', {
      limit: 10,
      page: 1,
      ingredients_exclude: ['Rum', 'Alcohol']
    });
    
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Mocktail Mojito');
  });

  it('should apply exclude filters to external API results', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const externalResults = [
      { id: '11000', name: 'Margarita', ingredients: [{ name: 'Tequila' }] },
      { id: '11001', name: 'Virgin Mary', ingredients: [{ name: 'Tomato Juice' }] }
    ];
    
    jest.spyOn(aggregator, 'searchExternal').mockResolvedValue(externalResults);
    
    const result = await aggregator.searchUnified('margarita', {
      limit: 10,
      page: 1,
      ingredients_exclude: ['Tequila']
    });
    
    // Should filter external results too
    expect(result.data.find(c => c.name === 'Margarita')).toBeUndefined();
    expect(result.data.find(c => c.name === 'Virgin Mary')).toBeDefined();
  });

  it('should handle case-insensitive ingredient exclusion', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { id: '1', name: 'Drink', ingredients: [{ name: 'TEQUILA' }] }, // Uppercase
      { id: '2', name: 'Mocktail', ingredients: [{ name: 'juice' }] } // Lowercase
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    const result = await aggregator.searchUnified('drink', {
      limit: 10,
      page: 1,
      ingredients_exclude: ['tequila'] // Lowercase filter
    });
    
    // Should exclude regardless of case
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Mocktail');
  });
});
```

**Example TDD for Strict Inclusion Search (UC 2.19):**
```typescript
describe('CocktailAggregatorService - Strict Inclusion Search', () => {
  it('should return only cocktails containing ALL specified ingredients', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { 
        id: '1', 
        name: 'Negroni', 
        ingredients: [{ name: 'Gin' }, { name: 'Campari' }, { name: 'Vermouth' }] 
      },
      { 
        id: '2', 
        name: 'Gin & Tonic', 
        ingredients: [{ name: 'Gin' }, { name: 'Tonic Water' }] 
      },
      { 
        id: '3', 
        name: 'Americano', 
        ingredients: [{ name: 'Campari' }, { name: 'Vermouth' }] 
      }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Search for cocktails containing BOTH Gin AND Campari
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_include: ['Gin', 'Campari']
    });
    
    // Should return only Negroni (contains both Gin and Campari)
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Negroni');
  });

  it('should handle case-insensitive ingredient matching', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { 
        id: '1', 
        name: 'Margarita', 
        ingredients: [{ name: 'TEQUILA' }, { name: 'LIME JUICE' }] 
      },
      { 
        id: '2', 
        name: 'Tequila Sunrise', 
        ingredients: [{ name: 'tequila' }, { name: 'Orange Juice' }] 
      }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Search with lowercase filter
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_include: ['tequila'] // Lowercase
    });
    
    // Should return both cocktails (case-insensitive match)
    expect(result.data).toHaveLength(2);
  });

  it('should require ALL ingredients in include filter (not just some)', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { 
        id: '1', 
        name: 'Cocktail A', 
        ingredients: [{ name: 'Vodka' }, { name: 'Lime' }, { name: 'Soda' }] 
      },
      { 
        id: '2', 
        name: 'Cocktail B', 
        ingredients: [{ name: 'Vodka' }, { name: 'Cranberry' }] 
      },
      { 
        id: '3', 
        name: 'Cocktail C', 
        ingredients: [{ name: 'Lime' }, { name: 'Soda' }] 
      }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Filter for Vodka AND Lime AND Soda
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_include: ['Vodka', 'Lime', 'Soda']
    });
    
    // Should return only Cocktail A (has all three)
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Cocktail A');
  });

  it('should work with partial ingredient name matches', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { 
        id: '1', 
        name: 'Whiskey Sour', 
        ingredients: [{ name: 'Bourbon Whiskey' }, { name: 'Lemon Juice' }] 
      },
      { 
        id: '2', 
        name: 'Scotch & Soda', 
        ingredients: [{ name: 'Scotch Whisky' }, { name: 'Soda Water' }] 
      },
      { 
        id: '3', 
        name: 'Vodka Martini', 
        ingredients: [{ name: 'Vodka' }, { name: 'Vermouth' }] 
      }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Filter for any cocktail containing "Whiskey" in ingredient name
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_include: ['Whiskey']
    });
    
    // Should return Bourbon Whiskey and Scotch Whisky cocktails
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('Whiskey Sour');
    expect(result.data[1].name).toBe('Scotch & Soda');
  });

  it('should combine include and exclude filters', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { 
        id: '1', 
        name: 'Vodka Cranberry', 
        ingredients: [{ name: 'Vodka' }, { name: 'Cranberry Juice' }] 
      },
      { 
        id: '2', 
        name: 'Vodka Soda', 
        ingredients: [{ name: 'Vodka' }, { name: 'Soda Water' }] 
      },
      { 
        id: '3', 
        name: 'Rum & Coke', 
        ingredients: [{ name: 'Rum' }, { name: 'Cola' }] 
      }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Filter: Must include Vodka, must NOT include Cranberry
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_include: ['Vodka'],
      ingredients_exclude: ['Cranberry']
    });
    
    // Should return only Vodka Soda
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Vodka Soda');
  });

  it('should apply strict inclusion to external API results', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const externalResults = [
      { 
        id: '11000', 
        name: 'Margarita', 
        ingredients: [{ name: 'Tequila' }, { name: 'Lime Juice' }, { name: 'Triple Sec' }] 
      },
      { 
        id: '11001', 
        name: 'Tequila Sunrise', 
        ingredients: [{ name: 'Tequila' }, { name: 'Orange Juice' }] 
      },
      { 
        id: '11002', 
        name: 'Paloma', 
        ingredients: [{ name: 'Tequila' }, { name: 'Grapefruit Soda' }] 
      }
    ];
    
    jest.spyOn(aggregator, 'searchExternal').mockResolvedValue(externalResults);
    
    // Filter for Tequila AND Lime Juice
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_include: ['Tequila', 'Lime Juice']
    });
    
    // Should return only Margarita from external results
    expect(result.data.find(c => c.name === 'Margarita')).toBeDefined();
    expect(result.data.find(c => c.name === 'Tequila Sunrise')).toBeUndefined();
    expect(result.data.find(c => c.name === 'Paloma')).toBeUndefined();
  });

  it('should handle empty include filter (return all cocktails)', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { id: '1', name: 'Cocktail A', ingredients: [{ name: 'Vodka' }] },
      { id: '2', name: 'Cocktail B', ingredients: [{ name: 'Gin' }] }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Empty include filter should return all
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_include: [] // Empty array
    });
    
    expect(result.data).toHaveLength(2);
  });

  it('should provide user-friendly error for impossible filter combinations', async () => {
    const aggregator = new CocktailAggregatorService();
    
    // Include and exclude the same ingredient
    await expect(aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_include: ['Vodka'],
      ingredients_exclude: ['Vodka'] // Impossible combination
    })).rejects.toThrow('Cannot include and exclude the same ingredient: Vodka');
  });

  it('should handle synonyms in strict inclusion search', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    
    aggregator.ingredientService = ingredientService;
    
    const mockCocktails = [
      { 
        id: '1', 
        name: 'Whiskey Drink', 
        ingredients: [{ name: 'Bourbon' }] // Bourbon is a type of Whiskey
      },
      { 
        id: '2', 
        name: 'Other Drink', 
        ingredients: [{ name: 'Vodka' }] 
      }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Mock synonym resolution: Bourbon → Whiskey
    jest.spyOn(ingredientService, 'resolveBaseIngredient')
      .mockImplementation((name) => name === 'Bourbon' ? 'Whiskey' : name);
    
    // Search for Whiskey (should match Bourbon via synonym)
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_include: ['Whiskey']
    });
    
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Whiskey Drink');
  });
});
```

**Example TDD for Forking External Recipes on Edit (UC 2.21):**
```typescript
describe('CocktailService - Forking External Recipes', () => {
  it('should create local fork when editing external cocktail', async () => {
    const cocktailService = new CocktailService();
    
    // Mock external cocktail (source: 'api')
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue({
      id: 'ext-11000',
      name: 'Mojito',
      source: 'api',
      external_id: '11000'
    });
    
    // Mock fork creation
    const mockFork = jest.spyOn(cocktailService, 'createFork').mockResolvedValue({
      id: 'local-fork-123',
      name: 'Mojito (My Version)',
      source: 'local',
      parent_external_id: '11000',
      created_by: 'user123'
    });
    
    const updateData = {
      name: 'Mojito (My Version)',
      ingredients: [{ ingredientId: 'rum', measure: '2.5 oz' }] // Modified from original
    };
    
    const result = await cocktailService.updateCocktail('ext-11000', 'user123', updateData);
    
    expect(mockFork).toHaveBeenCalledWith('ext-11000', 'user123', updateData);
    expect(result.id).toBe('local-fork-123');
    expect(result.source).toBe('local');
    expect(result.parent_external_id).toBe('11000');
  });

  it('should preserve original external cocktail when forking', async () => {
    const cocktailService = new CocktailService();
    
    // Mock external cocktail
    const originalCocktail = {
      id: 'ext-11007',
      name: 'Margarita',
      source: 'api',
      external_id: '11007',
      instructions: 'Original instructions'
    };
    
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue(originalCocktail);
    
    // Verify original is not modified
    const mockSaveOriginal = jest.spyOn(cocktailService.cocktailRepo, 'save');
    
    const updateData = { name: 'My Margarita' };
    await cocktailService.updateCocktail('ext-11007', 'user123', updateData);
    
    // Should NOT save the original external cocktail
    expect(mockSaveOriginal).not.toHaveBeenCalledWith(originalCocktail);
  });

  it('should copy all fields from external cocktail when forking', async () => {
    const cocktailService = new CocktailService();
    
    const externalCocktail = {
      id: 'ext-11000',
      name: 'Mojito',
      source: 'api',
      external_id: '11000',
      instructions: 'Mix all ingredients',
      glassware: 'Highball',
      category: 'Cocktail',
      image_url: 'https://example.com/mojito.jpg'
    };
    
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue(externalCocktail);
    
    const mockCreate = jest.spyOn(cocktailService.cocktailRepo, 'create').mockReturnValue({} as any);
    jest.spyOn(cocktailService.cocktailRepo, 'save').mockResolvedValue({} as any);
    
    await cocktailService.updateCocktail('ext-11000', 'user123', { name: 'My Mojito' });
    
    // Should copy all fields except id, source, and add parent reference
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'My Mojito',
      instructions: 'Mix all ingredients',
      glassware: 'Highball',
      category: 'Cocktail',
      image_url: 'https://example.com/mojito.jpg',
      source: 'local',
      parent_external_id: '11000',
      created_by: 'user123'
    }));
  });

  it('should handle forking with ingredient modifications', async () => {
    const cocktailService = new CocktailService();
    
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue({
      id: 'ext-11000',
      source: 'api',
      external_id: '11000'
    });
    
    const mockFork = jest.spyOn(cocktailService, 'createFork').mockResolvedValue({} as any);
    
    const updateData = {
      ingredients: [
        { ingredientId: 'rum', measure: '2.5 oz' }, // Modified amount
        { ingredientId: 'mint', measure: '10 leaves' }, // Modified unit
        { ingredientId: 'new_ingredient', measure: '1 dash' } // Added ingredient
      ]
    };
    
    await cocktailService.updateCocktail('ext-11000', 'user123', updateData);
    
    expect(mockFork).toHaveBeenCalledWith('ext-11000', 'user123', updateData);
  });

  it('should allow editing local cocktails without forking', async () => {
    const cocktailService = new CocktailService();
    
    // Mock local cocktail (source: 'local')
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue({
      id: 'local-123',
      name: 'My Cocktail',
      source: 'local',
      created_by: 'user123'
    });
    
    // Should update directly, not fork
    const mockSave = jest.spyOn(cocktailService.cocktailRepo, 'save').mockResolvedValue({} as any);
    const mockFork = jest.spyOn(cocktailService, 'createFork');
    
    await cocktailService.updateCocktail('local-123', 'user123', { name: 'Updated Name' });
    
    expect(mockSave).toHaveBeenCalled();
    expect(mockFork).not.toHaveBeenCalled();
  });

  it('should track fork lineage for analytics', async () => {
    const cocktailService = new CocktailService();
    
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue({
      id: 'ext-11000',
      source: 'api',
      external_id: '11000'
    });
    
    const mockFork = jest.spyOn(cocktailService, 'createFork').mockResolvedValue({
      id: 'fork-1',
      parent_external_id: '11000',
      fork_depth: 1
    });
    
    await cocktailService.updateCocktail('ext-11000', 'user123', {});
    
    expect(mockFork).toHaveBeenCalled();
    // Could track: fork_count on original, most_forked cocktails, etc.
  });
});
```

**Example TDD for Empty Custom Cocktail Validation (UC 2.23):**
```typescript
describe('CocktailService - Empty Custom Cocktail Validation', () => {
  it('should reject custom cocktail creation with empty ingredients array', async () => {
    const cocktailService = new CocktailService();
    
    const emptyCocktailPayload = {
      name: 'Empty Cocktail',
      ingredients: [], // Empty array - should be rejected
      instructions: 'Mix nothing',
      category: 'Custom'
    };
    
    await expect(cocktailService.createCocktail('user123', emptyCocktailPayload))
      .rejects
      .toThrow('Cocktail must contain at least 1 ingredient');
  });

  it('should reject custom cocktail creation with null ingredients', async () => {
    const cocktailService = new CocktailService();
    
    const nullIngredientsPayload = {
      name: 'Null Ingredients Cocktail',
      ingredients: null, // Null - should be rejected
      instructions: 'Test',
      category: 'Custom'
    };
    
    await expect(cocktailService.createCocktail('user123', nullIngredientsPayload))
      .rejects
      .toThrow('Ingredients array is required');
  });

  it('should reject custom cocktail creation with undefined ingredients', async () => {
    const cocktailService = new CocktailService();
    
    const undefinedIngredientsPayload = {
      name: 'Undefined Ingredients Cocktail',
      // ingredients field omitted (undefined)
      instructions: 'Test',
      category: 'Custom'
    };
    
    await expect(cocktailService.createCocktail('user123', undefinedIngredientsPayload))
      .rejects
      .toThrow('Ingredients array is required');
  });

  it('should accept custom cocktail with at least 1 ingredient', async () => {
    const cocktailService = new CocktailService();
    
    const validCocktailPayload = {
      name: 'Valid Cocktail',
      ingredients: [
        { ingredientId: 'vodka-123', measure: '2 oz' }
      ], // 1 ingredient - minimum
      instructions: 'Mix with ice',
      category: 'Custom'
    };
    
    jest.spyOn(cocktailService.cocktailRepo, 'save').mockResolvedValue({
      id: 'cocktail-123',
      ...validCocktailPayload
    });
    
    const result = await cocktailService.createCocktail('user123', validCocktailPayload);
    
    expect(result).toBeDefined();
    expect(result.id).toBe('cocktail-123');
    expect(result.ingredients).toHaveLength(1);
  });

  it('should validate ingredient structure within ingredients array', async () => {
    const cocktailService = new CocktailService();
    
    const invalidIngredientPayload = {
      name: 'Invalid Ingredient Cocktail',
      ingredients: [
        { /* missing ingredientId */ measure: '2 oz' }, // Invalid
        { ingredientId: 'vodka-123', /* missing measure */ } // Invalid
      ],
      instructions: 'Test',
      category: 'Custom'
    };
    
    await expect(cocktailService.createCocktail('user123', invalidIngredientPayload))
      .rejects
      .toThrow('Each ingredient must have ingredientId and measure');
  });

  it('should reject cocktail update that would result in empty ingredients', async () => {
    const cocktailService = new CocktailService();
    
    // Mock existing cocktail
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue({
      id: 'cocktail-123',
      name: 'Existing Cocktail',
      ingredients: [{ ingredientId: 'vodka-123', measure: '2 oz' }],
      created_by: 'user123'
    });
    
    const updatePayload = {
      ingredients: [] // Trying to update to empty array
    };
    
    await expect(cocktailService.updateCocktail('cocktail-123', 'user123', updatePayload))
      .rejects
      .toThrow('Cocktail must contain at least 1 ingredient');
  });

  it('should provide user-friendly error messages for empty ingredients', async () => {
    const cocktailService = new CocktailService();
    
    const emptyCocktailPayload = {
      name: 'Test Cocktail',
      ingredients: [],
      instructions: 'Test',
      category: 'Custom'
    };
    
    try {
      await cocktailService.createCocktail('user123', emptyCocktailPayload);
    } catch (error) {
      expect(error.message).toBe('Cocktail must contain at least 1 ingredient');
      expect(error.statusCode).toBe(400);
      expect(error.userMessage).toContain('Please add at least one ingredient');
    }
  });

  it('should validate ingredients before database transaction', async () => {
    const cocktailService = new CocktailService();
    
    const emptyCocktailPayload = {
      name: 'Test',
      ingredients: [],
      instructions: 'Test',
      category: 'Custom'
    };
    
    // Mock transaction to verify it's not called
    const mockTransaction = jest.fn();
    jest.spyOn(cocktailService.cocktailRepo.manager, 'transaction').mockImplementation(mockTransaction);
    
    await expect(cocktailService.createCocktail('user123', emptyCocktailPayload))
      .rejects
      .toThrow('Cocktail must contain at least 1 ingredient');
    
    // Transaction should NOT be called due to validation failure
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('should handle edge case: ingredients array with null/undefined elements', async () => {
    const cocktailService = new CocktailService();
    
    const edgeCasePayload = {
      name: 'Edge Case Cocktail',
      ingredients: [null, undefined, { ingredientId: 'vodka-123', measure: '2 oz' }],
      instructions: 'Test',
      category: 'Custom'
    };
    
    await expect(cocktailService.createCocktail('user123', edgeCasePayload))
      .rejects
      .toThrow('Invalid ingredient at position 0: must be an object with ingredientId and measure');
  });

  it('should work with class-validator decorators for DTO validation', async () => {
    // This test would validate the CreateCocktailDto class
    const createCocktailDto = new CreateCocktailDto();
    createCocktailDto.name = 'Test Cocktail';
    createCocktailDto.ingredients = []; // Empty array
    
    // Simulate class-validator validation
    const errors = await validate(createCocktailDto);
    
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('ingredients');
    expect(errors[0].constraints).toHaveProperty('arrayMinSize');
  });
});
```

**Example TDD for External Ingredient Resolution (UC 2.25):**
```typescript
describe('CocktailAggregatorService - External Ingredient Resolution', () => {
  it('should resolve external string ingredients to local UUIDs for makeability checks', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    
    // External API returns string "Dark Rum"
    const externalCocktail = { idDrink: '1', strIngredient1: 'Dark Rum', strMeasure1: '2 oz' };
    
    // Mock the resolver to return a local UUID
    jest.spyOn(ingredientService, 'resolveBaseIngredient')
      .mockResolvedValue({ id: 'uuid-dark-rum', name: 'dark rum' });
      
    aggregator.ingredientService = ingredientService;
    
    const mapped = await aggregator.mapExternalToInternal(externalCocktail);
    
    // The mapped DTO should now contain the resolvable UUID for the Makeable Engine
    expect(mapped.ingredients[0].ingredientId).toBe('uuid-dark-rum');
  });

  it('should handle case-insensitive ingredient name matching', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    
    // External API returns "LIGHT RUM" (uppercase)
    const externalCocktail = { idDrink: '2', strIngredient1: 'LIGHT RUM', strMeasure1: '1.5 oz' };
    
    // Mock resolver to handle case-insensitive matching
    jest.spyOn(ingredientService, 'resolveBaseIngredient')
      .mockImplementation((name) => {
        const normalized = name.toLowerCase();
        if (normalized === 'light rum') {
          return Promise.resolve({ id: 'uuid-light-rum', name: 'Light Rum' });
        }
        return Promise.resolve(null);
      });
      
    aggregator.ingredientService = ingredientService;
    
    const mapped = await aggregator.mapExternalToInternal(externalCocktail);
    
    expect(mapped.ingredients[0].ingredientId).toBe('uuid-light-rum');
  });

  it('should cache resolved ingredient mappings in Redis', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    const cacheService = new RedisCacheService();
    
    const externalCocktail = { idDrink: '3', strIngredient1: 'Gin', strMeasure1: '2 oz' };
    
    // Mock first call to resolve from database
    const resolveSpy = jest.spyOn(ingredientService, 'resolveBaseIngredient')
      .mockResolvedValueOnce({ id: 'uuid-gin', name: 'Gin' })
      .mockResolvedValueOnce({ id: 'uuid-gin', name: 'Gin' });
    
    // Mock cache set and get
    const cacheSetSpy = jest.spyOn(cacheService, 'set').mockResolvedValue(true);
    const cacheGetSpy = jest.spyOn(cacheService, 'get').mockResolvedValue(null);
    
    aggregator.ingredientService = ingredientService;
    aggregator.cacheService = cacheService;
    
    // First call should hit database and cache
    await aggregator.mapExternalToInternal(externalCocktail);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(cacheSetSpy).toHaveBeenCalledWith('ingredient:resolve:Gin', 'uuid-gin', { ttl: 3600 });
    
    // Reset spy calls
    resolveSpy.mockClear();
    
    // Mock cache now returns the UUID
    cacheGetSpy.mockResolvedValue('uuid-gin');
    
    // Second call should use cache, not database
    await aggregator.mapExternalToInternal(externalCocktail);
    expect(resolveSpy).not.toHaveBeenCalled(); // Should not call database
  });

  it('should handle unresolved external ingredients gracefully', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    
    // External API returns unknown ingredient
    const externalCocktail = { 
      idDrink: '4', 
      strIngredient1: 'Unicorn Tears', 
      strMeasure1: '1 dash' 
    };
    
    // Mock resolver returns null (not found)
    jest.spyOn(ingredientService, 'resolveBaseIngredient')
      .mockResolvedValue(null);
      
    aggregator.ingredientService = ingredientService;
    
    const mapped = await aggregator.mapExternalToInternal(externalCocktail);
    
    // Should still map but with null ingredientId for makeability
    expect(mapped.ingredients[0].ingredientId).toBeNull();
    expect(mapped.ingredients[0].name).toBe('Unicorn Tears');
  });

  it('should resolve synonyms for external ingredients', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    
    // External API returns "Cointreau"
    const externalCocktail = { idDrink: '5', strIngredient1: 'Cointreau', strMeasure1: '0.5 oz' };
    
    // Mock resolver to map synonym to base ingredient
    jest.spyOn(ingredientService, 'resolveBaseIngredient')
      .mockImplementation((name) => {
        if (name === 'Cointreau') {
          return Promise.resolve({ 
            id: 'uuid-triple-sec', 
            name: 'Triple Sec',
            isSynonym: true,
            baseIngredientId: 'uuid-orange-liqueur'
          });
        }
        return Promise.resolve(null);
      });
      
    aggregator.ingredientService = ingredientService;
    
    const mapped = await aggregator.mapExternalToInternal(externalCocktail);
    
    // Should map to the base ingredient UUID for makeability calculations
    expect(mapped.ingredients[0].ingredientId).toBe('uuid-orange-liqueur');
  });
});
```

**Example TDD for Hierarchical Ingredient Exclusion (UC 2.26):**
```typescript
describe('CocktailAggregatorService - Hierarchical Exclusions', () => {
  it('should exclude cocktails containing child ingredients of an excluded parent category', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    
    // Mock hierarchy: "Whiskey" is parent of "Bourbon" and "Rye"
    jest.spyOn(ingredientService, 'getIngredientHierarchy').mockImplementation((ingredientName) => {
      if (ingredientName === 'Whiskey') {
        return Promise.resolve({
          id: 'uuid-whiskey',
          name: 'Whiskey',
          children: [
            { id: 'uuid-bourbon', name: 'Bourbon' },
            { id: 'uuid-rye', name: 'Rye' }
          ]
        });
      }
      return Promise.resolve(null);
    });
    
    aggregator.ingredientService = ingredientService;
    
    const mockCocktails = [
      { 
        id: '1', 
        name: 'Bourbon Old Fashioned', 
        ingredients: [{ name: 'Bourbon', ingredientId: 'uuid-bourbon' }] 
      },
      { 
        id: '2', 
        name: 'Rye Manhattan', 
        ingredients: [{ name: 'Rye', ingredientId: 'uuid-rye' }] 
      },
      { 
        id: '3', 
        name: 'Vodka Martini', 
        ingredients: [{ name: 'Vodka', ingredientId: 'uuid-vodka' }] 
      }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Exclude "Whiskey" - should exclude both Bourbon and Rye cocktails
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_exclude: ['Whiskey']
    });
    
    // Should exclude cocktails containing child ingredients
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Vodka Martini');
  });

  it('should handle multiple hierarchical exclusions', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    
    // Mock multiple hierarchies
    jest.spyOn(ingredientService, 'getIngredientHierarchy').mockImplementation((ingredientName) => {
      const hierarchies = {
        'Orange Liqueur': {
          id: 'uuid-orange-liqueur',
          name: 'Orange Liqueur',
          children: [
            { id: 'uuid-triple-sec', name: 'Triple Sec' },
            { id: 'uuid-cointreau', name: 'Cointreau' }
          ]
        },
        'Whiskey': {
          id: 'uuid-whiskey',
          name: 'Whiskey',
          children: [
            { id: 'uuid-bourbon', name: 'Bourbon' }
          ]
        }
      };
      return Promise.resolve(hierarchies[ingredientName] || null);
    });
    
    aggregator.ingredientService = ingredientService;
    
    const mockCocktails = [
      { id: '1', name: 'Margarita', ingredients: [{ name: 'Triple Sec' }] },
      { id: '2', name: 'Sidecar', ingredients: [{ name: 'Cointreau' }] },
      { id: '3', name: 'Old Fashioned', ingredients: [{ name: 'Bourbon' }] },
      { id: '4', name: 'Gin & Tonic', ingredients: [{ name: 'Gin' }] }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Exclude both Orange Liqueur and Whiskey
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_exclude: ['Orange Liqueur', 'Whiskey']
    });
    
    // Should exclude all except Gin & Tonic
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Gin & Tonic');
  });

  it('should cache hierarchy resolutions for performance', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    const cacheService = new RedisCacheService();
    
    const hierarchySpy = jest.spyOn(ingredientService, 'getIngredientHierarchy')
      .mockResolvedValue({
        id: 'uuid-rum',
        name: 'Rum',
        children: [
          { id: 'uuid-light-rum', name: 'Light Rum' },
          { id: 'uuid-dark-rum', name: 'Dark Rum' }
        ]
      });
    
    const cacheSetSpy = jest.spyOn(cacheService, 'set').mockResolvedValue(true);
    const cacheGetSpy = jest.spyOn(cacheService, 'get').mockResolvedValue(null);
    
    aggregator.ingredientService = ingredientService;
    aggregator.cacheService = cacheService;
    
    // First call should hit database and cache
    await aggregator.resolveExclusionHierarchy('Rum');
    expect(hierarchySpy).toHaveBeenCalledTimes(1);
    expect(cacheSetSpy).toHaveBeenCalledWith('hierarchy:Rum', expect.any(String), { ttl: 3600 });
    
    // Reset spy
    hierarchySpy.mockClear();
    
    // Second call should use cache
    cacheGetSpy.mockResolvedValue(JSON.stringify({
      id: 'uuid-rum',
      name: 'Rum',
      children: ['uuid-light-rum', 'uuid-dark-rum']
    }));
    
    await aggregator.resolveExclusionHierarchy('Rum');
    expect(hierarchySpy).not.toHaveBeenCalled(); // Should not call database
  });

  it('should handle circular references in ingredient hierarchy', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    
    // Mock circular reference: A -> B -> A
    jest.spyOn(ingredientService, 'getIngredientHierarchy').mockImplementation(async (ingredientName) => {
      if (ingredientName === 'A') {
        return {
          id: 'uuid-a',
          name: 'A',
          children: [{ id: 'uuid-b', name: 'B' }]
        };
      }
      if (ingredientName === 'B') {
        return {
          id: 'uuid-b',
          name: 'B',
          children: [{ id: 'uuid-a', name: 'A' }] // Circular!
        };
      }
      return null;
    });
    
    aggregator.ingredientService = ingredientService;
    
    // Should detect and break circular reference
    const result = await aggregator.resolveExclusionHierarchy('A');
    
    expect(result).toBeDefined();
    expect(result.id).toBe('uuid-a');
    // Implementation should track visited nodes to prevent infinite recursion
  });

  it('should combine hierarchical exclusion with strict inclusion filters', async () => {
    const aggregator = new CocktailAggregatorService();
    const ingredientService = new IngredientService();
    
    jest.spyOn(ingredientService, 'getIngredientHierarchy').mockResolvedValue({
      id: 'uuid-citrus',
      name: 'Citrus',
      children: [
        { id: 'uuid-lemon', name: 'Lemon' },
        { id: 'uuid-lime', name: 'Lime' }
      ]
    });
    
    aggregator.ingredientService = ingredientService;
    
    const mockCocktails = [
      { id: '1', name: 'Lemon Drop', ingredients: [{ name: 'Lemon' }, { name: 'Vodka' }] },
      { id: '2', name: 'Margarita', ingredients: [{ name: 'Lime' }, { name: 'Tequila' }] },
      { id: '3', name: 'Cosmopolitan', ingredients: [{ name: 'Lime' }, { name: 'Vodka' }] }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    // Exclude Citrus, include Vodka
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      ingredients_exclude: ['Citrus'],
      ingredients_include: ['Vodka']
    });
    
    // Should exclude all (Citrus exclusion removes all cocktails)
    expect(result.data).toHaveLength(0);
  });

  it('should correctly sort unified search results by database rating', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const mockCocktails = [
      { id: '1', name: 'Cocktail A', rating: 4.5, source: 'local' },
      { id: '2', name: 'Cocktail B', rating: 4.2, source: 'local' },
      { id: '3', name: 'Cocktail C', rating: 4.8, source: 'local' }
    ];
    
    jest.spyOn(aggregator, 'searchLocal').mockResolvedValue({
      data: mockCocktails,
      hasMore: false
    });
    
    const result = await aggregator.searchUnified('', {
      limit: 10,
      page: 1,
      sort: 'rating'
    });
    
    // Should be sorted by rating descending
    expect(result.data[0].rating).toBe(4.8); // Cocktail C
    expect(result.data[1].rating).toBe(4.5); // Cocktail A
    expect(result.data[2].rating).toBe(4.2); // Cocktail B
  });
});

describe('CocktailService - Ratings Concurrency', () => {
  it('should accurately calculate average rating under concurrent load', async () => {
    const cocktailService = new CocktailService();
    
    // Mock cocktail currently has 1 rating of 3.0 (Avg: 3.0)
    // Simulate 3 concurrent users rating it: 5.0, 4.0, and 5.0. 
    // New total should be (3+5+4+5)/4 = 4.25
    
    const request1 = cocktailService.rateCocktail('cocktail123', 'userA', 5.0);
    const request2 = cocktailService.rateCocktail('cocktail123', 'userB', 4.0);
    const request3 = cocktailService.rateCocktail('cocktail123', 'userC', 5.0);
    
    await Promise.all([request1, request2, request3]);
    
    // Verify that the final database state reflects exactly 4.25
    // This ensures the transactional row-locking (SELECT FOR UPDATE) worked
    const cocktail = await cocktailService.findById('cocktail123');
    expect(cocktail.average_rating).toBe(4.25);
  });
});

**Example TDD for Private Cocktail Guards (UC 2.34):**
```typescript
describe('CocktailService - Private Cocktail Guards', () => {
  it('should block non-authors from directly fetching a private cocktail by UUID', async () => {
    const cocktailService = new CocktailService();
    
    // Mock database returning a private cocktail owned by userA
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue({
      id: 'private-uuid-123',
      name: 'Secret Drink',
      is_public: false,
      created_by: 'userA'
    });
    
    // userB attempts to fetch it
    await expect(cocktailService.getCocktailById('private-uuid-123', 'userB'))
      .rejects
      .toThrow('Forbidden: You do not have permission to view this recipe');
  });
});

**Example TDD for Flat Key Mapping (UC 2.36):**
```typescript
describe('CocktailAggregatorService - Flat Key Mapping', () => {
  it('should flatten strIngredient1-15 and strMeasure1-15 into an ingredients array', async () => {
    const aggregator = new CocktailAggregatorService();
    
    const rawApiResponse = {
      idDrink: '11000',
      strDrink: 'Mojito',
      strIngredient1: 'Rum',
      strMeasure1: '2 oz',
      strIngredient2: 'Mint',
      strMeasure2: '5 leaves',
      strIngredient3: null, // Should stop here
      strIngredient4: 'Sugar' // Should be ignored because 3 was null
    };
    
    const result = await aggregator.mapExternalToInternal(rawApiResponse);
    
    expect(result.ingredients).toHaveLength(2);
    expect(result.ingredients[0].name).toBe('Rum');
    expect(result.ingredients[1].name).toBe('Mint');
  });
});
```
```