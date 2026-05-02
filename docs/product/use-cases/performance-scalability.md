# 🔄 Domain 11: Performance & Scalability

> **B2B CONTEXT:** The bar's shared inventory changes the performance profile. Makeability caches are now global (not per-user). Redis is critical infrastructure for BullMQ queues.

**UC 11.1: Database Query Optimization**
* **Given** the bar has 100+ ingredients in `bar_inventory`.
* **When** a bartender requests the "Makeable Cocktails" list.
* **Then** the SQL query uses proper indexing on `bar_inventory(ingredient_id)`.
* **And** completes in under 100ms even with complex joins and unit conversions.

**UC 11.2: Redis Cache Invalidation**
* **Given** an admin updates `bar_inventory`.
* **When** the inventory change is committed.
* **Then** the system invalidates any cached "Makeable Cocktails" results globally.
* **And** ensures the next request fetches fresh data reflecting the updated inventory.
* **Architectural Decision: Volatile Caching for Dynamic Makeability Results**
  * **Explicit Trade-off:** Makeable cocktail lists are highly dynamic (changing with inventory) and use offset-based pagination (ADR 0008), creating potential for Redis memory explosion if caching all pages. We explicitly implement short-TTL caching (30 seconds) only for the first page of makeable results (`makeable:bar:page:1`). Subsequent pages are not cached to prevent memory bloat. We trade comprehensive caching coverage for memory efficiency and accept that page 2+ requests will always hit the database.

**UC 11.3: External API Fallback Strategy**
* **Given** TheCocktailDB API is experiencing an outage.
* **When** a bartender searches for cocktails.
* **Then** the system gracefully falls back to local database results only.
* **And** logs the API failure for monitoring without impacting user experience.

**UC 11.4: Redis Graceful Degradation**
* **Given** the Redis cache becomes unreachable.
* **When** the Cocktail Aggregator Service attempts to cache or retrieve data.
* **Then** the system logs the Redis connection error.
* **And** gracefully bypasses the cache, calling the external APIs and database directly.
* **And** returns results to the user without throwing a `500 Internal Server Error`.
* **Note:** If Redis is down, the BullMQ `bar-orders` queue is also unavailable, meaning cocktail preparation is blocked. The cache layer degrades gracefully, but the queue system does not.

**UC 11.5: Redis Memory Limit & Eviction (Pure Volatile Cache)**
* **Given** the Redis cache reaches its maximum memory limit.
* **When** the Aggregator attempts to cache a new search result.
* **Then** Redis uses the `allkeys-lru` (Least Recently Used) eviction policy.
* **And** silently evicts the oldest cached searches to make room without throwing an Out Of Memory (OOM) error to the NestJS application.
* **Note:** The BullMQ queue data is stored in a separate Redis logical database or instance to prevent cache eviction from affecting the job queue.

**UC 11.6: Cache Invalidation Strategy Matrix**
* **Given** various data modification events occur in the system.
* **When** specific events trigger cache invalidation:
  * **Bar Inventory Change:** Invalidate `makeable:bar` cache
  * **Admin Ingredient Synonym Update:** Flush all `makeable:*` caches and `synonym:*` caches
  * **Public Cocktail Edit:** Invalidate `search:*` caches containing that cocktail
  * **User Rating Update:** Invalidate `cocktail:${cocktailId}:rating` cache
  * **New Global Ingredient:** Invalidate `ingredient:search:*` caches
* **Then** the system applies targeted cache invalidation to maintain data consistency.

**UC 11.7: Synchronous Cache Invalidation for Public Cocktails**
* **Given** the Redis cache holds search results for `search:margarita`.
* **When** a user creates a new Public Custom Cocktail named "Spicy Margarita".
* **Then** the backend synchronously executes wildcard cache purges before returning the HTTP response.
* **And** subsequent searches immediately reflect the newly added public cocktail.
* **Note:** BullMQ is now available for offloading heavy cache invalidation to background workers in future iterations.

**UC 11.8: Local-Only Rate Limiting (Acceptance of Multiplier Bypass)**
* **Given** the application is scaled vertically across multiple Node.js worker processes (via the cluster module) on a Single VM.
* **When** a user spams the `POST /ai/generate` endpoint.
* **Then** the NestJS `ThrottlerModule` utilizes local in-memory storage.
* **And** the request count is NOT synchronized across worker processes, allowing the user to potentially bypass limits depending on round-robin routing.
* **Architectural Decision: Local-Only Rate Limiting (Acceptance of Multiplier Bypass)**
  * **Explicit Trade-off:** We explicitly remove Redis-backed distributed rate limiting. We explicitly accept that vertically scaling the backend across multiple CPU cores will effectively multiply a user's allowed rate limit by the number of active worker processes (e.g., a limit of 5 req/min on 4 cores becomes up to 20 req/min). We trade absolute rate-limit accuracy for the complete architectural elimination of concurrent state coordination.

**UC 11.9: Cache Stampede (Thundering Herd) Vulnerability**
* **Given** the Unified Search Redis cache expires for a popular search term (e.g., "Margarita").
* **When** multiple users simultaneously search for "Margarita" at the exact moment of cache expiration.
* **Then** all concurrent requests experience a cache miss.
* **And** simultaneously trigger redundant database queries and external API calls.
* **And** potentially cause external API rate limit violations.
* **Architectural Decision: Acceptance of Cache Stampede (Thundering Herd) Risk**
  * **Explicit Trade-off:** There is no mutex mechanism to orchestrate cache misses. We explicitly accept that when the Unified Search Redis cache expires, concurrent user requests will trigger a "Cache Stampede"—resulting in redundant, simultaneous outbound HTTP requests to external APIs and redundant database queries before the cache is repopulated. We trade optimal cache-write efficiency and strict external API rate-limit adherence for architectural simplicity.
