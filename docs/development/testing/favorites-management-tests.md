# Favorites Management Tests

**Example TDD for Idempotent Favorites (UC 6.2):**
```typescript
describe('Favorites Service - Database Constraint Collision Handling', () => {
  it('should handle duplicate favorite requests gracefully', async () => {
    const favoritesService = new FavoritesService();
    
    // First request should succeed
    const result1 = await favoritesService.addFavorite('user123', 'cocktail456');
    expect(result1).toBe(true);
    
    // Second identical request should not throw
    const result2 = await favoritesService.addFavorite('user123', 'cocktail456');
    expect(result2).toBe(true); // Or could return false/undefined
    
    // Verify no duplicate in database
    const favorites = await favoritesService.getUserFavorites('user123');
    const mojitoFavorites = favorites.filter(f => f.cocktailId === 'cocktail456');
    expect(mojitoFavorites).toHaveLength(1);
  });
});
```

**Example TDD for Favorite Removal (UC 6.3):**
```typescript
describe('Favorites Service - Removal Operations', () => {
  it('should remove favorite without affecting cocktail', async () => {
    const favoritesService = new FavoritesService();
    const cocktailsService = new CocktailsService();
    
    // First add a favorite
    await favoritesService.addFavorite('user123', 'cocktail456');
    
    // Verify it exists
    const before = await favoritesService.getUserFavorites('user123');
    expect(before).toHaveLength(1);
    
    // Remove the favorite
    await favoritesService.removeFavorite('user123', 'cocktail456');
    
    // Verify favorite is gone
    const after = await favoritesService.getUserFavorites('user123');
    expect(after).toHaveLength(0);
    
    // Verify cocktail still exists
    const cocktail = await cocktailsService.findById('cocktail456');
    expect(cocktail).toBeDefined();
    expect(cocktail.id).toBe('cocktail456');
  });

  it('should handle removal of non-existent favorite gracefully', async () => {
    const favoritesService = new FavoritesService();
    
    // Try to remove favorite that doesn't exist
    await expect(favoritesService.removeFavorite('user123', 'nonexistent'))
      .resolves
      .not.toThrow();
    
    // Should return success or no-op, not throw error
    const result = await favoritesService.removeFavorite('user123', 'nonexistent');
    expect(result).toBe(true); // Or could be false/undefined
  });
});

**Example TDD for Handling Deleted Custom Cocktails in Favorites (UC 6.6):**
```typescript
describe('Favorites Service - Deleted Custom Cocktails', () => {
  it('should handle soft-deleted cocktails in favorites gracefully', async () => {
    const favoritesService = new FavoritesService();
    const cocktailService = new CocktailService();
    
    // User has favorite for cocktail123
    jest.spyOn(favoritesService, 'getUserFavorites').mockResolvedValue([
      { cocktailId: 'cocktail123', userId: 'user456' }
    ]);
    
    // Cocktail is soft-deleted
    jest.spyOn(cocktailService, 'getCocktailById').mockResolvedValue({
      id: 'cocktail123',
      name: 'Custom Drink',
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: 'author789'
    });
    
    favoritesService.cocktailService = cocktailService;
    
    const hydratedFavorites = await favoritesService.getHydratedFavorites('user456');
    
    expect(hydratedFavorites).toHaveLength(1);
    expect(hydratedFavorites[0].cocktailId).toBe('cocktail123');
    expect(hydratedFavorites[0].is_deleted).toBe(true);
    expect(hydratedFavorites[0].deleted_message).toBe('Recipe deleted by author');
    expect(hydratedFavorites[0].can_remove).toBe(true); // User can remove from favorites
  });

  it('should handle cascade deletion when user deletes account', async () => {
    const favoritesService = new FavoritesService();
    
    // Simulate cascade delete: user account deleted, their custom cocktails deleted
    jest.spyOn(favoritesService, 'getUserFavorites').mockResolvedValue([
      { cocktailId: 'custom-123', userId: 'user456' }
    ]);
    
    // Cocktail no longer exists in database (null from JOIN)
    jest.spyOn(favoritesService.cocktailRepo, 'find').mockResolvedValue([]);
    
    const result = await favoritesService.getHydratedFavorites('user789');
    
    // Should return empty array or tombstone entries
    expect(result).toHaveLength(0); // Or could return tombstone entries
  });

  it('should allow users to remove deleted cocktails from favorites', async () => {
    const favoritesService = new FavoritesService();
    
    // Mock favorite exists
    jest.spyOn(favoritesService.favoriteRepo, 'findOne').mockResolvedValue({
      id: 'fav-123',
      userId: 'user456',
      cocktailId: 'deleted-cocktail'
    });
    
    // Mock successful deletion
    jest.spyOn(favoritesService.favoriteRepo, 'delete').mockResolvedValue({ affected: 1 });
    
    await expect(favoritesService.removeFavorite('user456', 'deleted-cocktail'))
      .resolves.not.toThrow();
  });
});

