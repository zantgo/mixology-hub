# ADR 0014: Composite Cursor Pagination Cache Jitter

## Status
Accepted

## Context
Unified search (UC 2.6) uses composite cursor pagination blending:
1. **Local Database**: Cursor-based with `(created_at, id)` for PostgreSQL results
2. **External API**: Offset-based with array indexes for cached TheCocktailDB results
3. **Redis Caching**: External API results cached with 6-hour TTL (UC 2.3)

The composite cursor is Base64-encoded JSON containing:
- Local cursor timestamp and UUID
- External API array offset index
- Cache keys are derived deterministically from search queries

**The Problem**: Cache jitter during deep pagination:
1. User paginates to page 3 (items 21-30)
2. Pauses for 7 hours (exceeds 6-hour Redis TTL)
3. Clicks "Next Page" (page 4)
4. Cache miss forces re-fetch from external API
5. External API may have changed ordering (new cocktails added)
6. Array slicing misaligns, causing skipped or duplicated items

This breaks pagination consistency guarantees and creates poor user experience with "jumping" results.

## Decision
Accept cache jitter as a necessary trade-off for external API integration with the following mitigations:

1. **Clear TTL Communication**: Document 6-hour cache lifetime in UI
2. **Smart Cache Warming**: Pre-fetch next page when user approaches cache boundary
3. **Graceful Degradation**: When cache expires, restart pagination from beginning with warning
4. **Monitoring**: Track cache hit/miss rates and user impact
5. **User Education**: Explain external data limitations

### Implementation
```typescript
class UnifiedSearchService {
  async unifiedSearch(
    limit: number,
    cursor?: string,
    query?: string
  ): Promise<PaginatedResponse<Cocktail>> {
    let localCursor = null;
    let externalOffset = 0;
    
    // Derive cache key deterministically from the query
    const cacheKey = query ? `search:${query.toLowerCase().trim()}` : 'search:all';
    
    // Parse composite cursor if provided
    if (cursor) {
      const parsed = this.parseCompositeCursor(cursor);
      localCursor = parsed.localCursor;
      externalOffset = parsed.externalOffset;
    }
    
    // Check if external cache is still valid
    const cacheValid = await this.isCacheValid(cacheKey);
    
    if (!cacheValid && externalOffset > 0) {
      // Cache expired during pagination - restart with warning
      return {
        data: [],
        nextCursor: null,
        hasMore: false,
        limit,
        warning: {
          type: 'CACHE_EXPIRED',
          message: 'Search results have been refreshed. ' +
                   'Please restart your search from the beginning.',
          timestamp: new Date().toISOString()
        }
      };
    }
    
    // Fetch results (existing logic)
    const localResults = await this.getLocalCocktails(limit, localCursor, query);
    const externalResults = await this.getExternalCocktails(limit, externalOffset, query, cacheKey);
    
    // Combine and return
    return this.combineResults(localResults, externalResults, limit);
  }
  
  private async isCacheValid(cacheKey: string): Promise<boolean> {
    try {
      const ttl = await this.redis.ttl(cacheKey);
      return ttl > 0; // Cache still has time remaining
    } catch (error) {
      // Redis error - assume invalid for safety
      return false;
    }
  }
}
```

## Consequences

### Positive
- **Fresh Data**: External API changes reflected within 6 hours
- **Storage Efficiency**: No need to cache infinite external data
- **Simple Implementation**: Clear cache invalidation strategy
- **Cost Effective**: Limited Redis storage usage

### Negative
- **Pagination Jitter**: Users may see duplicates or skips
- **Poor UX**: Frustrating experience during deep pagination
- **Inconsistent Results**: Different users see different ordering
- **Broken Navigation**: "Back" button may not return to same results

## Alternatives Considered

### 1. Infinite Cache (No TTL)
- **Pros**: Perfect pagination consistency
- **Cons**: Unbounded Redis growth, stale data forever
- **Decision**: Rejected - storage cost and stale data unacceptable

