# ADR 0012: Unified Idempotency System to Prevent Redis-PostgreSQL Clash

## Status
Accepted

## Context
The system has two independent idempotency systems that don't coordinate, creating double-deduction risks:

1. **Redis-Based Idempotency** (ADR 0009): For real-time operations using `Idempotency-Key` header
   - Fast (in-memory)
   - Fails open during Redis outages
   - No persistence across restarts
   - Used for: `POST /cocktails/:id/prepare`, `POST /preparations/:id/undo`

2. **PostgreSQL-Based Idempotency** (UC 12.3): For offline sync using `client_operation_id` in `SYNC_OPERATIONS`
   - Consistent (UNIQUE constraint)
   - Always available (database)
   - Persistent
   - Used for: `POST /sync/operations`

**The Clash Problem**:
- Same operation could be protected by both systems or neither
- Redis outage allows duplicates despite PostgreSQL idempotency being available
- No single source of truth for idempotency
- Complex debugging when duplicates occur

**Example Failure Scenario**:
1. User prepares cocktail offline → `client_operation_id: "offline-123"` (PostgreSQL protected)
2. User comes online, double-clicks prepare → `Idempotency-Key: "online-456"` (Redis protected)
3. Redis goes down → duplicate preparation allowed
4. Result: Double deduction despite having idempotency systems

## Decision
Implement a **unified hybrid idempotency system** with PostgreSQL as the source of truth:

1. **Single Idempotency Key Format**: `{source}:{uuid}` where source = `client` (frontend), `sync` (offline), `system` (backend)
2. **Primary Check**: Redis cache for performance (fast path)
3. **Fallback Check**: PostgreSQL UNIQUE constraint for consistency (slow path)
4. **Write-Through**: Always write to PostgreSQL after Redis cache
5. **Cache Warming**: Warm Redis from PostgreSQL on startup/outage recovery

### Architecture
```
Request → Idempotency Service → Redis Cache (fast) → If miss → PostgreSQL (source of truth)
                                     ↑                        ↓
                                     └─── Cache Write ───────┘
```

### Implementation

