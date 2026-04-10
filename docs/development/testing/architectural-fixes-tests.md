# 🧪 Testing Architectural Fixes

This document outlines test cases for the architectural fixes implemented to resolve critical inconsistencies in MixologyHub.

## 📋 Test Categories

### 1. Database Schema & Entity Tests

#### 1.1 Ingredient Entity Updates
```typescript
describe('Ingredient Entity', () => {
  it('should automatically normalize name on insert', async () => {
    const ingredient = ingredientRepository.create({
      name: '  Vodka  ',
      isGlobal: true,
    });
    await ingredientRepository.save(ingredient);
    
    expect(ingredient.normalizedName).toBe('VODKA');
  });

  it('should map to the same ingredient ID when different users create a custom ingredient with the same name', async () => {
    const user1 = await createTestUser();
    const user2 = await createTestUser();
    
    // First user creates the ingredient
    const result1 = await ingredientService.findOrCreate('Secret Sauce', user1.id);
    
    // Second user should get the same ingredient ID (UPSERT behavior)
    const result2 = await ingredientService.findOrCreate('Secret Sauce', user2.id);
    
    // Both users should be mapped to the exact same database row (UUID)
    expect(result1.id).toBe(result2.id);
    expect(result1.normalizedName).toBe('SECRET SAUCE');
    expect(result2.normalizedName).toBe('SECRET SAUCE');
    expect(result1.isGlobal).toBe(false);
    expect(result2.isGlobal).toBe(false);
  });

  it('should prevent duplicate global ingredient names', async () => {
    const ingredient1 = ingredientRepository.create({
      name: 'Vodka',
      isGlobal: true,
      normalizedName: 'VODKA',
    });
    
    const ingredient2 = ingredientRepository.create({
      name: 'Vodka',
      isGlobal: true,
      normalizedName: 'VODKA',
    });
    
    await ingredientRepository.save(ingredient1);
    await expect(ingredientRepository.save(ingredient2)).rejects.toThrow();
  });
});
```

#### 1.2 Cocktail Entity Updates
```typescript
describe('Cocktail Entity', () => {
  it('should support soft delete with is_deleted flag', async () => {
    const cocktail = cocktailRepository.create({
      name: 'Test Cocktail',
      is_deleted: false,
    });
    await cocktailRepository.save(cocktail);
    
    // Soft delete
    cocktail.is_deleted = true;
    await cocktailRepository.save(cocktail);
    
    const found = await cocktailRepository.findOne({
      where: { id: cocktail.id, is_deleted: false },
    });
    expect(found).toBeNull();
  });

  it('should not return deleted cocktails in default queries', async () => {
    const deletedCocktail = cocktailRepository.create({
      name: 'Deleted Cocktail',
      is_deleted: true,
    });
    await cocktailRepository.save(deletedCocktail);
    
    const activeCocktails = await cocktailRepository.find();
    expect(activeCocktails).not.toContainEqual(
      expect.objectContaining({ name: 'Deleted Cocktail' })
    );
  });
});
```

#### 1.3 CocktailIngredient Precision
```typescript
describe('CocktailIngredient Precision', () => {
  it('should store fractional amounts with 4 decimal places', async () => {
    const ingredient = cocktailIngredientRepository.create({
      amount: 0.3333, // 1/3
      unit: 'oz',
    });
    await cocktailIngredientRepository.save(ingredient);
    
    const found = await cocktailIngredientRepository.findOne({
      where: { id: ingredient.id },
    });
    expect(found.amount).toBe(0.3333);
  });

  it('should correctly scale fractional amounts', async () => {
    const originalAmount = 0.3333; // 1/3
    const scaleFactor = 10000;
    const expected = 3333.3333; // 0.3333 * 10000
    
    const scaledAmount = originalAmount * scaleFactor;
    expect(scaledAmount).toBeCloseTo(expected, 4);
  });
});
```

### 2. Sync Service Tests (Item-Level Idempotency)

