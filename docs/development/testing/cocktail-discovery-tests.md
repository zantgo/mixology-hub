# Cocktail Discovery Tests

**Example TDD for Unified Pagination (UC 2.6):**
```typescript
describe('CocktailAggregatorService - Unified Pagination', () => {
  it('should correctly merge local and external results for pagination', async () => {
    const aggregatorService = new CocktailAggregatorService();
    
    // Mock: 2 local results, 50 external results
    jest.spyOn(aggregatorService, 'searchLocal').mockResolvedValue({
      data: [{ id: 'local1' }, { id: 'local2' }],
      hasMore: false
    });
    
    jest.spyOn(aggregatorService, 'searchExternal').mockResolvedValue(
      Array(50).fill(null).map((_, i) => ({ id: `external${i}` }))
    );
    
    // Page 1: limit=10
    const page1 = await aggregatorService.searchUnified('margarita', { limit: 10, page: 1 });
    expect(page1.data).toHaveLength(10);
    expect(page1.data[0].id).toBe('local1');
    expect(page1.data[1].id).toBe('local2');
    expect(page1.data[2].id).toBe('external0'); // First 8 external results
    
    // Page 2: should get external results 8-17
    const page2 = await aggregatorService.searchUnified('margarita', { limit: 10, page: 2 });
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

**Example TDD for Forking External Recipes on Edit (UC 2.19):**
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
```
```
```