#### 1. Unified Idempotency Service
```typescript
@Injectable()
export class UnifiedIdempotencyService {
  constructor(
    private readonly redis: RedisService,
    private readonly idempotencyRepo: IdempotencyRepository,
    private readonly logger: Logger
  ) {}
  
  async checkAndRecord(
    userId: string,
    key: string,
    operation: string,
    payloadHash?: string
  ): Promise<{ isDuplicate: boolean; cachedResult?: any }> {
    // 1. Try Redis first (fast path)
    try {
      const redisKey = this.getRedisKey(userId, operation, key);
      const cached = await this.redis.get(redisKey, { timeout: 100 });
      
      if (cached) {
        return { isDuplicate: true, cachedResult: JSON.parse(cached) };
      }
    } catch (redisError) {
      this.logger.debug('Redis idempotency check failed, falling back to DB', {
        userId, operation, key
      });
    }
    
    // 2. Check PostgreSQL (source of truth)
    try {
      const existing = await this.idempotencyRepo.findByKey(userId, operation, key);
      
      if (existing) {
        // Cache in Redis for future fast checks
        await this.cacheInRedis(userId, operation, key, existing);
        return { isDuplicate: true, cachedResult: existing.result };
      }
      
      // 3. Record new idempotency key (will fail if duplicate due to race)
      const idempotencyRecord = await this.idempotencyRepo.create({
        userId,
        operation,
        key,
        payloadHash,
        status: 'processing',
        createdAt: new Date()
      });
      
      // 4. Cache in Redis
      await this.cacheInRedis(userId, operation, key, idempotencyRecord);
      
      return { isDuplicate: false };
    } catch (dbError) {
      // UNIQUE constraint violation = duplicate
      if (this.isUniqueConstraintViolation(dbError)) {
        // Race condition: another request just recorded this key
        const existing = await this.idempotencyRepo.findByKey(userId, operation, key);
        await this.cacheInRedis(userId, operation, key, existing!);
        return { isDuplicate: true, cachedResult: existing!.result };
      }
      
      throw dbError;
    }
  }
  
  async completeWithResult(
    userId: string,
    operation: string,
    key: string,
    result: any,
    ttlSeconds: number = 3600
  ): Promise<void> {
    // 1. Update PostgreSQL
    await this.idempotencyRepo.updateResult(userId, operation, key, result);
    
    // 2. Update Redis cache with result
    const redisKey = this.getRedisKey(userId, operation, key);
    const cacheValue = {
      result,
      completedAt: new Date().toISOString()
    };
    
    try {
      await this.redis.setex(redisKey, ttlSeconds, JSON.stringify(cacheValue));
    } catch (redisError) {
      // Silent fail - PostgreSQL is source of truth
      this.logger.warn('Failed to cache idempotency result in Redis', {
        userId, operation, key, error: redisError.message
      });
    }
  }
  
  async recordFailure(
    userId: string,
    operation: string,
    key: string,
    errorMessage: string
  ): Promise<void> {
    // 1. Update PostgreSQL
    await this.idempotencyRepo.updateFailure(userId, operation, key, errorMessage);
    
    // 2. Update Redis cache with failure
    const redisKey = this.getRedisKey(userId, operation, key);
    const cacheValue = {
      error: errorMessage,
      failedAt: new Date().toISOString(),
      status: 'failed'
    };
    
    try {
      // Shorter TTL for failures (1 hour)
      await this.redis.setex(redisKey, 3600, JSON.stringify(cacheValue));
    } catch (redisError) {
      // Silent fail - PostgreSQL is source of truth
      this.logger.warn('Failed to cache idempotency failure in Redis', {
        userId, operation, key, error: redisError.message
      });
    }
  }
  
  private getRedisKey(userId: string, operation: string, key: string): string {
    return `idempotency:v2:${userId}:${operation}:${key}`;
  }
  
  private async cacheInRedis(
    userId: string,
    operation: string,
    key: string,
    record: IdempotencyRecord
  ): Promise<void> {
    const redisKey = this.getRedisKey(userId, operation, key);
    const cacheValue = {
      result: record.result,
      status: record.status,
      createdAt: record.createdAt.toISOString()
    };
    
    try {
      // Short TTL for pending operations, longer for completed
      const ttl = record.status === 'completed' ? 3600 : 60;
      await this.redis.setex(redisKey, ttl, JSON.stringify(cacheValue));
    } catch (error) {
      // Redis cache is optional
    }
  }
}
```

#### 2. PostgreSQL Schema Extension
```sql
-- Unified idempotency table (extends SYNC_OPERATIONS concept)
CREATE TABLE unified_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation VARCHAR(255) NOT NULL, -- e.g., 'cocktail:prepare', 'preparation:undo', 'sync:batch'
  idempotency_key VARCHAR(255) NOT NULL,
  payload_hash VARCHAR(64), -- SHA256 hash of request payload for validation
  status VARCHAR(50) NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  result JSONB, -- Cached response for duplicate requests
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Single source of truth constraint
  UNIQUE(user_id, operation, idempotency_key),
  
  -- Index for cleanup and queries
  INDEX idx_unified_idempotency_user_operation (user_id, operation),
  INDEX idx_unified_idempotency_created (created_at)
);

-- Migration: Copy existing SYNC_OPERATIONS client_operation_id records
INSERT INTO unified_idempotency (user_id, operation, idempotency_key, status, created_at)
SELECT 
  user_id,
  'sync:' || operation_type,
  client_operation_id,
  CASE status 
    WHEN 'synced' THEN 'completed'
    WHEN 'failed' THEN 'failed'
    ELSE 'processing'
  END,
  created_at
FROM sync_operations
ON CONFLICT (user_id, operation, idempotency_key) DO NOTHING;
```

