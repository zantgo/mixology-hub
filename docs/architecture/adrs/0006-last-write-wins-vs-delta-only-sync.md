# ADR 0006: Last Write Wins vs. Delta-Only Sync for Offline Operations

## Status
Accepted

## Context
The offline sync system (UC 12.4) handles operations queued while the app is offline. A critical conflict arises with absolute value updates:

**Scenario**: User manually audits their bar offline and sets "Vodka" to exactly 500ml (absolute update). Meanwhile, their roommate using the same account on a different device prepares 2 cocktails, each deducting 30ml of Vodka. When the user reconnects 2 hours later:

- **User's absolute update**: "Set Vodka = 500ml"
- **Roommate's deltas**: "-30ml, -30ml" (current actual: 440ml if starting from 500ml)

If the absolute update (500ml) overwrites the current state, it completely erases the roommate's 60ml deduction, creating inventory inconsistency.

## Decision
We implement **delta-only sync for offline inventory operations** with the following rules:

1. **Offline Queue Only Accepts Deltas**: When the app detects it is offline, the UI disables absolute value inputs and only allows relative changes (+/-)
2. **Absolute Updates Require Online State**: Manual "set to X" operations are only available when online
3. **Conflict Resolution**: Server applies deltas sequentially in timestamp order
4. **Validation**: Server validates final state doesn't go negative after applying all deltas

### Specific Implementation

#### Frontend (Offline Detection)
```typescript
class InventoryService {
  async updateInventory(ingredientId: string, change: number, unit: string): Promise<void> {
    if (this.isOffline) {
      // Offline: only accept deltas
      if (typeof change !== 'number') {
        throw new Error('Absolute updates not allowed offline. Use delta (+/-) instead.');
      }
      
      // Queue delta operation
      this.offlineQueue.add({
        type: 'inventory_delta',
        ingredientId,
        delta: change, // + or - value
        unit,
        timestamp: new Date().toISOString()
      });
    } else {
      // Online: can do absolute or delta
      await this.api.updateInventory(ingredientId, change, unit);
    }
  }
}
```

#### Backend (Delta Application)
```typescript
class OfflineSyncService {
  async processDeltas(userId: string, deltas: DeltaOperation[]): Promise<void> {
    // Sort by client timestamp
    const sortedDeltas = deltas.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Apply sequentially
    for (const delta of sortedDeltas) {
      await this.applyDelta(userId, delta);
    }
    
    // Final validation
    await this.validateNoNegativeInventory(userId);
  }
  
  private async applyDelta(userId: string, delta: DeltaOperation): Promise<void> {
    const current = await this.getCurrentInventory(userId, delta.ingredientId);
    const newValue = current + delta.delta;
    
    // Check for negative
    if (newValue < 0) {
      throw new ConflictException(
        `Applying delta ${delta.delta} would make inventory negative for ${delta.ingredientId}`
      );
    }
    
    await this.updateInventory(userId, delta.ingredientId, newValue);
  }
}
```

## Consequences

### Positive
- **Conflict Prevention**: Eliminates overwrite conflicts between users
- **Temporal Consistency**: Operations applied in timestamp order
- **Predictable Behavior**: Users understand offline limitations
- **Data Integrity**: Final state is mathematically correct sum of all deltas

### Negative
- **UX Limitation**: Users cannot do absolute audits while offline
- **Complex UI**: Need to disable/hide absolute update controls when offline
- **Learning Curve**: Users must understand "delta-only" concept
- **Error Handling**: Need clear error messages when attempting absolute updates offline

