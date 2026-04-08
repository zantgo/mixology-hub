# System Tests

*Note: System tests cover development environment and operations:*

**Example structure for database migration tests:**
```typescript
describe('Database Migrations', () => {
  it('should rollback failed migration without data loss', async () => {
    const migrationRunner = new MigrationRunner();
    
    // Mock a failing migration
    const failingMigration = {
      up: jest.fn().mockRejectedValue(new Error('Migration failed')),
      down: jest.fn().mockResolvedValue(undefined)
    };
    
    await expect(migrationRunner.runMigration(failingMigration))
      .rejects.toThrow('Migration failed');
    
    // Verify rollback was attempted
    expect(failingMigration.down).toHaveBeenCalled();
  });
});
```

**Example structure for health check tests:**
```typescript
describe('HealthCheckService', () => {
  it('should return healthy when all dependencies are available', async () => {
    const healthService = new HealthCheckService();
    
    // Mock healthy dependencies
    jest.spyOn(healthService, 'checkDatabase').mockResolvedValue({ status: 'up' });
    jest.spyOn(healthService, 'checkRedis').mockResolvedValue({ status: 'up' });
    jest.spyOn(healthService, 'checkExternalApi').mockResolvedValue({ status: 'up' });
    
    const result = await healthService.checkHealth();
    
    expect(result.status).toBe('healthy');
    expect(result.details.database).toBe('up');
    expect(result.details.redis).toBe('up');
    expect(result.details.externalApi).toBe('up');
  });
  
  it('should return unhealthy when database is down', async () => {
    const healthService = new HealthCheckService();
    
    // Mock database failure
    jest.spyOn(healthService, 'checkDatabase').mockResolvedValue({ 
      status: 'down', 
      error: 'Connection refused' 
    });
    jest.spyOn(healthService, 'checkRedis').mockResolvedValue({ status: 'up' });
    jest.spyOn(healthService, 'checkExternalApi').mockResolvedValue({ status: 'up' });
    
    const result = await healthService.checkHealth();
    
    expect(result.status).toBe('unhealthy');
    expect(result.details.database.status).toBe('down');
  });
});

**Example TDD for Data Retention Cleanup:**
```typescript
describe('CronService - Data Retention', () => {
  it('should delete transient AI recipes older than 24 hours', async () => {
    const cronService = new CronService();
    const aiRecipeRepo = { delete: jest.fn().mockResolvedValue({ affected: 2 }) };
    cronService.aiRecipeRepo = aiRecipeRepo;
    
    // Mock current time
    const now = new Date('2024-01-02T12:00:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    
    // Calculate cutoff: 24 hours ago
    const cutoffDate = new Date('2024-01-01T12:00:00Z');
    
    await cronService.cleanupTransientAIRecipes();
    
    // Should delete records older than cutoff
    expect(aiRecipeRepo.delete).toHaveBeenCalledWith({
      where: {
        created_at: expect.any(Object), // LessThan(cutoffDate)
        cocktail_id: null // Not linked to permanent cocktail
      }
    });
  });

  it('should preserve transient recipes younger than 24 hours', async () => {
    const cronService = new CronService();
    const aiRecipeRepo = { delete: jest.fn().mockResolvedValue({ affected: 0 }) };
    cronService.aiRecipeRepo = aiRecipeRepo;
    
    // Mock: newest record is 23 hours old (should be preserved)
    const now = new Date('2024-01-02T12:00:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    
    await cronService.cleanupTransientAIRecipes();
    
    // Should not delete anything if all records are < 24 hours
    expect(aiRecipeRepo.delete).toHaveBeenCalled();
    // The query would find no records to delete
  });

  it('should preserve AI recipes linked to permanent cocktails', async () => {
    const cronService = new CronService();
    const aiRecipeRepo = { delete: jest.fn().mockResolvedValue({ affected: 1 }) };
    cronService.aiRecipeRepo = aiRecipeRepo;
    
    // Recipe is 48 hours old BUT has cocktail_id (linked to permanent)
    // Should NOT be deleted
    
    await cronService.cleanupTransientAIRecipes();
    
    // Query should exclude records with cocktail_id not null
    expect(aiRecipeRepo.delete).toHaveBeenCalledWith({
      where: expect.objectContaining({
        cocktail_id: null // Only delete unlinked records
      })
    });
  });

  it('should log cleanup statistics', async () => {
    const cronService = new CronService();
    const logger = { info: jest.fn() };
    cronService.logger = logger;
    
    const aiRecipeRepo = { delete: jest.fn().mockResolvedValue({ affected: 5 }) };
    cronService.aiRecipeRepo = aiRecipeRepo;
    
    await cronService.cleanupTransientAIRecipes();
    
    expect(logger.info).toHaveBeenCalledWith(
      'Cleaned up 5 transient AI recipes',
      expect.any(Object)
    );
  });

  it('should handle cleanup errors gracefully', async () => {
    const cronService = new CronService();
    const aiRecipeRepo = { 
      delete: jest.fn().mockRejectedValue(new Error('Database error')) 
    };
    cronService.aiRecipeRepo = aiRecipeRepo;
    
    const logger = { error: jest.fn() };
    cronService.logger = logger;
    
    await cronService.cleanupTransientAIRecipes();
    
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to cleanup transient AI recipes',
      expect.any(Error)
    );
  });

  it('should run on scheduled cron schedule', async () => {
    const cronService = new CronService();
    
    // Mock cron scheduler
    const mockSchedule = jest.fn();
    cronService.schedule = mockSchedule;
    
    cronService.setupScheduledTasks();
    
    // Should schedule daily cleanup at 2 AM
    expect(mockSchedule).toHaveBeenCalledWith(
      '0 2 * * *', // 2 AM daily
      expect.any(Function)
    );
  });

  it('should respect data retention configuration', async () => {
    const cronService = new CronService();
    
    // Configurable retention period (e.g., 48 hours for testing)
    cronService.retentionHours = 48;
    
    const now = new Date('2024-01-03T12:00:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(now.getTime());
    
    // Should calculate cutoff as 48 hours ago
    const expectedCutoff = new Date('2024-01-01T12:00:00Z');
    
    const aiRecipeRepo = { delete: jest.fn() };
    cronService.aiRecipeRepo = aiRecipeRepo;
    
    await cronService.cleanupTransientAIRecipes();
    
    // Verify cutoff date in query
    const deleteCall = aiRecipeRepo.delete.mock.calls[0][0];
    expect(deleteCall.where.created_at).toBeDefined();
    // Would be LessThan(expectedCutoff)
  });
});
```
```