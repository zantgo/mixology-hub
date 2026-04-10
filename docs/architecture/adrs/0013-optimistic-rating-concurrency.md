# ADR 0013: Optimistic Concurrency for Rating Updates to Prevent GDPR Contention

## Status
Accepted

## Context
The rating system uses `SELECT FOR UPDATE` for concurrency control (UC 2.30), which creates severe performance issues during GDPR account deletions:

**The Problem**:
1. **Single Rating**: `SELECT FOR UPDATE` on one row → minimal contention
2. **GDPR Bulk Deletion**: User rated 2,000+ cocktails → `SELECT FOR UPDATE` on 2,000+ rows
3. **Contention**: Massive database locking, blocks all other rating operations
4. **Performance**: Long-running transaction holding locks on many rows
5. **Timeout Risk**: Transaction may exceed PostgreSQL idle timeout

**Example Scenario**:
- User with 2,500 ratings deletes account
- System needs to update 2,500 cocktail rating averages
- Each update uses `SELECT FOR UPDATE` (pessimistic locking)
- Result: 2,500 row locks held for minutes
- Other users cannot rate cocktails during this time

## Decision
Replace pessimistic locking (`SELECT FOR UPDATE`) with **optimistic concurrency control** using atomic SQL updates:

### 1. Atomic Rating Updates
```sql
-- Add new rating (atomic, no locking needed)
UPDATE cocktails 
SET rating = GREATEST(0.00, LEAST(5.00, ((rating * rating_count) + :newRating) / (rating_count + 1))),
    rating_count = rating_count + 1
WHERE id = :cocktailId;

-- Update existing rating (user changing their rating)
UPDATE cocktails 
SET rating = GREATEST(0.00, LEAST(5.00, ((rating * rating_count) - :oldRating + :newRating) / rating_count))
WHERE id = :cocktailId;

-- Remove rating (GDPR deletion)
UPDATE cocktails 
SET rating = CASE 
               WHEN rating_count > 1 THEN GREATEST(0.00, LEAST(5.00, ((rating * rating_count) - :userRating) / (rating_count - 1)))
               ELSE NULL
             END,
    rating_count = CASE 
                      WHEN rating_count > 1 THEN rating_count - 1
                      ELSE 0
                    END
WHERE id = :cocktailId;
```

### 2. Conflict Detection & Retry
```typescript
@Injectable()
export class OptimisticRatingService {
  constructor(
    private readonly connection: Connection,
    private readonly logger: Logger
  ) {}
  
  async updateRatingAtomic(
    cocktailId: string,
    oldRating: number | null,
    newRating: number
  ): Promise<{ success: boolean; retries: number }> {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        if (oldRating === null) {
          // New rating
          const result = await this.connection.query(`
            UPDATE cocktails 
            SET rating = GREATEST(0.00, LEAST(5.00, ((COALESCE(rating, 0) * rating_count) + $1) / (rating_count + 1))),
                rating_count = rating_count + 1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING rating, rating_count
          `, [newRating, cocktailId]);
          
          if (result.rowCount === 0) {
            throw new Error('Cocktail not found');
          }
        } else {
          // Update existing rating
          const result = await this.connection.query(`
            UPDATE cocktails 
            SET rating = GREATEST(0.00, LEAST(5.00, ((rating * rating_count) - $1 + $2) / rating_count)),
                updated_at = NOW()
            WHERE id = $3
              AND rating_count > 0  -- Safety check
            RETURNING rating, rating_count
          `, [oldRating, newRating, cocktailId]);
          
          if (result.rowCount === 0) {
            // Concurrent modification or cocktail deleted
            throw new ConcurrentModificationError('Rating concurrently modified');
          }
        }
        
        return { success: true, retries };
        
      } catch (error) {
        retries++;
        
        if (retries > maxRetries) {
          this.logger.error('Max retries exceeded for rating update', {
            cocktailId, oldRating, newRating, error: error.message
          });
          return { success: false, retries };
        }
        
        // Exponential backoff
        await this.sleep(Math.pow(2, retries) * 50); // 50ms, 100ms, 200ms
        
        // Refresh data for retry
        const current = await this.getCurrentRating(cocktailId);
        oldRating = current.userRating; // Get latest for retry
      }
    }
    
    return { success: false, retries };
  }
}
```

