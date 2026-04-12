# ADR 0008: Page-based Pagination DoS Protection

## Status
Accepted

## Context
With the migration to standardized page-based pagination across all endpoints, we must address Denial of Service (DoS) vulnerabilities inherent in offset-based pagination:

**The Problem**: Offset-based pagination (`OFFSET` in SQL) has O(N) complexity where N is the offset value. To serve page 100 (items 991-1000):
1. Database must scan through first 990 records
2. Discard them, then return items 991-1000
3. Performance degrades linearly with page number
4. Malicious users can request deep pages to exhaust database resources

**The Attack Vector**: A malicious user requests `page=1000` (items 9,991-10,000):
- PostgreSQL must scan through ~10,000 records
- Query execution time increases linearly
- Database CPU and I/O resources exhausted
- Legitimate users experience slow responses or timeouts

**Makeability-Specific Risk**: The makeability engine performs in-memory unit conversions. Deep pagination would require processing thousands of cocktails in memory, blocking the Node.js event loop.

## Decision
Implement **strict pagination limits across all endpoints** to prevent DoS attacks:

1. **Global Page Limit**: Maximum `page=100` across all endpoints
2. **Limit Validation**: `limit` parameter capped at 100
3. **Early Rejection**: Return `400 Bad Request` for requests beyond limits
4. **Clear Error Messages**: Explain pagination constraints to users
5. **Consistent Implementation**: All endpoints use same validation rules

**Rationale**: Capping at page 100 (1,000 items with default limit of 10) provides reasonable browsing depth while preventing performance degradation. Users needing deeper results should use search filters.

### Implementation
```typescript
// Global pagination DTO with validation
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Number of items to return (default: 10, max: 100)', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @IsPositive()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Page number (default: 1, max: 100 to prevent database performance degradation)', minimum: 1, maximum: 100, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100, { message: 'Page number cannot exceed 100 to prevent database performance degradation.' })
  @Type(() => Number)
  page?: number = 1;
}

// Makeability engine with page-based pagination
class MakeabilityEngine {
  private readonly MAX_ITERATIONS = 200;
  
  async findMakeableCocktails(
    userId: string,
    limit: number = 10,
    page: number = 1
  ): Promise<{ data: Cocktail[]; meta: PaginationMeta }> {
    const offset = (page - 1) * limit;
    
    // 1. Get candidate cocktails from SQL
    const candidates = await this.getCandidateCocktails(userId);
    
    // 2. Evaluate with iteration limit
    const makeableCocktails: Cocktail[] = [];
    let iterations = 0;
    
    for (const cocktail of candidates) {
      if (iterations >= this.MAX_ITERATIONS) {
        break; // Prevent DoS from sparse makeability
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
    
    // 3. Check for pagination overshoot
    if (iterations >= this.MAX_ITERATIONS && makeableCocktails.length > 0 && makeableCocktails.length <= offset) {
      throw new BadRequestException(
        'Pagination overshoot: Requested page exceeds available results due to computation limits.',
        'PAGINATION_OVERSHOOT'
      );
    }
    
    // 4. Apply pagination (offset/limit)
    const paginated = makeableCocktails.slice(offset, offset + limit);
    
    // 5. Determine if there are more results
    const hasMore = iterations < this.MAX_ITERATIONS && makeableCocktails.length >= limit + offset;
    
    const totalItems = makeableCocktails.length;
    
    return {
      data: paginated,
      meta: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasMore
      },
      iterations
    };
  }
}

// Global pagination validation (applies to all endpoints)
function validatePagination(limit: number, page: number): void {
  const maxPage = 100;
  const maxLimit = 100;
  
  if (limit > maxLimit) {
    throw new BadRequestException(
      `Limit ${limit} exceeds maximum allowed limit ${maxLimit}. ` +
      `Please use a smaller limit value.`
    );
  }
  
  if (page > maxPage) {
    throw new BadRequestException(
      `Page ${page} exceeds maximum allowed page ${maxPage}. ` +
      `Due to database performance constraints, deep pagination is limited. ` +
      `Please use search filters to reduce result sets.`
    );
  }
}

// Makeability endpoint with page-based pagination
@Get('/user-inventory/makeable')
async getMakeableCocktails(
  @Query('limit', new DefaultValuePipe(10), new ParseIntPipe({ min: 1, max: 100 })) limit: number,
  @Query('page', new DefaultValuePipe(1), new ParseIntPipe({ min: 1, max: 100 })) page: number,
  @Query('sort') sort?: string
): Promise<PaginatedResponse<Cocktail>> {
  
  // Apply global pagination validation
  validatePagination(limit, page);
  
  const result = await this.makeabilityEngine.findMakeableCocktails(userId, limit, page);
  
  return {
    data: result.data,
    meta: {
      currentPage: page,
      nextPage: result.meta.hasMore ? page + 1 : null,
      itemsPerPage: limit,
      totalItems: result.meta.totalItems,
      totalPages: result.meta.totalPages,
      // Include iteration limits for makeability within meta object
      iterations: result.iterations,
      maxIterations: this.makeabilityEngine.MAX_ITERATIONS,
      warning: result.iterations >= this.makeabilityEngine.MAX_ITERATIONS 
        ? 'Results limited by computation constraints. Try filtering to reduce candidates.'
        : null
    }
  };
}
```

