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
* **Architectural Decision: Volatile Caching for Dynamic Makeability Results**
  * **Explicit Trade-off:** Makeable cocktail lists are highly dynamic (changing with inventory) and use offset-based pagination (ADR 0008), creating potential for Redis memory explosion if caching all pages. We explicitly implement short-TTL caching (30 seconds) only for the first page of makeable results (`makeable:user:{userId}:page:1`). Subsequent pages are not cached to prevent memory bloat. We trade comprehensive caching coverage for memory efficiency and accept that page 2+ requests will always hit the database. The 30-second TTL balances performance gains against inventory staleness.

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

**UC 11.5: Redis Memory Limit & Eviction (Pure Volatile Cache)**
* **Given** the Redis cache reaches its maximum memory limit.
* **When** the Aggregator attempts to cache a new search result.
* **Then** Redis uses the `allkeys-lru` (Least Recently Used) eviction policy.
* **And** silently evicts the oldest cached searches to make room without throwing an Out Of Memory (OOM) error to the NestJS application.
* **And** monitors cache hit/miss ratios to optimize memory allocation for frequently accessed data.
  * **Architectural Decision: Pure Volatile Caching (Removal of Persistent Redis State)**
  * **Explicit Trade-off:** Because we have migrated AI Quotas to PostgreSQL and Rate Limiting to local memory (ADR 0005), Redis is no longer responsible for any persistent or financial-gatekeeping state. Therefore, the entire Redis instance will be configured purely as a Volatile Cache using the `allkeys-lru` eviction policy. We explicitly accept that if search traffic spikes and Redis memory fills to 100%, older cached searches will be silently destroyed. We trade long-term cache retention for absolute immunity against Redis Out-Of-Memory (OOM) crashes without the need to maintain separate logical databases.
  * **Architectural Decision: Unpredictable Cache Jitter via LRU Eviction**
  * **Explicit Trade-off:** Because we configure Redis exclusively as a volatile allkeys-lru cache without persistence, we explicitly accept that under high server load, Redis may silently evict search pagination arrays mere seconds after their creation (bypassing the 5-minute TTL). This will cause extreme and unpredictable pagination jitter for users. We trade pagination stability for absolute immunity against Redis Out-Of-Memory (OOM) crashes.

**UC 11.6: Cache Invalidation Strategy Matrix**
* **Given** various data modification events occur in the system.
* **When** specific events trigger cache invalidation:
  * **User Inventory Change:** Invalidate `makeable:${userId}` cache
  * **Admin Ingredient Synonym Update:** Flush all `makeable:*` caches and `synonym:*` caches
  * **Public Cocktail Edit:** Invalidate `search:*` caches containing that cocktail
  * **User Rating Update:** Invalidate `cocktail:${cocktailId}:rating` cache
  * **New Global Ingredient:** Invalidate `ingredient:search:*` caches
* **Then** the system applies targeted cache invalidation to maintain data consistency.
* **Architectural Decision: Instantaneous Cache Invalidation via Shared Redis**
  * **Explicit Trade-off:** Because we have strictly banned distributed Pub/Sub eventing, we do not utilize local L1 memory caches for search data. All pagination and search caches live exclusively in the shared Redis instance. When an Admin updates a global ingredient, the backend synchronously executes a Redis `DEL` command, instantly wiping the cache for all vertically scaled worker processes simultaneously. We explicitly trade the micro-latency benefits of local L1 memory caching for instantaneous, system-wide cache coherence without the need for distributed Pub/Sub orchestration.

**UC 11.7: Synchronous Cache Invalidation for Public Cocktails**
* **Given** the Redis cache holds search results for `search:margarita`.
* **When** a user creates a new Public Custom Cocktail named "Spicy Margarita".
* **Then** the backend synchronously executes wildcard cache purges (fetching keys via SCAN and executing DEL) before returning the HTTP response.
* **And** subsequent searches immediately reflect the newly added public cocktail.
* **Note:** Private cocktails do not need to trigger global cache invalidation since they bypass the public cache layer.
* **Architectural Decision: Synchronous Cache Invalidation Blocking**
  * **Explicit Trade-off:** Because we have eradicated distributed background workers and event emitters, cache invalidation must happen within the active request lifecycle. When a user creates or edits a Public Cocktail, the backend will synchronously execute wildcard cache purges (e.g., fetching keys via SCAN and executing DEL) before returning the HTTP response. We explicitly accept that this will momentarily block the Node.js event loop and increase the user's API latency. We trade high-speed write responses for the total elimination of background eventing.

**UC 11.8: Local-Only Rate Limiting (Acceptance of Multiplier Bypass)**
* **Given** the application is scaled vertically across multiple Node.js worker processes (via the cluster module) on a Single VM.
* **When** a user spams the `POST /ai/generate` endpoint.
* **Then** the NestJS `ThrottlerModule` utilizes local in-memory storage.
* **And** the request count is NOT synchronized across worker processes, allowing the user to potentially bypass limits depending on round-robin routing.
* **Architectural Decision: Local-Only Rate Limiting (Acceptance of Multiplier Bypass)**
  * **Explicit Trade-off:** To strictly enforce the "No Concurrency / No Distributed State" mandate, we explicitly remove Redis-backed distributed rate limiting. We explicitly accept that vertically scaling the backend across multiple CPU cores will effectively multiply a user's allowed rate limit by the number of active worker processes (e.g., a limit of 5 req/min on 4 cores becomes up to 20 req/min). We trade absolute rate-limit accuracy for the complete architectural elimination of concurrent state coordination.

**UC 11.9: Cache Stampede (Thundering Herd) Vulnerability**
* **Given** the Unified Search Redis cache expires for a popular search term (e.g., "Margarita").
* **When** multiple users simultaneously search for "Margarita" at the exact moment of cache expiration.
* **Then** all concurrent requests experience a cache miss.
* **And** simultaneously trigger redundant database queries and external API calls.
* **And** potentially cause external API rate limit violations.
* **Architectural Decision: Acceptance of Cache Stampede (Thundering Herd) Risk**
  * **Explicit Trade-off:** Because we enforce the "No Concurrency" mandate and explicitly forbid Redis distributed locks, there is no mutex mechanism to orchestrate cache misses. We explicitly accept that when the Unified Search Redis cache expires, concurrent user requests will trigger a "Cache Stampede"—resulting in redundant, simultaneous outbound HTTP requests to external APIs and redundant database queries before the cache is repopulated. We trade optimal cache-write efficiency and strict external API rate-limit adherence for the absolute elimination of distributed locking complexity.