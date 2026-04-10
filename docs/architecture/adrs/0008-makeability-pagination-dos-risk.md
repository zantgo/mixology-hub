# ADR 0008: O(N×Page) DoS Risk in Makeability Pagination

## Status
Accepted

## Context
The makeability engine (ADR 0004) performs unit conversions in Node.js instead of PostgreSQL. When combined with offset-based pagination for dynamic sorting (`sort=makeability`), this creates a significant Denial of Service (DoS) vulnerability:

**The Problem**: To serve page 5 (items 41-50) of makeable cocktails sorted by makeability:
1. Backend queries database for candidate cocktails
2. Performs in-memory unit conversion math on ALL results
3. Sorts results by makeability score in memory  
4. Discards first 40 items, returns items 41-50

**The Attack Vector**: A malicious user requests `page=1000` (items 9,991-10,000):
- Node.js must process ~10,000 cocktails in memory
- Each cocktail requires complex unit conversions
- Event loop blocked for seconds/minutes
- Server becomes unresponsive to other requests

This breaks the "early termination" optimization mentioned in UC 3.25 where the system could stop after finding `limit` makeable cocktails.

## Decision
Implement **strict computational limits for makeability endpoints**:

1. **Maximum Iteration Depth**: Evaluate at most 200 candidate cocktails per request
2. **Partial Results Allowed**: Return fewer than `limit` results if max iterations reached
3. **Hard Page Limit**: Maximum `page=10` (100 items with default `limit=10`)
4. **Maximum Offset**: Maximum `offset=100` regardless of page/limit combination
5. **Early Termination**: Stop processing after finding `limit` makeable cocktails OR reaching max iterations
6. **Early Rejection**: Return `400 Bad Request` for requests beyond limits
7. **Clear Error Messages**: Explain the computational constraints to users

**Critical Fix for Sparse Makeability DoS**: Even Page 1 requests must be bounded. If a user has 1ml of every ingredient, SQL returns all cocktails, but we only evaluate 200 before returning partial results.

### Implementation
```typescript
// Makeability engine with iteration limits
class MakeabilityEngine {
  private readonly MAX_ITERATIONS = 200;
  
  async findMakeableCocktails(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ cocktails: Cocktail[]; hasMore: boolean; iterations: number }> {
    // 1. Get candidate cocktails from SQL (HAVING clause)
    const candidates = await this.getCandidateCocktails(userId);
    
    // 2. Evaluate with iteration limit
    const makeableCocktails: Cocktail[] = [];
    let iterations = 0;
    
    for (const cocktail of candidates) {
      if (iterations >= this.MAX_ITERATIONS) {
        break; // Critical: Prevent DoS from sparse makeability
      }
      
      iterations++;
      
      const isMakeable = await this.validateMakeability(cocktail, userId);
      if (isMakeable) {
        makeableCocktails.push(cocktail);
        
        // Early termination: found enough for current page
        if (makeableCocktails.length >= limit + offset) {
          break;
        }
      }
    }
    
    // 3. Check for pagination overshoot (sparse inventory edge case)
    if (makeableCocktails.length > 0 && makeableCocktails.length <= offset) {
      throw new BadRequestException(
        'Pagination overshoot: Requested page exceeds available results due to computation limits.',
        'PAGINATION_OVERSHOOT'
      );
    }
    
    // 4. Apply pagination (offset/limit)
    const paginated = makeableCocktails.slice(offset, offset + limit);
    
    // 5. Determine if there are more results
    // hasMore = true if we didn't hit iteration limit AND have more candidates
    const hasMore = iterations < this.MAX_ITERATIONS && 
                   makeableCocktails.length >= limit + offset;
    
    return {
      cocktails: paginated,
      hasMore,
      iterations
    };
  }
}

// Pagination validation middleware
function validateMakeabilityPagination(limit: number, page: number): void {
  const maxPage = 10;
  const maxOffset = 100;
  
  const offset = (page - 1) * limit;
  
  if (page > maxPage) {
    throw new BadRequestException(
      `Page ${page} exceeds maximum allowed page ${maxPage} for makeability sorting. ` +
      `Due to in-memory computation constraints (ADR 0004), deep pagination is limited.`
    );
  }
  
  if (offset > maxOffset) {
    throw new BadRequestException(
      `Offset ${offset} exceeds maximum allowed offset ${maxOffset} for makeability sorting. ` +
      `Please use a smaller page number or contact support for bulk data needs.`
    );
  }
}

// Makeability endpoint
@Get('/user-inventory/makeable')
async getMakeableCocktails(
  @Query('limit', new DefaultValuePipe(10), new ParseIntPipe({ min: 1, max: 100 })) limit: number,
  @Query('page', new DefaultValuePipe(1), new ParseIntPipe({ min: 1 })) page: number,
  @Query('sort') sort?: string
): Promise<PaginatedResponse<Cocktail>> {
  
  // Only apply limits for makeability sorting
  if (sort === 'makeability') {
    validateMakeabilityPagination(limit, page);
  }
  
  const offset = (page - 1) * limit;
  const result = await this.makeabilityEngine.findMakeableCocktails(userId, limit, offset);
  
  return {
    data: result.cocktails,
    nextCursor: result.hasMore ? this.createCursor(page, limit) : null,
    hasMore: result.hasMore,
    limit,
    // Include metadata about iteration limits
    metadata: {
      iterations: result.iterations,
      maxIterations: this.makeabilityEngine.MAX_ITERATIONS,
      warning: result.iterations >= this.makeabilityEngine.MAX_ITERATIONS 
        ? 'Results limited by computation constraints. Try filtering to reduce candidates.'
        : null
    }
  };
}
```

