# ADR 0005: Rate Limiter Failure State Strategy (Redis Degradation)

## Status
Accepted

## Context
The system relies on Redis for critical security and financial protection mechanisms:

1. **Global Rate Limiting (UC 13.3)**: `ThrottlerGuard` prevents API abuse
2. **Idempotency Keys (UC 4.21)**: Prevents duplicate operations from network retries
3. **AI Quota Enforcement**: Limits LLM API calls to prevent financial abuse
4. **Session Management**: JWT blacklisting and refresh token grace periods

UC 11.4 defines "Redis Graceful Degradation" stating the system bypasses the cache if Redis is down. However, this creates a critical security dilemma for rate limiting:

- **Fail Open**: If Redis is down and we bypass rate limiting, users could make unlimited requests to external LLM APIs, potentially costing thousands of dollars in minutes
- **Fail Closed**: If Redis is down and we block all API requests, the application becomes unavailable

## Decision
We implement a **hybrid fail-safe strategy** with tiered fallbacks:

1. **Primary**: Redis-based rate limiting (production)
2. **Secondary**: In-memory Map fallback per Node.js process (Redis unavailable)
3. **Tertiary**: Request queuing with circuit breaker (severe degradation)

### Specific Decisions by Component

#### 1. Global Rate Limiting (`ThrottlerGuard`)
- **Fail State**: Fall back to in-memory `Map` per Node.js process
- **Limitation**: In-memory limits are per-process, not global across cluster
- **Acceptance**: For MVP scale (single instance), per-process limits are acceptable
- **Monitoring**: Alert when falling back to in-memory rate limiting

#### 2. AI Quota Enforcement
- **Fail State**: **Fail closed** - block AI requests if Redis unavailable
- **Rationale**: Financial risk outweighs availability for non-critical feature
- **User Experience**: Show "AI features temporarily unavailable" message
- **Circuit Breaker**: After 5 failed Redis attempts, block AI for 5 minutes

#### 3. Idempotency Keys
- **Fail State**: **Fail open** - process requests without idempotency protection
- **Rationale**: Better to risk duplicate operations than block user actions
- **Mitigation**: Short timeout (1 second) for Redis check, then proceed
- **Logging**: Log all idempotency bypass events for audit

#### 4. Session Management (JWT Blacklist & Refresh Grace Period)
- **JWT Blacklist Fail State**: **Fail open** - allow requests even if cannot check blacklist
- **Refresh Grace Period Fail State**: **Downgraded penalty** - return 401 Unauthorized without token family revocation
- **Rationale**: To prevent catastrophic SPA cross-tab race conditions from triggering global account logouts during a Redis outage, we must downgrade the penalty for token reuse when the grace-period cache is unavailable. Preventing token chain divergence takes priority over SPA multi-tab UX during caching outages, but we trade maximum security for UX survival.
- **Senior Architectural Decision: Downgrade of Token Reuse Penalty During Redis Outages**
  - **Explicit Trade-off**: To prevent catastrophic SPA cross-tab race conditions from triggering global account logouts during a Redis outage, we must downgrade the penalty for token reuse when the grace-period cache is unavailable.
  - **Resolution**: If Redis is down, presenting a just-revoked refresh token will NOT instantly trigger a full token family revocation (nuclear option). Instead, it will simply return a standard 401 Unauthorized for that specific request, forcing that specific tab to redirect to login, but preserving the user's sessions on other devices. We trade maximum security (catching edge-case token theft during a Redis outage) for UX survival.
- **Mitigation**: 
  - Short JWT expiry (15 minutes) reduces window of risk for blacklist
  - PostgreSQL `rotated_at` timestamp provides grace period fallback
- **Monitoring**: Alert on Redis session store failures
- **Note**: During Redis outages, grace period timestamps may have slight clock skew but prevent catastrophic logout scenarios

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

### Rate Limiter with Fallback
```typescript
class HybridRateLimiter {
  async checkLimit(userId: string, endpoint: string): Promise<boolean> {
    try {
      // Try Redis first
      return await this.redisRateLimiter.check(userId, endpoint);
    } catch (redisError) {
      // Fall back to in-memory
      this.metrics.recordFallback('rate_limiter');
      return this.inMemoryRateLimiter.check(userId, endpoint);
    }
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

### AI Quota Enforcer (Fail Closed)
```typescript
class AIQuotaEnforcer {
  async checkQuota(userId: string): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `ai_quota:${userId}:${today}`;
      
      // Try Redis with short timeout
      const usageStr = await this.redis.get(key).timeout(1000);
      const usage = usageStr ? parseInt(usageStr, 10) : 0;
      
      return usage < 20; // 20 is the daily limit
    } catch (error) {
      // Redis unavailable - fail closed for AI
      this.metrics.recordAiBlocked('redis_unavailable');
      throw new ServiceUnavailableException(
        'AI features temporarily unavailable. Please try again later.'
      );
    }
  }
}
```

### Monitoring and Alerting
1. **Metrics to Collect**:
   - `redis.availability` (percentage)
   - `rate_limiter.fallback.count`
   - `ai_requests.blocked.count`
   - `idempotency.bypassed.count`

2. **Alert Thresholds**:
   - Redis unavailable > 5 minutes
   - Rate limiter fallback > 100 requests/minute
   - AI requests blocked > 10 requests/minute

## Related Decisions
- [ADR 0001: Use PostgreSQL for Inventory Management](./0001-use-postgresql-for-inventory.md)
- UC 11.4: Redis Graceful Degradation
- UC 13.3: Global Rate Limiting with ThrottlerGuard

## Evolution Plan
1. **Phase 2**: Implement database fallback for critical rate limits
2. **Phase 3**: Add distributed in-memory cache (Hazelcast/Redis Cluster)
3. **Phase 4**: Multi-region Redis with automatic failover