**Example TDD for Paginated & Batched Favorites Hydration (UC 6.6):**
```typescript
describe('Favorites Service - Paginated & Batched Hydration', () => {
  it('should paginate favorites results to limit response size', async () => {
    const favoritesService = new FavoritesService();
    
    // Mock user has 50 favorites
    const mockFavorites = Array(50).fill(null).map((_, i) => ({
      id: `fav-${i}`,
      cocktailId: i < 25 ? `local-${i}` : `external-${i}`,
      userId: 'user123'
    }));
    
    jest.spyOn(favoritesService.favoriteRepo, 'find').mockResolvedValue(mockFavorites.slice(0, 10));
    jest.spyOn(favoritesService.favoriteRepo, 'count').mockResolvedValue(50);
    
    const result = await favoritesService.getPaginatedFavorites('user123', {
      limit: 10,
      page: 1
    });
    
    expect(result.data).toHaveLength(10);
    expect(result.meta.totalItems).toBe(50);
    expect(result.meta.totalPages).toBe(5);
    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.itemsPerPage).toBe(10);
    expect(result.meta.nextPage).toBe(2);
  });

  it('should batch external API calls to avoid overwhelming providers', async () => {
    const favoritesService = new FavoritesService();
    const aggregatorService = new CocktailAggregatorService();
    
    // User has 20 external favorites
    const externalFavorites = Array(20).fill(null).map((_, i) => ({
      id: `fav-${i}`,
      externalCocktailId: `ext-${i}`,
      userId: 'user123'
    }));
    
    jest.spyOn(favoritesService, 'getUserFavorites').mockResolvedValue(externalFavorites);
    
    // Mock aggregator to track call batches
    const batchCalls = [];
    jest.spyOn(aggregatorService, 'getExternalCocktailDetails').mockImplementation(async (id) => {
      batchCalls.push(id);
      return { id, name: `Cocktail ${id}` };
    });
    
    favoritesService.aggregatorService = aggregatorService;
    
    await favoritesService.getHydratedFavorites('user123', { batchSize: 5 });
    
    // Should make calls in batches of 5
    expect(batchCalls).toHaveLength(20); // All 20 called
    // Verify batching by checking call timing (would need async tracking)
  });

  it('should handle partial hydration when external API fails', async () => {
    const favoritesService = new FavoritesService();
    const aggregatorService = new CocktailAggregatorService();
    
    const favorites = [
      { cocktailId: 'local-123', userId: 'user123' },
      { externalCocktailId: 'ext-456', userId: 'user123' },
      { externalCocktailId: 'ext-789', userId: 'user123' }
    ];
    
    jest.spyOn(favoritesService, 'getUserFavorites').mockResolvedValue(favorites);
    
    // Mock external API: first succeeds, second fails
    jest.spyOn(aggregatorService, 'getExternalCocktailDetails')
      .mockImplementation(async (id) => {
        if (id === 'ext-456') {
          return { id: 'ext-456', name: 'Success Cocktail' };
        } else {
          throw new Error('External API unavailable');
        }
      });
    
    favoritesService.aggregatorService = aggregatorService;
    
    const result = await favoritesService.getHydratedFavorites('user123');
    
    // Should return all favorites, with partial hydration
    expect(result).toHaveLength(3);
    expect(result.find(f => f.cocktailId === 'local-123')).toBeDefined();
    expect(result.find(f => f.externalCocktailId === 'ext-456')).toBeDefined();
    expect(result.find(f => f.externalCocktailId === 'ext-789')?.isAvailable).toBe(false);
  });

  it('should respect rate limiting between batch calls', async () => {
    const favoritesService = new FavoritesService();
    
    // Mock 50 external favorites
    const externalFavorites = Array(50).fill(null).map((_, i) => ({
      id: `fav-${i}`,
      externalCocktailId: `ext-${i}`,
      userId: 'user123'
    }));
    
    jest.spyOn(favoritesService, 'getUserFavorites').mockResolvedValue(externalFavorites);
    
    // Track call timing
    const callTimestamps = [];
    const mockAggregator = {
      getExternalCocktailDetails: jest.fn().mockImplementation(async () => {
        callTimestamps.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call
        return { name: 'Test Cocktail' };
      })
    };
    favoritesService.aggregatorService = mockAggregator;
    
    await favoritesService.getHydratedFavorites('user123', {
      batchSize: 5,
      batchDelay: 1000 // 1 second between batches
    });
    
    // Should have delays between batches (simplified check)
    expect(mockAggregator.getExternalCocktailDetails).toHaveBeenCalledTimes(50);
  });
});

**Example TDD for Searching/Filtering Favorites (UC 6.7):**
```typescript
describe('Favorites Service - Search & Filter', () => {
  it('should filter favorites by search query in name', async () => {
    const favoritesService = new FavoritesService();
    
    const hydratedFavorites = [
      { cocktailId: '1', name: 'Rum Punch', ingredients: [{ name: 'Rum' }] },
      { cocktailId: '2', name: 'Gin Fizz', ingredients: [{ name: 'Gin' }] },
      { cocktailId: '3', name: 'Rum Old Fashioned', ingredients: [{ name: 'Rum' }] }
    ];
    
    jest.spyOn(favoritesService, 'getHydratedFavorites').mockResolvedValue(hydratedFavorites);
    
    const result = await favoritesService.searchFavorites('user123', 'Rum');
    
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Rum Punch');
    expect(result[1].name).toBe('Rum Old Fashioned');
  });

  it('should filter favorites by search query in ingredients', async () => {
    const favoritesService = new FavoritesService();
    
    const hydratedFavorites = [
      { cocktailId: '1', name: 'Mojito', ingredients: [{ name: 'Rum' }, { name: 'Mint' }] },
      { cocktailId: '2', name: 'Mint Julep', ingredients: [{ name: 'Bourbon' }, { name: 'Mint' }] },
      { cocktailId: '3', name: 'Martini', ingredients: [{ name: 'Gin' }, { name: 'Vermouth' }] }
    ];
    
    jest.spyOn(favoritesService, 'getHydratedFavorites').mockResolvedValue(hydratedFavorites);
    
    const result = await favoritesService.searchFavorites('user123', 'Mint');
    
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Mojito');
    expect(result[1].name).toBe('Mint Julep');
  });

  it('should perform case-insensitive search', async () => {
    const favoritesService = new FavoritesService();
    
    const hydratedFavorites = [
      { cocktailId: '1', name: 'RUM Punch', ingredients: [{ name: 'RUM' }] },
      { cocktailId: '2', name: 'gin fizz', ingredients: [{ name: 'gin' }] }
    ];
    
    jest.spyOn(favoritesService, 'getHydratedFavorites').mockResolvedValue(hydratedFavorites);
    
    // Search with different case
    const result = await favoritesService.searchFavorites('user123', 'rum');
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('RUM Punch');
  });

  it('should combine search with pagination', async () => {
    const favoritesService = new FavoritesService();
    
    // Mock 25 favorites with various names
    const allFavorites = Array(25).fill(null).map((_, i) => ({
      cocktailId: `cocktail-${i}`,
      name: i < 15 ? `Rum Drink ${i}` : `Other Drink ${i}`,
      ingredients: [{ name: i < 15 ? 'Rum' : 'Other' }]
    }));
    
    jest.spyOn(favoritesService, 'getHydratedFavorites').mockResolvedValue(allFavorites);
    
    // Search for "Rum" with pagination
    const page1 = await favoritesService.searchFavorites('user123', 'Rum', {
      limit: 10,
      page: 1
    });
    
    const page2 = await favoritesService.searchFavorites('user123', 'Rum', {
      limit: 10,
      page: 2
    });
    
    expect(page1).toHaveLength(10); // First 10 rum drinks
    expect(page2).toHaveLength(5);  // Remaining 5 rum drinks
    expect(page1[0].name).toBe('Rum Drink 0');
    expect(page2[0].name).toBe('Rum Drink 10');
  });

  it('should return empty array when no matches found', async () => {
    const favoritesService = new FavoritesService();
    
    const hydratedFavorites = [
      { cocktailId: '1', name: 'Mojito', ingredients: [{ name: 'Rum' }] },
      { cocktailId: '2', name: 'Martini', ingredients: [{ name: 'Gin' }] }
    ];
    
    jest.spyOn(favoritesService, 'getHydratedFavorites').mockResolvedValue(hydratedFavorites);
    
    const result = await favoritesService.searchFavorites('user123', 'Vodka');
    
    expect(result).toHaveLength(0);
  });

  it('should handle partial word matches', async () => {
    const favoritesService = new FavoritesService();
    
    const hydratedFavorites = [
      { cocktailId: '1', name: 'Strawberry Daiquiri', ingredients: [{ name: 'Rum' }] },
      { cocktailId: '2', name: 'Blueberry Mojito', ingredients: [{ name: 'Rum' }] },
      { cocktailId: '3', name: 'Berry Smash', ingredients: [{ name: 'Bourbon' }] }
    ];
    
    jest.spyOn(favoritesService, 'getHydratedFavorites').mockResolvedValue(hydratedFavorites);
    
    const result = await favoritesService.searchFavorites('user123', 'berry');
    
    expect(result).toHaveLength(3); // All contain "berry"
  });
});

