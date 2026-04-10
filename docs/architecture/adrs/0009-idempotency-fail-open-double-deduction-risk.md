# ADR 0009: Idempotency "Fail-Open" Double Deduction Risk

## Status
Superseded by ADR 0012

## Context
**Update:** This ADR has been superseded by [ADR 0012](./0012-unified-idempotency-system.md). We no longer accept the "fail-open" double-deduction risk. Instead, we have implemented a unified PostgreSQL/Redis idempotency system to guarantee single deductions.

ADR 0005 establishes that Idempotency Key checks should "fail open" when Redis is unavailable - process requests without idempotency protection rather than blocking user actions. This creates a financial and data integrity risk:

**The Scenario**:
1. User double-clicks "Prepare Cocktail" button
2. Redis is down (maintenance, outage, network issue)
3. Both requests proceed without idempotency checking
4. Due to `REPEATABLE READ` transaction isolation, requests process sequentially
5. User loses double the inventory (e.g., 100ml instead of 50ml)

**Example**:
- User has 500ml Vodka
- Cocktail requires 50ml Vodka
- Double-click during Redis outage
- Result: 400ml remaining (100ml deducted), not 450ml

This contradicts the "exactly once" semantics promised by idempotency keys and creates inventory inaccuracies that users must manually correct.

## Decision
Explicitly accept the double-deduction risk during Redis outages with the following mitigations:

1. **Accept the Risk**: Acknowledge that fail-open idempotency can cause double deductions
2. **User Recovery Path**: Rely on the 15-minute "Undo" window (UC 4.4) for self-correction
3. **Monitoring**: Log all idempotency bypass events for audit and reconciliation
4. **Graceful Degradation**: Short timeout (1 second) before failing open
5. **User Notification**: Inform users when operating without idempotency protection

### Implementation
```typescript
class IdempotencyService {
  async checkIdempotency(
    userId: string, 
    key: string, 
    operation: string
  ): Promise<{ isDuplicate: boolean; cachedResponse?: any }> {
    try {
      // Try Redis with short timeout
      const redisResult = await this.redis.get(
        `idempotency:user_${userId}:${operation}:${key}`,
        { timeout: 1000 } // 1 second timeout
      );
      
      if (redisResult) {
        return { isDuplicate: true, cachedResponse: JSON.parse(redisResult) };
      }
      
      return { isDuplicate: false };
    } catch (redisError) {
      // Redis unavailable - fail open
      this.metrics.recordIdempotencyBypass(userId, operation);
      this.logger.warn('Redis unavailable, idempotency check bypassed', {
        userId,
        operation,
        key
      });
      
      // Return false (not duplicate) to allow request processing
      return { isDuplicate: false };
    }
  }
  
  async cacheResponse(
    userId: string,
    key: string,
    operation: string,
    response: any,
    ttlSeconds: number = 3600
  ): Promise<void> {
    try {
      await this.redis.setex(
        `idempotency:user_${userId}:${operation}:${key}`,
        ttlSeconds,
        JSON.stringify(response)
      );
    } catch (redisError) {
      // Silent fail - already logged in checkIdempotency
      this.metrics.recordIdempotencyCacheFailure(userId, operation);
    }
  }
}
```

## Consequences

### Positive
- **Availability**: Users can continue operations during Redis outages
- **Simplicity**: No complex fallback mechanisms needed
- **Predictable**: Clear failure mode (double deductions possible)
- **Recoverable**: Users have undo mechanism for corrections

### Negative
- **Financial Risk**: Users lose double inventory during outages
- **Data Integrity**: Inventory counts become inaccurate
- **User Trust**: Breaks "exactly once" promise
- **Manual Correction**: Users must notice and undo duplicate operations

## Alternatives Considered

### 1. Fail Closed (Block Operations)
- **Pros**: Guaranteed exactly-once semantics
- **Cons**: Application becomes unusable during Redis outages
- **Decision**: Rejected - availability prioritized over perfect idempotency

### 2. Database Fallback for Idempotency
- **Pros**: Maintains idempotency during Redis outages
- **Cons**: Adds database load, slower than Redis, complex implementation
- **Decision**: Rejected for MVP - complexity outweighs benefit

### 3. Client-Side Idempotency
- **Pros**: No server dependency for idempotency
- **Cons**: Clients can bypass, state synchronization issues
- **Decision**: Rejected - insufficient for server-side state changes

### 4. Hybrid Time-Window Deduplication
- **Pros**: Reduces but doesn't eliminate duplicates
- **Cons**: Complex, still not guaranteed
- **Decision**: Rejected - adds complexity without solving core problem

## Mitigation Strategies