## Consequences

### Positive
- **DoS Protection**: Prevents event loop blocking from malicious deep pagination
- **Predictable Performance**: Guaranteed O(100) worst-case computation
- **Resource Protection**: Server resources protected from abuse
- **Clear Boundaries**: Users understand system limitations

### Negative
- **UX Limitation**: Users cannot paginate beyond 100 makeable cocktails
- **Incomplete Results**: Users with large inventories may not see all makeable cocktails
- **Partial Pages**: Page 1 may return fewer than `limit` results if max iterations reached
- **Workaround Needed**: Power users need alternative ways to access full results
- **API Inconsistency**: Different pagination limits for different sort options
- **Variable Page Sizes**: Pages may have varying numbers of results (not always `limit`)
- **Sparse Inventory Data-Dropping**: Users with highly restrictive inventories (e.g., only Vodka and Lime) will experience data-dropping during pagination. Because the loop terminates at 200 iterations, the system only finds a limited number of makeable cocktails. Slicing at high offsets (e.g., offset=100) may return 0 results even if 50 valid makeable cocktails exist further down the database list, because the engine gives up computing.
  - **Senior Architectural Decision: Pagination Data-Dropping for Sparse Inventories**
  - **Explicit Trade-off:** To protect against CPU DoS attacks, the in-memory Makeability Engine terminates after 200 evaluations. We explicitly accept that users with highly restrictive inventories will experience "data-dropping"—receiving false "end of results" indicators during pagination. We trade absolute data completeness for guaranteed server uptime, deferring the fix to Phase 4 (Database Materialized Views).
- **O(N) Redundant Computation**: Because we use offset-based pagination combined with in-memory filtering for Makeability, requesting Page 5 (offset=40) forces Node.js to recalculate the exact same unit conversion math for the first 40 items just to discard them.
  - **Senior Architectural Decision: O(N) Redundant Computation on Deep Pagination**
  - **Explicit Trade-off:** Because we use offset-based pagination combined with in-memory filtering for Makeability, we explicitly accept a CPU penalty where the backend must recalculate the unit-conversion math for all previous pages on every subsequent page request. We trade this O(N) redundant computational waste for the immediate delivery of MVP dynamic sorting, bounding the damage via the 200-iteration hard cap.
  - **Senior Architectural Decision: Sparse Inventory Page Shifting**
  - **Explicit Trade-off:** Because the Makeability Engine caps iterations at 200, deep offsets may exceed the total number of found cocktails, resulting in empty pages. We dictate that if `makeableCocktails.length > 0` but `makeableCocktails.length <= offset`, the backend will return a `400 Bad Request` with a specialized error code `PAGINATION_OVERSHOOT`. The Angular frontend will catch this and automatically reset the user to `page=1`, displaying a toast notification: "Result limits reached. Showing top available cocktails." We accept this pagination reset as a necessary UX compromise to accommodate the CPU limits.