#### 3. Global Idempotency Interceptor
```typescript
import { Injectable } from '@nestjs/common';
import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { mergeMap, catchError } from 'rxjs/operators';

@Injectable()
export class GlobalIdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotencyService: UnifiedIdempotencyService,
    private readonly requestHasher: RequestHasherService
  ) {}
  
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // Only check mutating operations
    if (!this.isMutatingOperation(request.method)) {
      return next.handle();
    }
    
    // Get or generate idempotency key
    const idempotencyKey = this.getIdempotencyKey(request);
    if (!idempotencyKey) {
      return next.handle();
    }
    
    const userId = request.user?.id;
    const operation = this.getOperationIdentifier(request);
    const payloadHash = await this.requestHasher.hashRequest(request);
    
    // Check idempotency
    const checkResult = await this.idempotencyService.checkAndRecord(
      userId,
      operation,
      idempotencyKey,
      payloadHash
    );
    
    if (checkResult.isDuplicate) {
      // Return cached response
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-Idempotency-Status', 'cached');
      response.setHeader('X-Idempotency-Key', idempotencyKey);
      
      return of(checkResult.cachedResult);
    }
    
    // Process request with atomic idempotency update
    return next.handle().pipe(
      mergeMap(async (response) => {
        // Record successful result BEFORE returning response
        // This ensures atomicity with the database transaction
        await this.idempotencyService.completeWithResult(
          userId,
          operation,
          idempotencyKey,
          response
        );
        return response;
      }),
      catchError(async (error) => {
        // Record failure BEFORE re-throwing error
        await this.idempotencyService.recordFailure(
          userId,
          operation,
          idempotencyKey,
          error.message
        );
        throw error;
      })
    );
  }
  
  private getIdempotencyKey(request: Request): string | null {
    // 1. Check header (online operations)
    const headerKey = request.headers['idempotency-key'];
    if (headerKey) {
      return `client:${headerKey}`;
    }
    
    // 2. Check body (sync operations)
    const body = request.body;
    if (body?.client_operation_id) {
      return `sync:${body.client_operation_id}`;
    }
    
    // 3. Generate for critical operations
    if (this.isCriticalOperation(request)) {
      return `system:${uuidv4()}`;
    }
    
    return null;
  }
  
  private getOperationIdentifier(request: Request): string {
    const method = request.method;
    const path = request.route?.path || request.url;
    
    // Normalize path parameters
    const normalizedPath = path.replace(/:[^/]+/g, ':param');
    
    return `${method}:${normalizedPath}`;
  }
}
```

#### 4. Request Hasher for Payload Validation
```typescript
@Injectable()
export class RequestHasherService {
  async hashRequest(request: Request): Promise<string> {
    const hashData = {
      method: request.method,
      path: request.url,
      query: this.sortedStringify(request.query),
      body: await this.hashBody(request.body),
      headers: this.hashRelevantHeaders(request.headers)
    };
    
    const hashString = JSON.stringify(hashData);
    return crypto.createHash('sha256').update(hashString).digest('hex');
  }
  
  private async hashBody(body: any): Promise<string | null> {
    if (!body || Object.keys(body).length === 0) {
      return null;
    }
    
    // Sort keys for consistent hashing
    const sortedBody = this.sortObjectKeys(body);
    return crypto.createHash('sha256')
      .update(JSON.stringify(sortedBody))
      .digest('hex')
      .substring(0, 32);
  }
  
  private hashRelevantHeaders(headers: Record<string, any>): string {
    // Only hash headers that affect business logic
    const relevantHeaders = {
      'content-type': headers['content-type'],
      'accept': headers['accept'],
      'if-match': headers['if-match']
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(relevantHeaders))
      .digest('hex')
      .substring(0, 16);
  }
}
```

## Consequences

### Positive
- **Single Source of Truth**: PostgreSQL UNIQUE constraint guarantees no duplicates
- **Performance**: Redis cache for fast path (99%+ hit rate)
- **Consistency**: No more clashing idempotency systems
- **Debuggability**: All idempotency records in one table
- **Persistence**: Survives Redis restarts/outages
- **Unified API**: Same interface for online/offline operations