### 2. Database Storage of External Results
- **Pros**: Permanent storage, consistent pagination
- **Cons**: Database bloat, copyright/licensing issues, sync complexity
- **Decision**: Rejected - legal and technical complexity too high

### 3. Real-Time External API Every Request
- **Pros**: Always fresh data
- **Cons**: Slow, rate limit concerns, external dependency
- **Decision**: Rejected - performance and reliability concerns

### 4. User-Specific Caching
- **Pros**: Personalized cache lifetime
- **Cons**: Complex, still has jitter, storage multiplier
- **Decision**: Rejected - complexity outweighs benefit

## Mitigation Strategies

### 1. UI Transparency
```typescript
// Show cache status in UI
@Component({
  template: `
    <div *ngIf="searchWarning" class="cache-warning">
      <span class="warning-icon">⚠️</span>
      <span>{{ searchWarning.message }}</span>
      <button (click)="dismissWarning()">×</button>
    </div>
    
    <div class="search-info">
      <span class="cache-status" [class.fresh]="isCacheFresh" [class.stale]="!isCacheFresh">
        {{ isCacheFresh ? 'Fresh results' : 'Results updating...' }}
      </span>
      <span class="cache-ttl" *ngIf="cacheTtl">
        Refreshes in {{ cacheTtl | timeRemaining }}
      </span>
    </div>
    
    <div class="pagination">
      <button (click)="prevPage()" [disabled]="!hasPrev">Previous</button>
      <span>Page {{ currentPage }}</span>
      <button (click)="nextPage()" [disabled]="!hasNext">Next</button>
    </div>
  `
})
class SearchComponent {
  searchWarning: SearchWarning | null = null;
  isCacheFresh = true;
  cacheTtl: number | null = null;
  
  async search(query: string): Promise<void> {
    const response = await this.searchService.unifiedSearch(query, this.limit, this.cursor);
    
    // Handle cache warnings
    if (response.warning) {
      this.searchWarning = response.warning;
      this.isCacheFresh = false;
    }
    
    // Update cache TTL display
    this.cacheTtl = response.cacheTtl;
    this.isCacheFresh = this.cacheTtl > 3600; // > 1 hour = fresh
    
    // Update pagination state
    this.cursor = response.nextCursor;
    this.hasPrev = this.cursorHistory.length > 0;
    this.hasNext = response.hasMore;
  }
}
```

### 2. Smart Cache Warming
```typescript
// Pre-fetch next page when user approaches cache boundary
@Injectable()
export class CacheWarmingService {
  private readonly CACHE_WARNING_THRESHOLD = 3600; // 1 hour
  
  async warmCacheForUser(userId: string, searchQuery: string): Promise<void> {
    // Check if user is actively searching
    const userActivity = await this.getUserSearchActivity(userId);
    
    if (userActivity.isActive && userActivity.query === searchQuery) {
      // Check cache TTL for their current cursor
      const cursor = userActivity.cursor;
      const cacheInfo = await this.getCacheInfo(cursor);
      
      if (cacheInfo.ttl < this.CACHE_WARNING_THRESHOLD) {
        // Cache nearing expiration - warm it
        await this.warmCache(searchQuery, cursor);
        
        // Notify user if they're on a deep page
        if (userActivity.page > 3) {
          this.notifyUser(
            userId,
            'Search results are being refreshed',
            'Your search results will update shortly to ensure consistency.'
          );
        }
      }
    }
  }
  
  private async warmCache(query: string, cursor: string): Promise<void> {
    // Parse cursor to get external offset
    const parsed = this.parseCompositeCursor(cursor);
    
    // Derive cache key from query
    const cacheKey = query ? `search:${query.toLowerCase().trim()}` : 'search:all';
    
    // Fetch next page of external results to refresh cache
    await this.searchService.getExternalCocktails(
      20, // Fetch extra for buffer
      parsed.externalOffset,
      query,
      cacheKey,
      { refresh: true } // Force cache refresh
    );
  }
}
```