#### 2.1 Sync Operation Processing
```typescript
describe('SyncService', () => {
  let syncService: SyncService;
  let user: User;

  beforeEach(async () => {
    syncService = module.get<SyncService>(SyncService);
    user = await createTestUser();
  });

  it('should process operations with item-level idempotency', async () => {
    const operationDto: SyncOperationDto = {
      clientOperationId: 'test-op-1',
      operationType: SyncOperationType.INVENTORY_UPDATE,
      payload: { ingredientId: '123', amountChange: "100", unit: 'ml' }, // Enforcing string boundaries for Decimal.js
      deviceTimestamp: new Date(),
    };

    // First attempt
    const result1 = await syncService.processSyncOperations(user, [operationDto]);
    expect(result1[0].status).toBe(SyncOperationStatus.SYNCED);

    // Duplicate attempt with same clientOperationId
    const result2 = await syncService.processSyncOperations(user, [operationDto]);
    expect(result2[0].status).toBe(SyncOperationStatus.SYNCED);
    expect(result2[0].id).toBe(result1[0].id); // Same record
  });

  it('should handle partial success in batch operations', async () => {
    const operations: SyncOperationDto[] = [
      {
        clientOperationId: 'op-1',
        operationType: SyncOperationType.INVENTORY_UPDATE,
        payload: { ingredientId: 'valid-id', amountChange: "100", unit: 'ml' }, // String serialization
        deviceTimestamp: new Date(),
      },
      {
        clientOperationId: 'op-2',
        operationType: SyncOperationType.INVENTORY_UPDATE,
        payload: { ingredientId: 'invalid-id', amountChange: "-100", unit: 'ml' }, // Will fail, string serialization
        deviceTimestamp: new Date(),
      },
      {
        clientOperationId: 'op-3',
        operationType: SyncOperationType.INVENTORY_UPDATE,
        payload: { ingredientId: 'valid-id-2', amountChange: "50", unit: 'ml' }, // String serialization
        deviceTimestamp: new Date(),
      },
    ];

    const results = await syncService.processSyncOperations(user, operations);
    
    expect(results[0].status).toBe(SyncOperationStatus.SYNCED);
    expect(results[1].status).toBe(SyncOperationStatus.FAILED);
    expect(results[2].status).toBe(SyncOperationStatus.SYNCED);
  });

  it('should retry failed operations', async () => {
    const operationDto: SyncOperationDto = {
      clientOperationId: 'failed-op',
      operationType: SyncOperationType.INVENTORY_UPDATE,
      payload: { ingredientId: 'will-fail', amountChange: "100", unit: 'ml' }, // String serialization
      deviceTimestamp: new Date(),
    };

    // First attempt fails
    const result1 = await syncService.processSyncOperations(user, [operationDto]);
    expect(result1[0].status).toBe(SyncOperationStatus.FAILED);

    // Retry
    const retryResult = await syncService.retryFailedOperation(
      user,
      result1[0].id
    );
    expect(retryResult.status).toBe(SyncOperationStatus.SYNCED);
  });
});
```

### 3. Redis Pub/Sub Tests (Token Salt Bottleneck Fix)

#### 3.1 Token Salt Version Management
```typescript
describe('RedisPubSubService', () => {
  let redisPubSubService: RedisPubSubService;
  let mockRedisClient: any;

  beforeEach(async () => {
    redisPubSubService = module.get<RedisPubSubService>(RedisPubSubService);
    
    // Mock Redis client methods
    mockRedisClient = {
      get: jest.fn().mockResolvedValue('5'),
      incr: jest.fn().mockResolvedValue(6),
      publish: jest.fn().mockResolvedValue(1),
      subscribe: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('should increment and broadcast token salt version', async () => {
    const newVersion = await redisPubSubService.incrementTokenSaltVersion('admin-123');
    
    expect(newVersion).toBe(6);
    expect(mockRedisClient.incr).toHaveBeenCalledWith('global_token_salt_version');
    expect(mockRedisClient.publish).toHaveBeenCalledWith(
      RedisChannel.TOKEN_SALT_UPDATE,
      expect.stringContaining('"saltVersion":6')
    );
  });

  it('should update local cache on token salt update message', async () => {
    const updateMessage = JSON.stringify({
      saltVersion: 7,
      timestamp: new Date().toISOString(),
      initiatedBy: 'admin-123',
    });

    // Simulate receiving pub/sub message
    await redisPubSubService['handleTokenSaltUpdate'](updateMessage);
    
    const currentVersion = await redisPubSubService.getCurrentTokenSaltVersion();
    expect(currentVersion).toBe(7);
  });
});
```

### 4. Rating Service Tests (External Cocktail Auto-Forking)

