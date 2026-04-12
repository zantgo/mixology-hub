# ADR 0014: Page-based Pagination Cache Consistency

## Status
Deprecated - Superseded by standardized page-based pagination

## Context
**This ADR has been deprecated** as part of the migration from cursor-based to page-based pagination across the entire application.

### Historical Context (Deprecated)
Previously, unified search used composite cursor pagination blending:
1. **Local Database**: Cursor-based with `(created_at, id)` for PostgreSQL results
2. **External API**: Offset-based with array indexes for cached TheCocktailDB results
3. **Redis Caching**: External API results cached with 6-hour TTL

The composite cursor was Base64-encoded JSON containing local cursor timestamp, UUID, and external API array offset index.

**The Problem (Historical)**: Cache jitter during deep pagination when external API cache expired during user pagination sessions.

### Current Architecture
All pagination now uses standardized page/limit parameters:
- `page`: Page number (1-indexed, max: 100)
- `limit`: Items per page (default: 10, max: 100)
- Response includes `meta` object with pagination metadata

## Decision
**Deprecation Notice**: This ADR is no longer applicable. Cache consistency for external API results is now handled differently:

1. **Simplified Caching**: External API results cached with 5-minute TTL for search queries
2. **Page-based Pagination**: No complex cursor parsing required
3. **Cache Miss Handling**: On cache miss, fresh results are fetched and re-cached
4. **Pagination Limits**: Page number capped at 100 to prevent deep pagination issues

### Current Implementation
```typescript
class UnifiedSearchService {
  async unifiedSearch(
    limit: number,
    page: number = 1,
    query?: string
  ): Promise<PaginatedResponse<Cocktail>> {
    const offset = (page - 1) * limit;
    
    // Generate cache key
    const cacheKey = query ? `search:${query.toLowerCase().trim()}` : 'search:all';
    
    // Try to get cached results
    let cachedResults = await this.cacheManager.get<any[]>(cacheKey);
    
    if (!cachedResults) {
      // Cache miss - fetch fresh data
      cachedResults = await this.fetchSearchResults(query);
      // Cache results for 5 minutes
      await this.cacheManager.set(cacheKey, cachedResults, 300);
    }
    
    // Apply pagination
    const paginatedList = cachedResults.slice(offset, offset + limit);
    const totalItems = cachedResults.length;
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    
    return {
      data: paginatedList,
      meta: {
        currentPage: page,
        nextPage: hasNextPage ? page + 1 : null,
        itemsPerPage: limit,
        totalItems,
        totalPages
      }
    };
  }
}
```

## Consequences of Deprecation

### Positive Changes
- **Simplified Implementation**: No complex cursor encoding/decoding logic
- **Consistent API**: All endpoints use same page/limit parameters
- **Better Developer Experience**: Easier to understand and implement
- **Reduced Complexity**: No need for composite cursor state management
- **Improved Cache Strategy**: Shorter TTL (5 minutes) ensures fresher data

### Trade-offs
- **Page Number Caps**: Users limited to first 100 pages (1,000 results with default limit)
- **Cache Invalidation**: More frequent cache refreshes (5 minutes vs 6 hours)
- **Simplified UX**: No need for complex cache expiration warnings
- **External API Rate Limits**: More frequent API calls due to shorter cache TTL

## Migration Impact

### Code Changes Required
1. **Backend Services**: Updated to use page/limit instead of cursor
2. **API Endpoints**: Changed response format from `{data, nextCursor, hasMore}` to `{data, meta}`
3. **Frontend Services**: Updated to pass `page` parameter instead of `cursor`
4. **UI Components**: Updated to handle new pagination metadata format

### Benefits Realized
- **Unified Pagination**: Consistent approach across all endpoints
- **Simplified Testing**: Easier to test pagination logic
- **Better Documentation**: Clearer API specifications
- **Reduced Bug Surface**: Less complex state management

## Current Cache Strategy

### Simplified Cache Implementation
With page-based pagination, cache management is simplified:

1. **Short TTL**: 5-minute cache for search results
2. **Cache Key**: Based on search query and filters
3. **Cache Miss**: Fresh fetch from external API with re-caching
4. **No Complex State**: No cursor state to preserve across cache boundaries

### Example: Current Search Implementation
```typescript
// Current unified search with page-based pagination
async searchCocktails(query: string, page: number = 1, limit: number = 10) {
  const cacheKey = `search:${query}:${page}:${limit}`;
  
  // Try cache first
  const cached = await this.cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch fresh results
  const results = await this.fetchFromSources(query, page, limit);
  
  // Cache for 5 minutes
  await this.cache.set(cacheKey, results, 300);
  
  return results;
}
```

## Related Decisions
- **ADR 0008**: Page-based Pagination with DoS Protection (page number caps)
- **UC 2.6**: Unified Search with Page-based Pagination
- **UC 2.3**: Redis Caching for External APIs (5-minute TTL for searches)

## Benefits of Simplified Approach
1. **No Cache Jitter Issues**: Short TTL means users rarely encounter expired cache during pagination
2. **Simplified User Experience**: No complex warnings about cache expiration
3. **Fresher Data**: External API results updated every 5 minutes
4. **Reduced Complexity**: No need for composite cursor state management
5. **Consistent Behavior**: All pagination works the same way

## Monitoring Considerations
While cache jitter is no longer a concern, monitor:
- **Cache Hit Rates**: Ensure caching is effective
- **External API Rate Limits**: Watch for increased API calls
- **User Pagination Depth**: Track how deep users paginate
- **Performance Metrics**: Ensure page-based pagination performs well