### 3. Graceful Pagination Restart
```typescript
// When cache expires, help user restart gracefully
@Injectable()
export class PaginationRecoveryService {
  async handleCacheExpiration(
    userId: string,
    query: string,
    expiredCursor: string
  ): Promise<RecoveryOptions> {
    // Parse expired cursor to understand context
    const parsed = this.parseCompositeCursor(expiredCursor);
    
    // Determine recovery options
    const options: RecoveryOptions = {
      restartFromBeginning: {
        label: 'Restart search from beginning',
        action: () => this.restartSearch(query)
      },
      continueWithWarning: {
        label: 'Continue with possible duplicates',
        action: () => this.continueWithNewCache(query, parsed)
      },
      saveCurrentResults: {
        label: 'Save current page before restarting',
        action: () => this.saveCurrentPage(userId, query, parsed)
      }
    };
    
    // Log cache expiration for analytics
    await this.analytics.logCacheExpiration({
      userId,
      query,
      externalOffset: parsed.externalOffset,
      timestamp: new Date().toISOString()
    });
    
    return options;
  }
}
```

### 4. User Education and Documentation
```typescript
// Help users understand cache limitations
@Component({
  template: `
    <div class="search-help">
      <details>
        <summary>About search results</summary>
        <div class="help-content">
          <h3>External Data Sources</h3>
          <p>
            MixologyHub combines your personal recipes with external cocktail data
            from TheCocktailDB. External results are cached for 6 hours to ensure
            fast searching.
          </p>
          
          <h3>Pagination Limitations</h3>
          <p>
            <strong>Note:</strong> When browsing many pages of results, the cache
            may expire. If this happens, you'll see a warning and may need to
            restart your search from the beginning.
          </p>
          
          <h3>Tips for Best Experience</h3>
          <ul>
            <li>Use filters to reduce result sets</li>
            <li>Complete deep pagination within 6 hours</li>
            <li>Save interesting cocktails to your favorites</li>
            <li>Report any issues with search consistency</li>
          </ul>
        </div>
      </details>
    </div>
  `
})
class SearchHelpComponent {}
```

## Monitoring and Analytics

### 1. Cache Performance Tracking
```typescript
@Injectable()
export class CacheAnalyticsService {
  async trackCacheMetrics(): Promise<void> {
    const metrics = {
      hitRate: await this.getCacheHitRate(),
      expirationEvents: await this.getCacheExpirationCount('24h'),
      userImpact: await this.getUserImpactScore(),
      avgTtlAtExpiration: await this.getAverageTtlAtExpiration()
    };
    
    // Alert if cache performance degrading
    if (metrics.hitRate < 0.8) { // Less than 80% hit rate
      this.alertService.sendAlert({
        severity: 'warning',
        title: 'Low Cache Hit Rate',
        message: `Cache hit rate at ${(metrics.hitRate * 100).toFixed(1)}%`,
        details: metrics
      });
    }
    
    if (metrics.expirationEvents > 100) { // More than 100 expirations in 24h
      this.alertService.sendAlert({
        severity: 'warning',
        title: 'High Cache Expiration Rate',
        message: `${metrics.expirationEvents} cache expirations in 24 hours`,
        details: metrics
      });
    }
  }
}
```

## Related Decisions
- UC 2.6: Unified Pagination Handling (composite cursor)
- UC 2.3: Redis Caching for External APIs (6-hour TTL)
- ADR 0008: O(N×Page) DoS Risk in Makeability Pagination (pagination limits)

## Evolution Plan
1. **Phase 2**: Implement predictive cache warming based on user behavior
2. **Phase 3**: Add user preference for cache behavior (freshness vs consistency)
3. **Phase 4**: Explore persistent external data storage with incremental updates