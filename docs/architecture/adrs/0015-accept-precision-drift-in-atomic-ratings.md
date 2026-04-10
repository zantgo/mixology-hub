# ADR 0015: Accept Precision Drift in Atomic Ratings for O(1) Performance

## Status
Accepted

## Context
ADR 0013 introduces atomic SQL updates for ratings to avoid `SELECT FOR UPDATE` locking during GDPR deletions. The formula used is:

```sql
UPDATE cocktails 
SET rating = ((rating * rating_count) + :newRating) / (rating_count + 1),
    rating_count = rating_count + 1
WHERE id = :cocktailId;
```

**The Hidden Trade-off**: Continuously updating an average using a running formula over thousands of iterations with `decimal(3,2)` will result in **IEEE 754 precision drift**. Over time, the cached average will mathematically deviate from the true `SUM(score)/COUNT(*)` of the `user_ratings` pivot table.

### The Precision Drift Problem
1. **Mathematical Reality**: Running averages accumulate floating-point errors
2. **Scale**: Popular cocktails with 10,000+ ratings will experience measurable drift
3. **Data Type**: `decimal(3,2)` has limited precision (3 digits total, 2 decimal places)
4. **Business Impact**: Displayed rating (e.g., 4.25) may differ from true average (e.g., 4.26)

### Example Drift Calculation
```sql
-- After 10,000 ratings using running average:
SELECT rating FROM cocktails WHERE id = 'popular-cocktail'; -- Returns 4.25

 -- True average from pivot table:
SELECT AVG(score) FROM cocktail_ratings WHERE cocktail_id = 'popular-cocktail'; -- Returns 4.26

-- Drift: 0.01 points (statistically significant for ranking)
```

## Decision
We explicitly **accept minor decimal drift** for high-volume cocktails to achieve O(1) performance, and implement a nightly Cron job that recalculates exact averages using `SUM/COUNT` to silently correct the drift.

### 1. Accept the Trade-off
- **Performance Benefit**: O(1) atomic updates vs O(n) recalculations
- **Acceptable Drift**: ≤ 0.05 points for business purposes
- **Silent Correction**: Nightly recalibration without user visibility
- **Monitoring**: Track drift magnitude and alert if excessive

### 2. Nightly Recalibration Job
```typescript
@Injectable()
export class RatingRecalibrationService {
  constructor(
    private readonly connection: Connection,
    private readonly logger: Logger,
    private readonly metrics: MetricsService
  ) {}

  async recalculateAllRatings(): Promise<{
    processed: number;
    corrected: number;
    maxDrift: number;
    avgDrift: number;
  }> {
    const startTime = Date.now();
    let processed = 0;
    let corrected = 0;
    let totalDrift = 0;
    let maxDrift = 0;

    // Get all cocktails with ratings
    const cocktails = await this.connection.query(`
      SELECT id, rating, rating_count
      FROM cocktails 
      WHERE rating_count > 0
      ORDER BY rating_count DESC
    `);

    for (const cocktail of cocktails) {
      processed++;
      
      // Calculate true average from pivot table
      const trueAverage = await this.calculateTrueAverage(cocktail.id);
      
      if (trueAverage === null) {
        continue; // No ratings or cocktail deleted
      }

      // Calculate drift
      const drift = Math.abs(cocktail.rating - trueAverage);
      totalDrift += drift;
      maxDrift = Math.max(maxDrift, drift);

      // Correct if drift exceeds threshold
      if (drift > 0.01) { // 0.01 point threshold
        corrected++;
        
        await this.connection.query(`
          UPDATE cocktails 
          SET rating = $1,
              rating_recalibrated_at = NOW()
          WHERE id = $2
        `, [trueAverage, cocktail.id]);

        this.logger.debug('Rating recalibrated', {
          cocktailId: cocktail.id,
          oldRating: cocktail.rating,
          newRating: trueAverage,
          drift: drift.toFixed(4),
          ratingCount: cocktail.rating_count
        });
      }

      // Progress tracking for large datasets
      if (processed % 1000 === 0) {
        this.metrics.recordRecalibrationProgress(
          processed / cocktails.length * 100
        );
      }
    }

    const avgDrift = processed > 0 ? totalDrift / processed : 0;
    const duration = Date.now() - startTime;

    this.logger.info('Rating recalibration completed', {
      processed,
      corrected,
      maxDrift: maxDrift.toFixed(4),
      avgDrift: avgDrift.toFixed(4),
      durationMs: duration,
      ratePerSecond: (processed / (duration / 1000)).toFixed(1)
    });

    this.metrics.recordRecalibrationSummary({
      processed,
      corrected,
      maxDrift,
      avgDrift,
      duration
    });

    return { processed, corrected, maxDrift, avgDrift };
  }

  private async calculateTrueAverage(cocktailId: string): Promise<number | null> {
      const result = await this.connection.query(`
      SELECT 
        AVG(score) as true_avg,
        COUNT(*) as count
      FROM cocktail_ratings 
      WHERE cocktail_id = $1
    `, [cocktailId]);

    if (result.rows.length === 0 || result.rows[0].count === 0) {
      return null;
    }

    return parseFloat(result.rows[0].true_avg);
  }
}
```