#### 4.1 Rating External Cocktails
```typescript
describe('RatingService', () => {
  let ratingService: RatingService;
  let externalCocktailService: ExternalCocktailService;
  let cocktailRepository: Repository<Cocktail>;

  beforeEach(async () => {
    ratingService = module.get<RatingService>(RatingService);
    externalCocktailService = module.get<ExternalCocktailService>(ExternalCocktailService);
    cocktailRepository = module.get(getRepositoryToken(Cocktail));
  });

  it('should auto-fork external cocktail when rating', async () => {
    const user = await createTestUser();
    const externalCocktailId = '11000'; // Mojito from TheCocktailDB
    
    // Mock external service response
    jest.spyOn(externalCocktailService, 'getCocktailById').mockResolvedValue({
      id: externalCocktailId,
      name: 'Mojito',
      description: 'Classic Cuban cocktail',
      instructions: 'Mix ingredients...',
      imageUrl: 'https://example.com/mojito.jpg',
    });

    const ratingDto: RatingDto = { score: 5 };
    
    // This should trigger auto-forking
    const result = await ratingService.rateCocktail(user, externalCocktailId, ratingDto);
    
    expect(result.userRating).toBe(5);
    
    // Check that cocktail was forked locally
    const forkedCocktail = await cocktailRepository.findOne({
      where: { external_id: externalCocktailId, user: { id: user.id } },
    });
    
    expect(forkedCocktail).toBeDefined();
    expect(forkedCocktail.name).toBe('Mojito');
    expect(forkedCocktail.source).toBe('api');
    expect(forkedCocktail.is_public).toBe(false); // Private to user who forked it
  });

  it('should not allow rating non-existent external cocktail', async () => {
    const user = await createTestUser();
    
    jest.spyOn(externalCocktailService, 'getCocktailById').mockResolvedValue(null);
    
    const ratingDto: RatingDto = { score: 5 };
    
    await expect(
      ratingService.rateCocktail(user, 'non-existent-id', ratingDto)
    ).rejects.toThrow('Cocktail not found');
  });
});
```

### 5. Pagination Tests (Unified Search Optimization)

#### 5.1 Optimized Pagination with Redis Caching
```typescript
describe('CocktailAggregatorService Pagination', () => {
  let aggregatorService: CocktailAggregatorService;
  let cacheManager: Cache;

  beforeEach(async () => {
    aggregatorService = module.get<CocktailAggregatorService>(CocktailAggregatorService);
    cacheManager = module.get<CACHE_MANAGER>(CACHE_MANAGER);
  });

  it('should cache search results for pagination', async () => {
    const searchTerm = 'margarita';
    const paginationQuery: PaginationQueryDto = { limit: 10, offset: 0 };
    
    // First search - should cache results
    const result1 = await aggregatorService.searchUnified(
      searchTerm,
      paginationQuery,
      { includeExternal: true, includeLocal: true }
    );
    
    expect(result1.data.length).toBeGreaterThan(0);
    
    // Check that results were cached
    const cacheKey = aggregatorService['generateSearchCacheKey'](
      searchTerm,
      { includeExternal: true, includeLocal: true },
      undefined
    );
    
    const cached = await cacheManager.get(`pagination:${cacheKey}`);
    expect(cached).toBeDefined();
    expect(cached.unifiedList.length).toBe(result1.total);
  });

  it('should use cursor-like pagination for subsequent pages', async () => {
    const searchTerm = 'margarita';
    
    // Page 1
    const result1 = await aggregatorService.searchUnified(
      searchTerm,
      { limit: 5, offset: 0 },
      { includeExternal: true, includeLocal: true }
    );
    
    expect(result1.data.length).toBe(5);
    const lastIdPage1 = result1.data[result1.data.length - 1].id;
    
    // Page 2 - should use cached results with lastId
    const result2 = await aggregatorService.searchUnified(
      searchTerm,
      { limit: 5, offset: 5 },
      { includeExternal: true, includeLocal: true }
    );
    
    expect(result2.data.length).toBe(5);
    expect(result2.data[0].id).not.toBe(lastIdPage1); // Should be next set of results
  });

  it('should handle cache invalidation on data changes', async () => {
    const searchTerm = 'margarita';
    const cacheKey = aggregatorService['generateSearchCacheKey'](
      searchTerm,
      { includeExternal: true, includeLocal: true },
      undefined
    );
    
    // Prime cache
    await aggregatorService.searchUnified(
      searchTerm,
      { limit: 10, offset: 0 },
      { includeExternal: true, includeLocal: true }
    );
    
    // Simulate data change that should invalidate cache
    await cacheManager.del(`pagination:${cacheKey}`);
    
    // Subsequent search should fetch fresh data
    const result = await aggregatorService.searchUnified(
      searchTerm,
      { limit: 10, offset: 0 },
      { includeExternal: true, includeLocal: true }
    );
    
    expect(result.data.length).toBeGreaterThan(0);
  });
});
```