### 3. GDPR Bulk Processing
```typescript
@Injectable()
export class GdprRatingRecalculationService {
  constructor(
    private readonly connection: Connection,
    private readonly logger: Logger,
    private readonly metrics: MetricsService
  ) {}
  
  async recalculateRatingsForUser(
    userId: string,
    batchSize: number = 100
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;
    
    // Get all ratings for user
    const userRatings = await this.getUserRatings(userId);
    const total = userRatings.length;
    
    this.logger.info(`Starting GDPR rating recalculation`, {
      userId, totalRatings: total, batchSize
    });
    
    // Process in batches
    for (let i = 0; i < total; i += batchSize) {
      const batch = userRatings.slice(i, i + batchSize);
      const batchResults = await this.processBatch(batch);
      
      processed += batchResults.processed;
      failed += batchResults.failed;
      
      // Progress tracking
      const progress = Math.round(((i + batch.length) / total) * 100);
      this.metrics.recordGdprRecalculationProgress(userId, progress);
      
      this.logger.debug(`GDPR batch processed`, {
        userId, batch: i / batchSize + 1, progress: `${progress}%`,
        processed: batchResults.processed, failed: batchResults.failed
      });
      
      // Small delay between batches to reduce load
      if (i + batchSize < total) {
        await this.sleep(100);
      }
    }
    
    this.logger.info(`GDPR rating recalculation completed`, {
      userId, total, processed, failed, successRate: `${(processed / total * 100).toFixed(1)}%`
    });
    
    return { processed, failed };
  }
  
  private async processBatch(
    ratings: Array<{ cocktailId: string; rating: number }>
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;
    
    // Use Promise.all for parallel processing within batch
    const results = await Promise.allSettled(
      ratings.map(rating => this.updateRatingForDeletion(rating))
    );
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.success) {
        processed++;
      } else {
        failed++;
        this.logger.warn('Failed to update rating in GDPR batch', {
          error: result.status === 'rejected' ? result.reason.message : 'Unknown error'
        });
      }
    });
    
    return { processed, failed };
  }
  
  private async updateRatingForDeletion(
    rating: { cocktailId: string; rating: number }
  ): Promise<{ success: boolean }> {
    try {
       const result = await this.connection.query(`
        UPDATE cocktails 
        SET rating = CASE 
                       WHEN rating_count > 1 THEN 
                         GREATEST(0.00, LEAST(5.00, ((rating * rating_count) - $1) / (rating_count - 1)))
                       ELSE NULL
                     END,
            rating_count = CASE 
                              WHEN rating_count > 1 THEN rating_count - 1
                              ELSE 0
                            END,
            updated_at = NOW()
        WHERE id = $2
        RETURNING rating, rating_count
      `, [rating.rating, rating.cocktailId]);
      
      return { success: result.rowCount === 1 };
    } catch (error) {
      this.logger.error('Error in GDPR rating update', {
        cocktailId: rating.cocktailId, error: error.message
      });
      return { success: false };
    }
  }
}
```

## Consequences

### Positive
- **No Contention**: Eliminates `SELECT FOR UPDATE` row locking
- **Scalability**: Handles GDPR deletions of 10,000+ ratings
- **Performance**: Atomic updates are faster than lock/update/release
- **Parallelism**: Can process batches in parallel
- **Resilience**: Retry logic handles concurrent modifications
- **Monitoring**: Progress tracking for large operations

### Negative
- **Retry Complexity**: Need to handle concurrent updates gracefully
- **Data Consistency**: Slightly more complex than pessimistic locking
- **Implementation Effort**: More code than simple `SELECT FOR UPDATE`
- **Edge Cases**: Need to handle division by zero, NULL ratings
- **Boundary Enforcement Risk**: Precision drift (ADR 0015) combined with GDPR rating subtraction may violate 0-5 bounds
  - **Senior Architectural Decision: Boundary Enforcement on GDPR Rating Deductions**
  - **Explicit Trade-off:** Because we accept precision drift in ratings (ADR 0015), mathematical subtractions during GDPR deletions risk violating the 0-5 boundary constraints. We dictate that all rating subtraction queries MUST wrap the calculation in `GREATEST(0, LEAST(5, new_value))`. We accept that heavily drifted cocktails may temporarily peg to exactly 0 or 5 until the nightly recalibration cron job corrects them, prioritizing successful GDPR compliance execution over temporary UI accuracy.

  - **Senior Architectural Decision: Temporary Rating Corruption Post-GDPR Deletion**
  - **Explicit Trade-off:** Because we accept precision drift in running averages (ADR 0015), applying reverse-mathematics during a GDPR bulk deletion (subtracting a rating) will exponentially amplify floating-point errors, potentially pushing cocktails mathematically out of the 0-5 bounds. We explicitly accept that heavily drifted cocktails will be clamped to exactly 0.00 or 5.00, rendering them temporarily inaccurate. We trade immediate UI accuracy for the performance of batch GDPR deletions, relying entirely on the Nightly Recalibration Cron Job to heal the corrupted averages.

  - **Senior Architectural Decision: Bifurcated GDPR Rating Recalculation**
  - **Explicit Trade-off:** Because external API cocktails use a shadow table for ratings to prevent local database pollution (UC 2.30), the GdprRatingRecalculationService cannot blindly run UPDATE cocktails for all user ratings. We explicitly mandate that the GDPR rating worker must bifurcate its logic: it must inspect the cocktail ID format (UUID vs String/Integer) and route the recalculation to either the local cocktails table or the EXTERNAL_COCKTAIL_RATINGS table. We accept the slight performance penalty of this conditional routing to ensure the GDPR batch processor does not crash when attempting to recalculate external public ratings.