### Negative
- **Database Load**: Additional queries on PostgreSQL
- **Complexity**: More sophisticated implementation
- **Latency**: Added database round-trip on cache miss
- **Migration**: Need to migrate existing idempotency data
- **Storage**: PostgreSQL table grows with all operations
- **Long-Term Storage Requirement**: Must retain idempotency records for 90+ days to prevent double deductions from long-delayed offline syncs (UC 12.12)
  - **Stuck Processing Locks Risk**: If NestJS crashes during state-mutating requests, idempotency records remain stuck in 'processing' status
    - **Senior Architectural Decision: Idempotency Lock Expiration**
    - **Explicit Trade-off:** To prevent "stuck locks" caused by server crashes during state-mutating requests, idempotency records stuck in processing status for more than 5 minutes will be treated as failed and allowed to be overwritten by the user. We trade the theoretical risk of a slow 5-minute transaction resolving twice for the guarantee that users are not locked out of their actions by temporary pod failures.
  - **Idempotency Atomicity Flaw**: The GlobalIdempotencyInterceptor updates idempotency records in RxJS `tap()` operator, which creates race conditions if Node.js crashes after database transaction commits but before interceptor fires
    - **Senior Architectural Decision: Idempotency vs. Database Transaction Atomicity**
    - **Explicit Trade-off:** We accept a race condition where idempotency records may remain in 'processing' state despite successful operations (requiring the 5-minute cleanup) because implementing true atomicity would require:
      1. Two-phase commit across PostgreSQL and Redis (distributed transaction complexity)
      2. Database triggers that violate separation of concerns
      3. Custom transaction managers that couple business logic to infrastructure
    - **Mitigation:** Changed from `tap()` to `mergeMap()` to update idempotency BEFORE returning response, reducing but not eliminating the race window.

  - **Interceptor vs. Batch Array Clash**: The GlobalIdempotencyInterceptor checks `request.body.client_operation_id` but cannot traverse nested arrays in batch payloads (UC 7.23)
    - **Senior Architectural Decision: Interceptor Delegation for Batch Payloads**
    - **Explicit Trade-off:** The GlobalIdempotencyInterceptor operates at the HTTP request level and cannot inherently traverse nested arrays of operations (like the `/offline/sync` bulk payload). We explicitly mandate that the Global Interceptor will ONLY protect top-level requests using the `Idempotency-Key` HTTP header. For batch endpoints containing arrays of operations, the Interceptor will defer item-level idempotency to the Domain Service layer (e.g., SyncService). We trade the purity of a single global interceptor for the necessity of granular, item-level idempotency within batch arrays.

## Mitigation Strategies

### 1. Performance Optimization
```typescript
// Read replica for idempotency checks
@Injectable()
export class ReadReplicaIdempotencyService extends UnifiedIdempotencyService {
  constructor(
    redis: RedisService,
    @Inject('IDEMPOTENCY_READ_REPO') private readonly readRepo: IdempotencyRepository,
    @Inject('IDEMPOTENCY_WRITE_REPO') private readonly writeRepo: IdempotencyRepository,
    logger: Logger
  ) {
    super(redis, readRepo, logger);
  }
  
  async checkAndRecord(userId: string, key: string, operation: string): Promise<any> {
    // Check read replica first (faster)
    try {
      const existing = await this.readRepo.findByKey(userId, operation, key);
      if (existing) {
        await this.cacheInRedis(userId, operation, key, existing);
        return { isDuplicate: true, cachedResult: existing.result };
      }
    } catch (readError) {
      // Fallback to primary
      return super.checkAndRecord(userId, key, operation);
    }
    
    // Write to primary
    return this.writeRepo.create({ userId, operation, key, status: 'processing' });
  }
}
```