### Architectural Trade-off: Duplicated Math Engine for Offline UI
**Explicit Trade-off:** To enable optimistic UI updates while offline, the Angular frontend must duplicate the complex `UnitConverterService` logic from the backend. This violates DRY (Don't Repeat Yourself) principle but is necessary because:

1. **Offline Optimistic UI**: When a user prepares a cocktail offline, the UI must immediately show the updated inventory quantity. If the recipe requires 1.5 oz and inventory is stored in ml, Angular must convert oz to ml to calculate and display the correct remaining amount.
2. **Mathematical Consistency**: Both client and server must use identical conversion factors (oz→ml, tbsp→ml, etc.) and `decimal.js` precision to prevent UI/server state desync.
3. **Maintenance Burden**: Any changes to unit conversion logic must be synchronized across both codebases (Node.js backend and Angular frontend).
4. **Acceptance Rationale**: We accept this duplication because the alternative—shipping raw inventory data to the client and performing all calculations server-side—would make the offline UI unresponsive and require complex prediction logic.

**Mitigation Strategy:**
- Shared TypeScript library for `UnitConverterService` (if monorepo structure allows)
- Comprehensive cross-platform unit tests to ensure mathematical parity
- Versioned conversion constants with backward compatibility checks

### Architectural Trade-off: Frontend Trust in Offline Preparation Math
**Senior Architectural Decision: Frontend Trust in Offline Preparation Math**
**Explicit Trade-off:** For offline preparation of dynamic volume cocktails (part-based recipes), the backend will blindly trust and apply the mathematical Delta calculated by the Angular frontend's `decimal.js` engine at the time the button was clicked. We accept the edge-case risk that frontend and backend conversion constants could theoretically diverge, prioritizing offline UX over strict backend recalculation of historic offline intent.

**Part-Based Cocktail Edge Case:**
- When a user offline-prepares a part-based cocktail (e.g., 1 part Gin, 1 part Campari), they must provide `totalVolumeMl`
- Angular calculates the delta using its local `decimal.js` engine (e.g., -1.5 oz for Gin)
- If global database conversion factors change, or density constants diverge, the frontend's delta calculation may desync from backend expectations
- **Acceptance:** We trust the frontend's calculation as the user's intent at the time of offline preparation

## Alternatives Considered

### 1. Last Write Wins (Absolute Overwrites)
- **Pros**: Simple implementation, users can audit offline
- **Cons**: Data loss when multiple users edit same inventory
- **Decision**: Rejected due to data integrity concerns

### 2. Merge with Conflict Detection
- **Pros**: Attempts to merge changes intelligently
- **Cons**: Extremely complex, ambiguous merge rules
- **Decision**: Rejected for MVP due to complexity

### 3. Operational Transformation (OT)
- **Pros**: Theoretical perfection for collaborative editing
- **Cons**: Very complex, overkill for inventory management
- **Decision**: Rejected as over-engineering

### 4. Locking with Online Requirement
- **Pros**: Absolute consistency
- **Cons**: Poor UX - blocks all edits when one user is offline
- **Decision**: Rejected due to poor multi-user experience

## Implementation Details

### Frontend UI Patterns

#### 1. Offline Detection & UI Adaptation
```typescript
// Component that adapts based on connectivity
@Component({
  template: `
    <div *ngIf="isOnline">
      <!-- Online: show both absolute and delta controls -->
      <input [(ngModel)]="absoluteValue" placeholder="Set to...">
      <button (click)="setAbsolute()">Set</button>
    </div>
    
    <div *ngIf="!isOnline">
      <!-- Offline: only delta controls -->
      <input [(ngModel)]="deltaValue" placeholder="+/- amount">
      <button (click)="addDelta()">Add/Remove</button>
      <p class="help-text">Offline mode: only relative changes allowed</p>
    </div>
  `
})
```

#### 2. Queue Visualization
```typescript
// Show pending offline operations
@Component({
  template: `
    <div *ngIf="offlineQueue.length > 0">
      <h3>Pending Offline Changes ({{ offlineQueue.length }})</h3>
      <ul>
        <li *ngFor="let op of offlineQueue">
          {{ op.ingredientName }}: {{ op.delta > 0 ? '+' : '' }}{{ op.delta }}{{ op.unit }}
        </li>
      </ul>
    </div>
  `
})
```

### Backend Validation

#### 1. Delta-Only Validation
```typescript
@Post('offline/sync')
async syncOfflineOperations(@Body() body: SyncRequest): Promise<SyncResponse> {
  // Validate all operations are deltas
  for (const op of body.operations) {
    if (op.type === 'inventory_update' && op.operation !== 'delta') {
      throw new BadRequestException(
        'Absolute inventory updates not allowed in offline sync. Use delta operations.'
      );
    }
  }
  
  // Process deltas
  return await this.offlineSyncService.process(body);
}
```

#### 2. Timestamp-Based Ordering
```typescript
private sortAndValidateDeltas(deltas: DeltaOperation[]): DeltaOperation[] {
  // Sort by client timestamp
  const sorted = [...deltas].sort((a, b) => 
    new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime()
  );
  
  // Check for reasonable timestamps (not in future, not too far in past)
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  for (const delta of sorted) {
    const deltaTime = new Date(delta.clientTimestamp);
    
    if (deltaTime > now) {
      throw new BadRequestException('Operation timestamp cannot be in the future');
    }
    
    if (deltaTime < oneWeekAgo) {
      throw new BadRequestException('Operation timestamp is too far in the past');
    }
  }
  
  return sorted;
}
```

### Error Handling & User Communication

#### 1. Clear Error Messages
```typescript
// When user tries absolute update offline
showError(message: string) {
  if (message.includes('Absolute updates not allowed offline')) {
    this.ui.showToast(
      'Cannot set absolute values while offline. ' +
      'Please use "+" or "-" to adjust quantities, or reconnect to set exact values.',
      'warning',
      5000
    );
  }
}
```

#### 2. Conflict Resolution UI
```typescript
// When sync fails due to negative inventory
handleSyncConflict(error: ConflictException) {
  this.ui.showDialog({
    title: 'Sync Conflict',
    message: 'Applying your offline changes would make inventory negative. ' +
             'Please review and adjust your changes.',
    actions: [
      { text: 'Review Changes', primary: true },
      { text: 'Discard Changes', danger: true }
    ]
  });
}
```

## Related Decisions
- [ADR 0001: Use PostgreSQL for Inventory Management](./0001-use-postgresql-for-inventory.md)
- UC 12.4: Offline Sync with Delta Operations
- UC 1.28: Inventory Update Payload Structure

## Evolution Plan
1. **Phase 2**: Add conflict visualization showing what changes would be overwritten
2. **Phase 3**: Implement optional "force overwrite" for admin users
3. **Phase 4**: Explore operational transformation for true collaborative editing