## Migration Strategy

### Phase 1: Dual Implementation
1. Implement optimistic service alongside existing pessimistic one
2. Feature flag to switch between implementations
3. Run both in parallel, compare results

### Phase 2: Gradual Rollout
1. Enable optimistic for low-traffic endpoints first
2. Monitor for consistency issues
3. Gradually increase traffic to optimistic implementation

### Phase 3: Full Cutover
1. Disable pessimistic implementation
2. Remove `SELECT FOR UPDATE` code
3. Update all documentation

### Phase 4: Optimization
1. Add batch size tuning based on monitoring
2. Implement circuit breaker for retry storms
3. Add more granular metrics

## Monitoring & Alerting

### Key Metrics
```typescript
interface RatingMetrics {
  update_success_rate: number; // % of successful updates
  retry_count_avg: number; // Average retries per update
  concurrent_conflict_rate: number; // % of updates with conflicts
  gdpr_batch_duration_p95: number; // 95th percentile batch time
  gdpr_progress_rate: number; // Ratings processed per minute
}
```

### Critical Alerts
1. **Update Success Rate < 95%**: Rating system issues
2. **Average Retries > 2**: High contention detected
3. **GDPR Batch Duration > 5min**: Performance degradation
4. **Concurrent Conflict Rate > 10%**: Need for tuning

## Performance Comparison

### Pessimistic Locking (Current)
```
Single rating: 50ms
GDPR (2,500 ratings): 2,500 × 50ms = 125 seconds
Contention: Blocks all other rating operations
```

### Optimistic Concurrency (New)
```
Single rating: 20ms (60% faster)
GDPR (2,500 ratings): 25 batches × 100ms = 2.5 seconds
Contention: No blocking, parallel batch processing
```

## Fallback Plan
If issues arise:
1. **Immediate**: Re-enable pessimistic locking via feature flag
2. **Data**: Use database triggers as fallback for consistency
3. **Monitoring**: Enhanced logging to diagnose issues
4. **Rollback**: Revert code changes if necessary

## Related Decisions
- UC 2.30: Rating a Cocktail
- UC 9.22: Recalculating Ratings on GDPR Account Deletion
- ADR 0001: Use PostgreSQL for Inventory Management
- UC 4.3: Preventing Negative Inventory via Concurrent Requests

## Testing Strategy

### Unit Tests
```typescript
describe('OptimisticRatingService', () => {
  it('should handle concurrent updates with retry', async () => {
    // Simulate two concurrent updates
    const update1 = service.updateRatingAtomic('cocktail-1', null, 5);
    const update2 = service.updateRatingAtomic('cocktail-1', null, 4);
    
    const results = await Promise.all([update1, update2]);
    
    // One should succeed, one should retry
    expect(results.filter(r => r.success).length).toBe(2);
    expect(results.some(r => r.retries > 0)).toBe(true);
  });
});
```

### Load Tests
```typescript
describe('GDPR Bulk Processing Load Test', () => {
  it('should process 10,000 ratings in under 30 seconds', async () => {
    const start = Date.now();
    const result = await gdprService.recalculateRatingsForUser(
      'user-with-10000-ratings',
      500 // Large batch size
    );
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(30000); // 30 seconds
    expect(result.processed).toBe(10000);
    expect(result.failed).toBe(0);
  });
});
```

### Consistency Tests
```typescript
describe('Rating Consistency', () => {
  it('should maintain exact average after 100 concurrent updates', async () => {
    const cocktailId = 'test-cocktail';
    const initial = { rating: null, rating_count: 0 };
    
    // Simulate 100 users rating simultaneously
    const updates = Array.from({ length: 100 }, (_, i) => 
      service.updateRatingAtomic(cocktailId, null, (i % 5) + 1)
    );
    
    await Promise.all(updates);
    
    const final = await getCocktailRating(cocktailId);
    
    // Calculate expected average
    const ratings = Array.from({ length: 100 }, (_, i) => (i % 5) + 1);
    const expectedAvg = ratings.reduce((a, b) => a + b, 0) / 100;
    
    expect(final.rating).toBeCloseTo(expectedAvg, 4); // 4 decimal places
    expect(final.rating_count).toBe(100);
  });
});
```