### 3. Scheduled Execution (Cron Job)
```typescript
// NestJS scheduler
@Cron('0 3 * * *') // 3 AM daily
export class RatingRecalibrationCron {
  constructor(
    private readonly recalibrationService: RatingRecalibrationService,
    private readonly logger: Logger
  ) {}

  async handleCron() {
    this.logger.info('Starting nightly rating recalibration');
    
    try {
      const result = await this.recalibrationService.recalculateAllRatings();
      
      // Alert if drift is excessive
      if (result.maxDrift > 0.1) {
        this.alertExcessiveDrift(result);
      }
      
      this.logger.info('Nightly rating recalibration completed', result);
    } catch (error) {
      this.logger.error('Rating recalibration failed', {
        error: error.message,
        stack: error.stack
      });
      
      // Retry logic
      await this.retryWithBackoff();
    }
  }
  
  private async retryWithBackoff() {
    const maxRetries = 3;
    
    for (let i = 1; i <= maxRetries; i++) {
      await this.sleep(Math.pow(2, i) * 1000); // Exponential backoff
      
      try {
        await this.recalibrationService.recalculateAllRatings();
        this.logger.info('Recalibration succeeded on retry', { attempt: i });
        return;
      } catch (error) {
        this.logger.warn(`Recalibration retry ${i} failed`, {
          error: error.message
        });
      }
    }
    
    this.logger.error('All recalibration retries failed');
  }
}
```

### 4. Database Schema Enhancement
```sql
-- Add tracking column to cocktails table
ALTER TABLE cocktails 
ADD COLUMN rating_recalibrated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN rating_drift_last_measured DECIMAL(4,3);

-- Add CHECK constraint to prevent compounding drift from pushing ratings out of bounds
ALTER TABLE cocktails
ADD CONSTRAINT rating_bounds_check 
CHECK (rating >= 0.00 AND rating <= 5.00);

-- Index for efficient recalibration
CREATE INDEX idx_cocktails_rating_count_desc 
ON cocktails(rating_count DESC) 
WHERE rating_count > 0;

-- Materialized view for monitoring
CREATE MATERIALIZED VIEW rating_drift_monitoring AS
SELECT 
  c.id as cocktail_id,
  c.name,
  c.rating as cached_rating,
  c.rating_count,
  c.rating_recalibrated_at,
  AVG(ur.score) as true_average,
  ABS(c.rating - AVG(ur.score)) as current_drift
 FROM cocktails c
JOIN cocktail_ratings ur ON c.id = ur.cocktail_id
WHERE c.rating_count > 0
GROUP BY c.id, c.name, c.rating, c.rating_count, c.rating_recalibrated_at
HAVING ABS(c.rating - AVG(ur.score)) > 0.01
ORDER BY current_drift DESC;
```

## Consequences

### Positive
- **O(1) Performance**: Atomic updates maintain sub-millisecond response times
- **Scalability**: Handles millions of ratings without degradation
- **Accuracy**: Nightly correction ensures long-term data integrity
- **Transparency**: Explicit trade-off documented and monitored
- **Business Alignment**: Minor drift (≤ 0.05) acceptable for user experience

### Negative
- **Implementation Complexity**: Additional service and cron job
- **Database Load**: Nightly recalibration consumes resources
- **Temporal Inconsistency**: Ratings may be slightly off during day
- **Monitoring Overhead**: Need to track drift metrics
- **Storage**: Additional columns and materialized view
- **Compounding Drift Risk**: Applying delta updates (subtracting oldRating + adding newRating) to an already drifted average mathematically amplifies floating-point errors
  - **Senior Architectural Decision: Compounding Drift on Rating Updates**
  - **Explicit Trade-off:** We acknowledge that applying Delta updates (subtracting an old rating and adding a new one) to an already drifted running average mathematically compounds floating-point errors. We accept this temporary mathematical invalidity to achieve O(1) database performance.
  - **Mitigation:** A database `CHECK (rating >= 0.00 AND rating <= 5.00)` constraint will be added to the cocktails table. If compounding drift attempts to push the rating out of bounds, the transaction will fail, triggering an immediate synchronous recalculation for that specific cocktail.
  - **Senior Architectural Decision: Silent Clamping vs. Constraint Crashing for Ratings**
  - **Explicit Trade-off:** We explicitly choose to keep the `GREATEST(0.00, LEAST(5.00, ...))` clamping in our atomic SQL updates (ADR 0013) rather than allowing the database `CHECK` constraint to fail. We accept that heavily drifted cocktails will silently peg to exactly 0.00 or 5.00 during GDPR bulk deletions. We trade temporary UI inaccuracy for absolute batch-processing stability, avoiding the cascading transaction failures and performance hits that synchronous recalculations would cause. The pegged values will remain slightly inaccurate until the Nightly Recalibration Cron Job automatically heals them.

### Risk Mitigation

#### 1. Performance Impact
```typescript
// Run during low-traffic hours (3 AM)
@Cron('0 3 * * *') // Minimal user impact

// Batch processing with throttling
const BATCH_SIZE = 1000;
const DELAY_BETWEEN_BATCHES = 100; // ms
```