### Architectural Decision: Standardized Page-based Pagination
* **Explicit Trade-off:** All endpoints now use standardized page-based pagination with consistent response format. The `GET /user-inventory/makeable` endpoint returns the same `meta` object as all other paginated endpoints, including `currentPage`, `nextPage`, `itemsPerPage`, `totalItems`, and `totalPages`, with additional makeability-specific fields (`iterations`, `maxIterations`, `warning`) included within the `meta` object. We trade cursor-based pagination performance benefits for API consistency and simplicity across all endpoints.

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
  - **Architectural Decision: Pagination Data-Dropping for Sparse Inventories**
  - **Explicit Trade-off:** To protect against CPU DoS attacks, the in-memory Makeability Engine terminates after 200 evaluations. We explicitly accept that users with highly restrictive inventories will experience "data-dropping"—receiving false "end of results" indicators during pagination. We trade absolute data completeness for guaranteed server uptime, deferring the fix to Phase 4 (Database Materialized Views).
  - **Architectural Decision: Chronological Bias in Makeability Discovery**
  - **Explicit Trade-off:** Because the in-memory Makeability Engine halts after 200 iterations to protect the Node.js event loop, the system can only evaluate the 200 most recently created candidate cocktails supplied by the database. We explicitly accept a "Chronological Bias" where older, perfectly makeable cocktails may remain permanently undiscoverable for users with sparse inventories. We trade absolute discovery comprehensiveness for guaranteed server stability, deferring the fix to Phase 4 (Database Materialized Views).
- **O(N) Redundant Computation**: Because we use offset-based pagination combined with in-memory filtering for Makeability, requesting Page 5 (offset=40) forces Node.js to recalculate the exact same unit conversion math for the first 40 items just to discard them.
  - **Architectural Decision: O(N) Redundant Computation on Deep Pagination**
  - **Explicit Trade-off:** Because we use offset-based pagination combined with in-memory filtering for Makeability, we explicitly accept a CPU penalty where the backend must recalculate the unit-conversion math for all previous pages on every subsequent page request. We trade this O(N) redundant computational waste for the immediate delivery of MVP dynamic sorting, bounding the damage via the 200-iteration hard cap.
  - **Architectural Decision: Hard Stop on Pagination Overshoot**
  - **Explicit Trade-off:** Because the Makeability Engine caps iterations at 200, deep offsets may exceed the total number of found cocktails. We dictate that if the engine hits the 200-iteration limit and cannot fill the requested page, it returns a `400 Bad Request: PAGINATION_OVERSHOOT`. Instead of automatically resetting the user to Page 1 (which creates an infinite UI trap), the Angular frontend will catch this error, instantly **disable the "Next Page" button**, and display a toast: *"Computation limit reached. Please use search filters to refine your inventory results."* We trade deep-pagination exploration for guaranteed event-loop safety and a predictable UX dead-end.

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
            'Computation limit reached. Please use search filters to refine your inventory results.',
            'warning'
          );
          // Disable next page button instead of resetting to page 1
          this.ui.disableNextPageButton();
          return [];
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
// Synchronous export with same 200-iteration limit
POST /user-inventory/makeable/export
// Returns truncated CSV immediately (no background processing)
```

### 3. Alternative Sort Options
```typescript
// Use page-based pagination with chronological sort
GET /user-inventory/makeable?sort=relevance&page=1&limit=10
```

## Related Decisions
- ADR 0004: Accept In-Memory Math Overhead for MVP
- UC 3.25: Makeability Engine with In-Memory Math Validation
- API Spec: Offset-based pagination for dynamic sorting endpoints

## Evolution Plan
1. **Phase 2**: Implement filtering UI to help users reduce result sets
2. **Phase 3**: Add synchronous export functionality with same computational limits
3. **Phase 4**: Migrate to PostgreSQL materialized views (per ADR 0004) to remove limits

## Architectural Decision: Hard Data Caps on Export Portability
**Explicit Trade-off:** Because asynchronous background jobs and message queues are forbidden, we cannot process or stream massive Makeable Cocktail CSV exports offline. Users attempting to export their "Makeable" list are strictly bound by the exact same synchronous 200-iteration computational limit as the UI. We explicitly accept that power users with massive inventories will only ever be able to export truncated, partial data sets. We trade comprehensive GDPR/Data portability for absolute adherence to the zero-concurrency mandate.