### 6. Integration Tests

#### 6.1 End-to-End Sync Flow
```typescript
describe('End-to-End Sync Flow', () => {
  it('should complete full offline sync cycle with delta updates', async () => {
    // 1. User offline: queue delta operations
    const offlineOperations: SyncOperationDto[] = [
      {
        clientOperationId: 'offline-1',
        operationType: SyncOperationType.INVENTORY_UPDATE,
        payload: { ingredientId: 'vodka', amountChange: "-50", unit: 'ml' }, // String serialization enforced to prevent IEEE 754 corruption
        deviceTimestamp: new Date('2024-01-01T10:00:00Z'),
      },
      {
        clientOperationId: 'offline-2',
        operationType: SyncOperationType.COCKTAIL_RATING,
        payload: { cocktailId: 'mojito', score: 5 },
        deviceTimestamp: new Date('2024-01-01T10:05:00Z'),
      },
    ];

    // 2. Setup initial inventory
    const user = await createTestUser();
    await inventoryService.updateUserInventory(user.id, {
      ingredientId: 'vodka',
      quantity: 550,
      unit: 'ml'
    });
    
    // 3. User comes online: sync delta operations
    const syncResults = await syncService.processSyncOperations(user, offlineOperations);
    
    // 4. Verify all operations processed
    expect(syncResults).toHaveLength(2);
    expect(syncResults[0].status).toBe(SyncOperationStatus.SYNCED);
    expect(syncResults[1].status).toBe(SyncOperationStatus.SYNCED);
    
    // 5. Verify delta was applied correctly (550 - 50 = 500)
    const inventory = await inventoryService.getUserInventory(user.id);
    expect(inventory).toContainEqual(
      expect.objectContaining({ ingredientId: 'vodka', quantity: 500 })
    );
    
    const rating = await ratingService.getUserRating(user.id, 'mojito');
    expect(rating).toBe(5);
  });
});
```

## 🚀 Running Tests

### Backend Tests
```bash
cd backend
npm test -- architectural-fixes
```

### Specific Test Suites
```bash
# Database schema tests
npm test -- --testPathPattern="ingredient.*entity"

# Sync service tests  
npm test -- --testPathPattern="sync.*service"

# Redis tests
npm test -- --testPathPattern="redis.*pubsub"

# Rating service tests
npm test -- --testPathPattern="rating.*service"

# Pagination tests
npm test -- --testPathPattern="aggregator.*pagination"
```

### Coverage Report
```bash
npm run test:cov -- --testPathPattern="architectural"
```

## 📊 Test Coverage Goals

| Component | Target Coverage | Critical Paths |
|-----------|----------------|----------------|
| Database Entities | 95% | Normalization, constraints, soft delete |
| Sync Service | 90% | Idempotency, batch processing, retry logic |
| Redis Pub/Sub | 85% | Token salt updates, cache invalidation |
| Rating Service | 90% | Auto-forking, validation, error handling |
| Pagination Logic | 85% | Caching, cursor-based pagination, cache invalidation |

## 🔧 Test Data Setup

Create test data using the provided fixtures:

```typescript
// test/fixtures/architectural-fixes.fixtures.ts
export const createTestUser = async (): Promise<User> => {
  return userRepository.create({
    email: `test-${Date.now()}@example.com`,
    password: 'hashed-password',
  });
};

export const createTestIngredient = async (options: {
  name: string;
  isGlobal?: boolean;
  createdBy?: string;
}): Promise<Ingredient> => {
  return ingredientRepository.create({
    name: options.name,
    isGlobal: options.isGlobal ?? true,
    normalizedName: options.name.toUpperCase().trim(),
    createdBy: options.createdBy,
  });
};
```

## 🐛 Common Test Issues & Solutions

1. **Redis Connection Issues**: Use `redis-mock` or test containers
2. **Database Cleanup**: Use transactions or truncate tables between tests
3. **External API Mocks**: Mock all external API calls
4. **Timing Issues**: Use fake timers for time-sensitive operations
5. **Concurrency Tests**: Use `Promise.all` to test race conditions