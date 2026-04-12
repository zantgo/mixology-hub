# ADR 0005: Local-Only Rate Limiting Strategy (Removal of Redis Dependency)

## Status
Accepted

## Context
The system originally relied on Redis for critical security and financial protection mechanisms. However, to adhere to the "No Concurrency / No Distributed State" mandate, we have simplified the architecture:

1. **Local Rate Limiting (UC 13.3)**: `ThrottlerGuard` uses in-memory storage only, preventing API abuse per Node.js instance
2. **AI Quota Enforcement**: Uses PostgreSQL directly, bypassing Redis for quota tracking

UC 11.4 defines "Redis Graceful Degradation" stating the system bypasses the cache if Redis is down. However, with the simplified architecture, we have eliminated the Redis dependency for rate limiting entirely, avoiding the security dilemma:

- **Local-Only**: Rate limiting is per-process, not global across instances
- **No Redis Dependency**: Rate limiting continues to function even if Redis is unavailable

## Decision
We implement a **local-only rate limiting strategy** to adhere to the "No Concurrency" mandate:

1. **Primary**: In-memory Map storage per Node.js process
2. **No Distributed State**: No Redis synchronization across instances
3. **Accept Multiplier Bypass**: Explicitly accept that vertical scaling across worker processes multiplies rate limits

### Specific Decisions by Component

#### 1. Local Rate Limiting (`ThrottlerGuard`)
- **Storage**: In-memory `Map` per Node.js process only
- **Limitation**: Limits are per-process, not global across cluster
- **Acceptance**: We explicitly accept that vertical scaling across worker processes multiplies effective rate limits
- **Trade-off**: Trade absolute rate-limit accuracy for elimination of concurrent state coordination

#### 2. AI Quota Enforcement
- **Storage**: PostgreSQL `USER_AI_QUOTAS` table directly
- **No Redis Dependency**: Quota tracking uses database, not Redis
- **Rationale**: Eliminates distributed concurrency while maintaining financial protection
- **Monitoring**: Track quota usage via database queries



## Consequences

### Positive
- **Financial Protection**: AI quota enforcement fails closed to prevent unbounded costs
- **Availability**: Core app remains available during Redis outages
- **Progressive Degradation**: Different components have appropriate failure modes
- **Monitoring**: Clear visibility into degradation states

### Negative
- **Inconsistent Rate Limiting**: In-memory fallback is per-process, not global
- **Security Risk**: JWT blacklist bypass during Redis outages
- **Duplicate Operations**: Possible without idempotency protection
- **Complexity**: Multiple failure modes to implement and test

## Alternatives Considered

### 1. Complete Fail Open (Bypass All Redis)
- **Pros**: Maximum availability
- **Cons**: Unbounded financial risk from unlimited AI calls
- **Decision**: Rejected due to financial risk

### 2. Complete Fail Closed (Block All Requests)
- **Pros**: Maximum security and cost control
- **Cons**: Application becomes unusable
- **Decision**: Rejected due to poor user experience

### 3. Database Fallback for Rate Limiting
- **Pros**: Consistent global limits even during Redis outages
- **Cons**: High database load, slower than Redis
- **Decision**: Rejected for MVP due to complexity, but considered for Phase 3

### 4. Client-Side Rate Limiting
- **Pros**: Reduces server load during outages
- **Cons**: Easily bypassed by malicious clients
- **Decision**: Rejected as primary strategy but implemented as supplemental

## Implementation Details

### Local-Only Rate Limiter
```typescript
class LocalRateLimiter {
  async checkLimit(userId: string, endpoint: string): Promise<boolean> {
    // Local in-memory storage only - no Redis dependency
    return this.inMemoryRateLimiter.check(userId, endpoint);
  }
}

class InMemoryRateLimiter {
  private limits = new Map<string, { count: number; resetTime: number }>();
  
  check(userId: string, endpoint: string): boolean {
    const key = `${userId}:${endpoint}`;
    const now = Date.now();
    
    // Clean up old entries
    if (this.limits.size > 10000) {
      this.cleanup();
    }
    
    const limit = this.limits.get(key);
    if (!limit || now > limit.resetTime) {
      // New window
      this.limits.set(key, { count: 1, resetTime: now + 60000 });
      return true;
    }
    
    if (limit.count >= 100) { // 100 requests per minute
      return false;
    }
    
    limit.count++;
    return true;
  }
}
```

### AI Quota Enforcer (Database-Only)
```typescript
class AIQuotaEnforcer {
  async checkQuota(userId: string): Promise<boolean> {
    // Database-only quota tracking - no Redis dependency
    const today = new Date().toISOString().split('T')[0];
    
    // Find the quota record for today (UNIQUE constraint ensures 0 or 1 rows)
    const quota = await this.userAiQuotasRepo.findOne({ 
      where: { userId, quota_date: today } 
    });
    
    // If no record exists, usage is 0 (user hasn't generated any AI recipes today)
    // If record exists, read the usage_count column value
    const usage = quota ? quota.usage_count : 0;
    return usage < 20; 
  }
}
```

### Monitoring and Alerting
1. **Metrics to Collect**:
   - `redis.availability` (percentage)
   - `rate_limiter.fallback.count`
   - `ai_requests.blocked.count`

2. **Alert Thresholds**:
   - Redis unavailable > 5 minutes
   - Rate limiter fallback > 100 requests/minute
   - AI requests blocked > 10 requests/minute

### Architectural Decision: Mandatory Trust Proxy Configuration for Local Rate Limiting
**Explicit Trade-off:** Because we stripped Redis and rely entirely on the local in-memory `ThrottlerGuard` for brute-force and API abuse protection, we explicitly mandate that the NestJS application MUST be configured with `app.set('trust proxy', true)`. If the backend is deployed behind a reverse proxy (e.g., NGINX, AWS ALB) without this setting, the in-memory rate limiter will read the Load Balancer's IP for all requests, instantly triggering a global Denial of Service for all users. We trade deployment agility for the absolute requirement of exact reverse-proxy header forwarding.

## Related Decisions
- [ADR 0001: Use PostgreSQL for Inventory Management](./0001-use-postgresql-for-inventory.md)
- UC 11.4: Redis Graceful Degradation
- UC 13.3: Global Rate Limiting with ThrottlerGuard

## Evolution Plan
1. **Phase 2**: Implement database fallback for critical rate limits
2. **Phase 3**: Add distributed in-memory cache (Hazelcast/Redis Cluster)
3. **Phase 4**: Multi-region Redis with automatic failover