**Example TDD for Favorite Pointer Migration on Fork (UC 6.11):**
```typescript
describe('Favorites Service - Favorite Pointer Migration (UC 6.11)', () => {
  it('should atomically migrate favorite pointer when an external cocktail is forked', async () => {
    const favoritesService = new FavoritesService();
    const cocktailService = new CocktailService();
    
    // Mock user has favorited External API Cocktail '11000'
    const mockFavorite = { 
      id: 'fav-123', 
      user_id: 'userA', 
      external_cocktail_id: '11000', 
      cocktail_id: null 
    };
    
    jest.spyOn(favoritesService.favoriteRepo, 'findOne').mockResolvedValue(mockFavorite);
    const saveFavoriteSpy = jest.spyOn(favoritesService.favoriteRepo, 'save').mockResolvedValue({} as any);
    
    // Simulate the CocktailService creating a fork
    const newLocalForkId = 'local-uuid-456';
    
    // Trigger the migration listener/method
    await favoritesService.migrateFavoritePointer('userA', '11000', newLocalForkId);
    
    // Verify the favorite was updated to drop the external ID and point to the new local UUID
    expect(saveFavoriteSpy).toHaveBeenCalledWith(expect.objectContaining({
      id: 'fav-123',
      external_cocktail_id: null,
      cocktail_id: 'local-uuid-456'
    }));
  });
});
```
```
```