### 1. User-Facing Indicators
```typescript
// Frontend shows warning when idempotency unavailable
@Component({
  template: `
    <div *ngIf="idempotencyUnavailable" class="warning-banner">
      ⚠️ System operating in reduced safety mode. 
      Please avoid double-clicking buttons to prevent duplicate operations.
    </div>
    
    <button 
      (click)="prepareCocktail()" 
      [disabled]="isProcessing"
      [class.danger]="idempotencyUnavailable">
      Prepare Cocktail
    </button>
  `
})
class CocktailComponent {
  idempotencyUnavailable = false;
  
  async prepareCocktail() {
    try {
      const response = await this.cocktailService.prepare(cocktailId);
      
      // Check response headers for idempotency status
      if (response.headers['X-Idempotency-Status'] === 'bypassed') {
        this.idempotencyUnavailable = true;
        this.ui.showWarning(
          'System operating without duplicate protection. ' +
          'Please wait for confirmation before clicking again.'
        );
      }
    } catch (error) {
      // Handle error
    }
  }
}
```

### 2. Audit and Reconciliation
```typescript
// Log all idempotency bypass events for later reconciliation
@Injectable()
export class IdempotencyAuditService {
  async logBypassEvent(
    userId: string,
    operation: string,
    key: string,
    timestamp: Date
  ): Promise<void> {
    await this.auditRepo.save({
      userId,
      operation,
      idempotencyKey: key,
      timestamp,
      status: 'bypassed',
      serverId: process.env.SERVER_ID
    });
  }
  
  // Periodic job to detect potential duplicates
  async detectPotentialDuplicates(): Promise<PotentialDuplicate[]> {
    // Find operations with same user, similar timestamp, same operation
    // during Redis outage windows
    return await this.auditRepo.query(`
      SELECT user_id, operation, COUNT(*) as count
      FROM idempotency_audit
      WHERE status = 'bypassed'
        AND timestamp > NOW() - INTERVAL '1 hour'
      GROUP BY user_id, operation
      HAVING COUNT(*) > 1
    `);
  }
}
```

### 3. Operational Monitoring
```typescript
// Alert on suspicious patterns
@Injectable()
export class IdempotencyMonitorService {
  async monitorBypassRate(): Promise<void> {
    const bypassRate = await this.getBypassRateLastHour();
    
    if (bypassRate > 0.1) { // More than 10% bypass rate
      this.alertService.sendAlert({
        severity: 'warning',
        title: 'High Idempotency Bypass Rate',
        message: `${bypassRate * 100}% of operations bypassing idempotency checks`,
        details: {
          bypassRate,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (bypassRate > 0.5) { // More than 50% bypass rate
      this.alertService.sendAlert({
        severity: 'critical',
        title: 'Critical: Redis Idempotency Failure',
        message: 'Most operations bypassing idempotency - risk of duplicate deductions',
        details: {
          bypassRate,
          timestamp: new Date().toISOString(),
          recommendation: 'Check Redis connectivity immediately'
        }
      });
    }
  }
}
```

## User Recovery Process

### 1. Undo Mechanism (Primary)
```typescript
// Users can undo preparations within 15 minutes
async handleDuplicateDeduction(userId: string): Promise<void> {
  // 1. User notices double deduction
  // 2. Navigates to preparation history
  // 3. Sees duplicate entries
  // 4. Clicks "Undo" on duplicate
  // 5. Inventory restored
  
  // UI should make this obvious
  this.ui.showMessage(
    'Duplicate preparation detected. ' +
    'Click "Undo" on the extra entry to restore your inventory.'
  );
}
```

### 2. Support Intervention (Fallback)
```typescript
// Support team can manually correct inventory
@Post('/admin/inventory/correction')
@Roles('admin')
async correctInventory(
  @Body() correction: InventoryCorrectionDto
): Promise<void> {
  // Admin manually adjusts inventory
  // Logs reason and provides user notification
  
  await this.inventoryService.adjust(
    correction.userId,
    correction.ingredientId,
    correction.amount,
    'manual_correction_duplicate_deduction'
  );
  
  await this.notificationService.notifyUser(
    correction.userId,
    'Inventory Correction Applied',
    `Your ${correction.ingredientName} has been adjusted by ${correction.amount}ml ` +
    `due to a system issue with duplicate deductions.`
  );
}
```

## Related Decisions
- ADR 0005: Rate Limiter Failure State Strategy (Redis Degradation)
- UC 4.4: Undo Preparation within 15-minute window
- UC 4.21: Idempotency Keys for State-Mutating Operations

## Evolution Plan
1. **Phase 2**: Implement database fallback for critical operations (preparation)
2. **Phase 3**: Add client-side request deduplication as supplemental protection
3. **Phase 4**: Multi-region Redis with automatic failover to reduce outage probability