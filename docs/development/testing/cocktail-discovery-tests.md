# Cocktail Discovery Tests

**Example TDD for Unified Pagination (UC 2.6):**
```typescript
describe('CocktailAggregatorService - Unified Pagination', () => {
  it('should correctly merge, cache, and slice unpaginated local and external results', async () => {
    const aggregatorService = new CocktailAggregatorService();
    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true)
    };
    aggregatorService.cacheManager = mockCache;
    
    // Mock: UNPAGINATED flat arrays returning from local and external sources
    jest.spyOn(aggregatorService, 'getLocalCocktails').mockResolvedValue([
      { id: 'local1', createdAt: '2026-04-08T10:00:00.000Z' }, 
      { id: 'local2', createdAt: '2026-04-08T09:00:00.000Z' }
    ]);
    
    jest.spyOn(aggregatorService, 'getExternalCocktails').mockResolvedValue(
      Array(50).fill(null).map((_, i) => ({ id: `external${i}`, createdAt: `2026-04-08T08:${59-i}:00.000Z` }))
    );
    
    // First request: page=1, limit=10
    const page1 = await aggregatorService.unifiedSearch(10, 1, 'margarita');
    
    // Verifications
    expect(aggregatorService.getLocalCocktails).toHaveBeenCalledWith('margarita', 100);
    expect(mockCache.set).toHaveBeenCalled(); // Verifies the combined array was cached
    expect(page1.data).toHaveLength(10);
    expect(page1.data[0].id).toBe('local1');
    expect(page1.data[1].id).toBe('local2');
    expect(page1.data[2].id).toBe('external0'); // First 8 external results
    expect(page1.meta.totalItems).toBe(52);
    expect(page1.meta.totalPages).toBe(6); // 52 items / 10 per page = 5.2 → ceil = 6 pages
    expect(page1.meta.nextPage).toBe(2); 
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
    
    const result = await favoritesService.getUserFavoritesWithDetails('user123');
    
    // Should return the favorite with a placeholder/error state
    expect(result[0].externalCocktailId).toBe('99999');
    expect(result[0].error).toBe('External cocktail not found');
    expect(result[0].name).toBe('Unknown Cocktail (Deleted)');
  });
});
```

**Example TDD for Cocktail Rating (UC 2.30):**
```typescript
describe('CocktailService - Rating Logic', () => {
  it('should calculate average rating correctly', async () => {
    const cocktailService = new CocktailService();
    
    // Mock cocktail with existing ratings
    const mockCocktail = {
      id: 'cocktail123',
      name: 'Mojito',
      ratings: [
        { userId: 'user1', rating: 4 },
        { userId: 'user2', rating: 5 },
        { userId: 'user3', rating: 3 }
      ]
    };
    
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue(mockCocktail);
    
    // Calculate average: (4 + 5 + 3) / 3 = 4.0
    const result = await cocktailService.getCocktailWithRating('cocktail123');
    expect(result.averageRating).toBe(4.0);
    expect(result.ratingCount).toBe(3);
  });

  it('should prevent users from rating the same cocktail twice', async () => {
    const cocktailService = new CocktailService();
    
    // Mock cocktail where user already rated it
    const mockCocktail = {
      id: 'cocktail123',
      ratings: [
        { userId: 'user123', rating: 4 }
      ]
    };
    
    jest.spyOn(cocktailService.cocktailRepo, 'findOne').mockResolvedValue(mockCocktail);
    
    // User tries to rate again
    await expect(
      cocktailService.rateCocktail('cocktail123', 'user123', 5)
    ).rejects.toThrow('You have already rated this cocktail');
  });
});
```

**Example TDD for Rating Update (UC 2.31):**
```typescript
describe('CocktailService - Rating Update', () => {
  it('should allow users to update their existing rating', async () => {
    const cocktailService = new CocktailService();
    
    // Mock cocktail with user's existing rating
    const mockCocktail = {
      id: 'cocktail123',
      ratings: [
        { userId: 'user123', rating: 3 }
      ]
    };
    
    const mockRepo = {
      findOne: jest.fn().mockResolvedValue(mockCocktail),
      save: jest.fn().mockResolvedValue({ ...mockCocktail, averageRating: 4 })
    };
    
    cocktailService.cocktailRepo = mockRepo;
    
    // User updates rating from 3 to 5
    const result = await cocktailService.updateRating('cocktail123', 'user123', 5);
    
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        ratings: expect.arrayContaining([
          expect.objectContaining({ userId: 'user123', rating: 5 })
        ])
      })
    );
    
    expect(result.averageRating).toBe(4);
  });
});
```

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
```

**Example TDD for Flat Key Mapping (UC 2.36):**
```typescript
describe('CocktailAggregatorService - Flat Key Mapping', () => {
  it('should flatten strIngredient1-15 and strMeasure1-15 into an ingredients array', async () => {
    const aggregator = new CocktailAggregatorService();
    
    // Mock external API response with numbered ingredient fields
    const mockResponse = {
      drinks: [{
        idDrink: '11000',
        strDrink: 'Mojito',
        strIngredient1: 'Light rum',
        strMeasure1: '2 oz',
        strIngredient2: 'Lime',
        strMeasure2: '1',
        strIngredient3: 'Sugar',
        strMeasure3: '2 tsp',
        strIngredient4: 'Mint',
        strMeasure4: '6',
        // strIngredient5-15 are null
      }]
    };
    
    const result = aggregator.normalizeExternalCocktail(mockResponse.drinks[0]);
    
    expect(result.ingredients).toEqual([
      { ingredient: 'Light rum', measure: '2 oz' },
      { ingredient: 'Lime', measure: '1' },
      { ingredient: 'Sugar', measure: '2 tsp' },
      { ingredient: 'Mint', measure: '6' }
    ]);
  });
});
```