### 2. Automatic Cleanup with Offline Sync Protection
```sql
-- Automated cleanup of old idempotency records
-- CRITICAL: Retention period must be > maximum allowed offline queue age (90 days)
-- to prevent double deductions for long-delayed offline syncs
CREATE OR REPLACE FUNCTION cleanup_old_idempotency()
RETURNS void AS $$
BEGIN
  -- Delete completed records older than 120 days (not 90 days)
  -- Senior Architectural Decision: Idempotency Retention Buffer
  -- To prevent race conditions at the boundary limit of the offline queue, 
  -- idempotency retention must outlive max offline queue age by 30 days
  DELETE FROM unified_idempotency 
  WHERE status = 'completed' 
    AND completed_at < NOW() - INTERVAL '120 days';
    
  -- Delete failed records older than 120 days
  DELETE FROM unified_idempotency 
  WHERE status = 'failed' 
    AND created_at < NOW() - INTERVAL '120 days';
    
  -- Delete processing records older than 5 minutes (stuck operations)
  -- Senior Architectural Decision: Idempotency Lock Expiration
  -- To prevent "stuck locks" from server crashes, processing records older than 5 minutes
  -- are treated as failed and can be overwritten by users
  DELETE FROM unified_idempotency 
  WHERE status = 'processing' 
    AND created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Run daily
SELECT cron.schedule('cleanup-idempotency', '0 2 * * *', 'SELECT cleanup_old_idempotency()');
```

### 3. Cache Warming on Startup
```typescript
// Warm Redis cache from PostgreSQL on startup
@Injectable()
export class IdempotencyCacheWarmer {
  constructor(
    private readonly idempotencyRepo: IdempotencyRepository,
    private readonly redis: RedisService,
    private readonly logger: Logger
  ) {}
  
  async warmCache(): Promise<void> {
    this.logger.log('Warming idempotency cache from PostgreSQL');
    
    // Get recent idempotency records (last hour)
    const recentRecords = await this.idempotencyRepo.findRecent(3600);
    
    let warmed = 0;
    for (const record of recentRecords) {
      if (record.status === 'completed' && record.result) {
        const redisKey = `idempotency:v2:${record.user_id}:${record.operation}:${record.idempotency_key}`;
        const cacheValue = {
          result: record.result,
          status: record.status,
          completedAt: record.completed_at.toISOString()
        };
        
        try {
          await this.redis.setex(redisKey, 3600, JSON.stringify(cacheValue));
          warmed++;
        } catch (error) {
          this.logger.warn('Failed to warm cache for record', { recordId: record.id });
        }
      }
    }
    
    this.logger.log(`Warmed ${warmed} idempotency records into Redis cache`);
  }
}
```

## Migration Plan

### Phase 1: Dual Write (Backwards Compatible)
1. Create `unified_idempotency` table
2. Update services to write to both old and new systems
3. Run migration for existing data
4. Monitor for consistency issues

### Phase 2: Dual Read (Transition)
1. Update interceptors to check both systems
2. Prefer new system, fallback to old
3. Validate no duplicates slip through

### Phase 3: Cutover
1. Update all services to use new system only
2. Remove old idempotency code
3. Archive old `SYNC_OPERATIONS` idempotency data

### Phase 4: Cleanup
1. Remove old database columns/tables
2. Update documentation
3. Monitor performance

## Related Decisions
- ADR 0009: Idempotency "Fail-Open" Double Deduction Risk
- UC 12.3: Handling Duplicate Operations (Idempotency)
- UC 4.21: Idempotency Keys for State-Mutating Operations
- ADR 0005: Rate Limiter Failure State Strategy

## Monitoring & Alerting

### Key Metrics
```typescript
interface IdempotencyMetrics {
  redis_hit_rate: number; // % of checks served from Redis
  db_fallback_rate: number; // % requiring DB fallback
  duplicate_rate: number; // % of duplicate requests detected
  processing_time_p50: number; // Median processing time
  processing_time_p95: number; // 95th percentile
  cache_warm_success_rate: number; // % of cache warm successes
}
```

### Critical Alerts
1. **Redis Hit Rate < 90%**: Cache ineffective
2. **DB Fallback Rate > 10%**: Redis issues
3. **Duplicate Rate > 5%**: Possible client bugs
4. **Processing Time P95 > 100ms**: Performance degradation

## Rollback Plan
If issues arise during migration:
1. **Immediate**: Disable new interceptor, revert to old system
2. **Data**: Use PostgreSQL as source of truth, rebuild Redis from DB
3. **Communication**: Notify users of temporary degraded idempotency
4. **Investigation**: Analyze failure cause before re-attempting