## Alternatives Considered

### 1. No Limits (Current Risk)
- **Pros**: Unlimited access to data
- **Cons**: Severe DoS vulnerability, unpredictable performance
- **Decision**: Rejected - security risk too high

### 2. Progressive Limits Based on Load
- **Pros**: Adaptive to server conditions
- **Cons**: Complex, unpredictable for users
- **Decision**: Rejected for MVP - too complex

### 3. Background Processing with Caching
- **Pros**: No real-time computation limits
- **Cons**: Added latency, cache invalidation complexity
- **Decision**: Rejected - contradicts real-time makeability requirement

### 4. Database Materialized Views
- **Pros**: Native pagination, no computation limits
- **Cons**: Stale data, refresh complexity, Phase 4 feature
- **Decision**: Planned for Phase 4 (see ADR 0004 migration path)

## Implementation Details

### Frontend Adaptation
```typescript
// Angular service handling pagination limits
@Injectable()
export class MakeabilityService {
  async getMakeableCocktails(page: number, limit: number = 10): Promise<Cocktail[]> {
    try {
      return await this.http.get<Cocktail[]>('/user-inventory/makeable', {
        params: { page, limit, sort: 'makeability' }
      }).toPromise();
     } catch (error) {
      if (error.status === 400) {
        if (error.message.includes('exceeds maximum')) {
          // Show user-friendly explanation
          this.ui.showWarning(
            'Cannot load more makeable cocktails due to computation limits. ' +
            'Try filtering by category or ingredient to reduce results.'
          );
          return [];
        } else if (error.code === 'PAGINATION_OVERSHOOT') {
          // Handle sparse inventory pagination overshoot
          this.ui.showToast(
            'Result limits reached. Showing top available cocktails.',
            'info'
          );
          // Automatically reset to page 1
          return this.getMakeableCocktails(1, limit);
        }
      }
      throw error;
    }
  }
  
  // UI component disables "Next" button at page 10
  isLastPage(currentPage: number): boolean {
    return currentPage >= 10;
  }
}
```

### Monitoring and Alerting
```typescript
// Track pagination attempts for security monitoring
@Injectable()
export class PaginationMonitorService {
  logPaginationAttempt(endpoint: string, page: number, limit: number): void {
    this.analytics.track('pagination_attempt', {
      endpoint,
      page,
      limit,
      timestamp: new Date().toISOString()
    });
    
    // Alert on suspicious patterns
    if (page > 20) {
      this.securityAlert('suspicious_deep_pagination', {
        endpoint,
        page,
        limit,
        userId: this.auth.getUserId()
      });
    }
  }
}
```

### User Communication Strategy
1. **UI Indicators**: Show "showing 1-100 of X makeable cocktails" with explanation
2. **Tooltips**: Explain computational constraints when hovering over disabled buttons
3. **Documentation**: API docs clearly state pagination limits for dynamic sorting
4. **Error Messages**: Clear, actionable error messages with suggestions

## Workarounds for Power Users

### 1. Filtering Before Pagination
```typescript
// Instead of page=100, filter by category first
GET /user-inventory/makeable?category=tequila&sort=makeability&page=1
```

### 2. Export Functionality (Future)
```typescript
// Background job for full results
POST /user-inventory/makeable/export
// Returns CSV via email after processing
```

### 3. Alternative Sort Options
```typescript
// Use cursor-based pagination with chronological sort
GET /user-inventory/makeable?sort=relevance&cursor=...
```

## Related Decisions
- ADR 0004: Accept In-Memory Math Overhead for MVP
- UC 3.25: Makeability Engine with In-Memory Math Validation
- API Spec: Offset-based pagination for dynamic sorting endpoints

## Evolution Plan
1. **Phase 2**: Implement filtering UI to help users reduce result sets
2. **Phase 3**: Add background export functionality for power users
3. **Phase 4**: Migrate to PostgreSQL materialized views (per ADR 0004) to remove limits