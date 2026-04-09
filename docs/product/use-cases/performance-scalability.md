# 🔄 Domain 11: Performance & Scalability

**UC 11.1: Database Query Optimization**
* **Given** a user has 100+ ingredients in their inventory.
* **When** they request the "Makeable Cocktails" list.
* **Then** the SQL query uses proper indexing on `user_inventory(ingredient_id, user_id)`.
* **And** completes in under 100ms even with complex joins and unit conversions.

**UC 11.2: Redis Cache Invalidation**
* **Given** a user updates their inventory.
* **When** the inventory change is committed.
* **Then** the system invalidates any cached "Makeable Cocktails" results for that user.
* **And** ensures the next request fetches fresh data reflecting the updated inventory.

**UC 11.3: External API Fallback Strategy**
* **Given** TheCocktailDB API is experiencing an outage.
* **When** a user searches for cocktails.
* **Then** the system gracefully falls back to local database results only.
* **And** logs the API failure for monitoring without impacting user experience.

**UC 11.4: Redis Graceful Degradation**
* **Given** the Redis cache becomes unreachable.
* **When** the Cocktail Aggregator Service attempts to cache or retrieve data.
* **Then** the system logs the Redis connection error.
* **And** gracefully bypasses the cache, calling the external APIs and database directly.
* **And** returns results to the user without throwing a `500 Internal Server Error`.

**UC 11.5: Redis Memory Limit & Eviction**
* **Given** the Redis cache reaches its maximum memory limit.
* **When** the Aggregator attempts to cache a new search result.
* **Then** Redis uses the `allkeys-lru` (Least Recently Used) eviction policy.
* **And** silently evicts the oldest cached searches to make room without throwing an Out Of Memory (OOM) error to the NestJS application.
* **And** monitors cache hit/miss ratios to optimize memory allocation for frequently accessed data.

**UC 11.6: Cache Invalidation Strategy Matrix**
* **Given** various data modification events occur in the system.
* **When** specific events trigger cache invalidation:
  * **User Inventory Change:** Invalidate `makeable:${userId}` cache
  * **Admin Ingredient Synonym Update:** Flush all `makeable:*` caches and `synonym:*` caches
  * **Public Cocktail Edit:** Invalidate `search:*` caches containing that cocktail
  * **User Rating Update:** Invalidate `cocktail:${cocktailId}:rating` cache
  * **New Global Ingredient:** Invalidate `ingredient:search:*` caches
* **Then** the system applies targeted cache invalidation to maintain data consistency.
* **And** uses Redis pub/sub for distributed cache invalidation across multiple backend instances.

**UC 11.7: Targeted Cache Invalidation for Public Cocktails**
* **Given** the Redis cache holds search results for `search:margarita`.
* **When** a user creates a new Public Custom Cocktail named "Spicy Margarita".
* **Then** the backend fires a background event to invalidate cache keys matching `search:*margarita*` (or clears the local search cache namespace).
* **And** subsequent searches immediately reflect the newly added public cocktail.
* **Note:** Private cocktails do not need to trigger global cache invalidation since they bypass the public cache layer.

**UC 11.8: Distributed Rate Limiting via Redis**
* **Given** the application is scaled horizontally across 3 Node.js instances behind a Load Balancer.
* **When** a user spams the `POST /ai/generate` endpoint.
* **Then** the NestJS `ThrottlerModule` utilizes the Redis storage provider (`ThrottlerStorageRedisService`).
* **And** the request count is synchronized across all 3 instances, successfully blocking the user globally once the limit is hit.
* **And** prevents rate limit bypass through horizontal scaling by using shared Redis counters instead of in-memory storage.