#### 2. Data Consistency
```typescript
// Transactional updates
@Transactional()
async recalculateBatch(cocktailIds: string[]): Promise<void> {
  // Ensure atomic batch updates
}

// Consistency checks
async verifyConsistency(): Promise<boolean> {
  // Compare cached vs true averages for sample
}
```

#### 3. Monitoring & Alerting
```typescript
interface DriftMetrics {
  max_drift: number;
  avg_drift: number;
  cocktails_with_drift: number;
  recalibration_duration: number;
  correction_rate: number; // % of cocktails corrected
}

// Critical Alerts:
// 1. max_drift > 0.1: Excessive drift detected
// 2. correction_rate > 20%: Systemic precision issues
// 3. recalibration_duration > 1 hour: Performance degradation
```

## Alternatives Considered

### 1. Real-time SUM/COUNT Recalculation
- **Pros**: Perfect accuracy, no drift
- **Cons**: O(n) performance, unacceptable for high-volume cocktails
- **Decision**: Rejected - performance impact too severe

### 2. Higher Precision Data Type (decimal(5,4))
- **Pros**: Reduces drift magnitude
- **Cons**: Doesn't eliminate drift, storage overhead
- **Decision**: Complementary - can implement later if needed

### 3. Periodic Materialized View
- **Pros**: Always accurate, can be refreshed incrementally
- **Cons**: Complex refresh logic, still eventual consistency
- **Decision**: Rejected - too complex for MVP

### 4. Accept Drift Without Correction
- **Pros**: Simplest implementation
- **Cons**: Unbounded error accumulation, business risk
- **Decision**: Rejected - unacceptable long-term

## Implementation Phases

### Phase 1: Monitoring Only (MVP)
1. Add drift measurement to existing rating updates
2. Log drift metrics for analysis
3. No automatic correction yet

### Phase 2: Nightly Correction
1. Implement recalibration service
2. Add cron job for nightly execution
3. Basic monitoring and alerting

### Phase 3: Enhanced Accuracy
1. Higher precision data types if needed
2. More frequent corrections for high-traffic cocktails
3. Real-time correction for excessive drift

### Phase 4: Optimization
1. Incremental recalibration (only changed ratings)
2. Distributed processing for large datasets
3. Predictive drift modeling

## Business Justification

### Acceptable Drift Thresholds
| Drift Magnitude | Business Impact | Action Required |
|----------------|----------------|-----------------|
| ≤ 0.01 | Negligible | None |
| 0.01 - 0.05 | Minor | Nightly correction |
| 0.05 - 0.10 | Noticeable | Investigate root cause |
| > 0.10 | Significant | Immediate correction |

### Cost-Benefit Analysis
- **Performance Gain**: 100x faster rating updates
- **Accuracy Cost**: ≤ 0.05 point temporary drift
- **User Impact**: Imperceptible for 99.9% of users
- **Maintenance**: Moderate (nightly job, monitoring)

## Related Decisions
- ADR 0013: Optimistic Concurrency for Rating Updates
- UC 2.30: Rating a Cocktail
- UC 9.22: Recalculating Ratings on GDPR Account Deletion
- UC 4.3: Preventing Negative Inventory via Concurrent Requests

## Testing Strategy

### Unit Tests
```typescript
describe('RatingRecalibrationService', () => {
  it('should detect and correct precision drift', async () => {
    // Setup cocktail with drifted rating
    await createCocktailWithDriftedRating();
    
    const result = await service.recalculateAllRatings();
    
    expect(result.corrected).toBe(1);
    expect(result.maxDrift).toBeGreaterThan(0.01);
  });
  
  it('should handle large datasets efficiently', async () => {
    // Create 10,000 cocktails with ratings
    await createLargeRatingDataset();
    
    const start = Date.now();
    const result = await service.recalculateAllRatings();
    const duration = Date.now() - start;
    
    expect(result.processed).toBe(10000);
    expect(duration).toBeLessThan(300000); // 5 minutes max
  });
});
```

### Integration Tests
```typescript
describe('Rating Precision End-to-End', () => {
  it('should maintain accuracy through 1000 sequential ratings', async () => {
    const cocktailId = 'test-cocktail';
    const ratings = Array.from({ length: 1000 }, () => 
      Math.floor(Math.random() * 5) + 1
    );
    
    // Apply ratings using atomic updates
    for (const rating of ratings) {
      await ratingService.rateCocktail(cocktailId, 'test-user', rating);
    }
    
    // Check drift after nightly recalibration
    await recalibrationService.recalculateAllRatings();
    
    const final = await getCocktailRating(cocktailId);
    const trueAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    
    expect(Math.abs(final.rating - trueAvg)).toBeLessThan(0.05);
  });
});
```

## Rollback Plan
If issues arise:
1. **Immediate**: Disable nightly cron job
2. **Data**: Restore from `user_ratings` pivot table
3. **Code**: Revert to pessimistic locking if necessary
4. **Monitoring**: Enhanced logging to diagnose precision issues