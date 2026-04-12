# 🍸 Domain 2: Cocktail Discovery & Aggregator

**UC 2.1: Unified Search (Local + External)**
* **Given** a local cocktail named "Mojito Original" exists in PostgreSQL.
* **And** TheCocktailDB API returns a public recipe for "Mango Mojito".
* **When** the user requests a search for the term "Mojito".
* **Then** the Aggregator Service maps the external JSON to the strict internal `Cocktail` DTO.
* **And** the API returns a unified, paginated list containing both recipes.
* **Architectural Decision: Asymmetric Catalog Browsing (External API Dropping)**
  * **Explicit Trade-off:** Because third-party REST APIs like TheCocktailDB require strict search parameters and do not natively support unbounded, paginated catalog browsing, an architectural asymmetry exists. We explicitly mandate that if a client calls GET /cocktails without providing a name search query, the CocktailAggregatorService MUST silently drop the external API query entirely and return ONLY paginated results from the Local PostgreSQL Database. We trade external catalog browsing comprehensiveness for 3rd-party API compatibility and adherence to external rate limits.

**UC 2.2: Unified Search with External API Failure**
* **Given** the local DB has "Mojito Original".
* **And** TheCocktailDB API times out or throws a 500 error.
* **When** the user searches for the term "Mojito".
* **Then** the Aggregator Service catches the external error without crashing the app.
* **And** gracefully returns only the local "Mojito Original" result.

**UC 2.3: Redis Caching for External APIs**
* **Given** a user searches for "Margarita" for the first time.
* **When** the request is made, the backend fetches from `TheCocktailDB` and caches the result in Redis with a TTL.
* **Then** when a second user searches for "Margarita" 5 minutes later.
* **And** the backend retrieves the data directly from Redis without triggering an external HTTP request.

**UC 2.4: Fetching External Cocktail Details by ID**
* **Given** the Unified Search (UC 2.1) returned a high-level summary of an external cocktail (`ID: 11000`).
* **When** the user clicks on it to view full details.
* **Then** the Aggregator Service calls TheCocktailDB lookup endpoint (`lookup.php?i=11000`).
* **And** maps the verbose external schema into the strict internal `CocktailDetails` DTO.
* **Architectural Decision: Strict Image Blackout on External API Detail Views**
  * **Explicit Trade-off:** To prevent violating RESTful principles (executing file-system writes during a GET request) and to avoid Node.js event loop blocking, the GET /cocktails/:id endpoint for external API cocktails must also enforce the Image Blackout. We explicitly mandate that users viewing the detail page of an external API cocktail will only see a local placeholder SVG until they actively click "Save as Custom Cocktail." We trade detail-page visual aesthetics for RESTful architectural purity and strict adherence to the Local-Images-Only mandate.

**UC 2.5: Browsing by Category or Base Spirit**
* **Given** the user wants to see only "Tequila" based drinks.
* **When** the user applies a filter for "Tequila" to the unified search.
* **Then** the Aggregator Service filters local cocktails via SQL `WHERE`.
* **And** makes a specific API call to TheCocktailDB (`filter.php?i=Tequila`).
* **And** unifies and returns the results.

**UC 2.6: Unified Pagination Handling**
 * **Given** a unified search where the local DB has 2 results and the external API has 50 results.
 * **When** the user requests `limit=10, page=1`.
 * **Then** the Aggregator Service:
    * **Local Database:** Uses page-based pagination with `OFFSET` and `LIMIT` in SQL
    * **External API:** Fetches results and caches them in Redis with 5-minute TTL
    * **Combination:** Combines results from both sources, sorts them, and applies page-based pagination
 * **And** returns a paginated response with `meta` object containing `currentPage`, `nextPage`, `itemsPerPage`, `totalItems`, and `totalPages`.
 * **Architectural Decision:** All endpoints use standardized page-based pagination for consistency and simplicity.

**UC 2.7: Manual Custom Cocktail Creation**
* **Given** a user wants to add their family's secret recipe.
* **When** they submit a `multipart/form-data` payload containing ingredients, instructions, and an optional `image` file.
* **Then** the backend validates all required relational data.
* **And** passes the image to the `ImageService` for Sharp processing (UC 2.13).
* **And** creates a local `Cocktails` record with the generated local `/uploads/` paths.

**UC 2.8: Editing/Updating a Custom Cocktail**
* **Given** a user has previously created a custom cocktail.
* **When** the user submits a `PUT /cocktails/:id` request to modify the recipe or upload a new `image`.
* **Then** the backend verifies `created_by === current_user_id` (Ownership Guard).
* **And** if a new image is provided, processes it and stores the new image files.
* **Architectural Decision: Orphaned Image Bloat on Recipe Edits**
  * **Explicit Trade-off:** To prevent breaking community forks (UC 2.17), the backend will NEVER synchronously execute fs.unlink() to delete old image files when a user uploads a new image during a recipe edit. We explicitly accept the accumulation of orphaned image files on the host disk. We trade optimal disk storage hygiene for the absolute protection of legacy community recipe variants without requiring complex, concurrent image-reference-counting queries.

**UC 2.9: Deleting a Custom Cocktail (Dangling Local Favorites)**
 * **Given** User A created a cocktail, and User B added it to their Favorites.
 * **When** User A issues a `DELETE /cocktails/:id` request.
 * **Then** the cocktail is soft-deleted via `is_deleted` flag (UC 10.4).
 * **And** the Aggregator Service filters out soft-deleted cocktails from User B's Favorites list, showing "Recipe deleted by author" instead of crashing.
 * **Note:** No CASCADE DELETE is used since soft deletion preserves the Favorites relationship while hiding the cocktail.

**UC 2.10: Custom Cocktail Privacy Scoping**
* **Given** a user creates a custom cocktail and sets `is_public: false`.
* **When** another user queries the Unified Search.
* **Then** the Aggregator Service completely excludes that private cocktail from the results.
* **And** it is only visible when the author searches their own data.

**UC 2.11: Cocktail Image Display & Fallback**
* **Given** a cocktail has optional `image_full` and `image_thumb` fields.
* **When** the cocktail data is retrieved from the API.
* **Then** the frontend uses `image_thumb` for lists/cards and `image_full` for detail views.
* **And** if the paths are null, the frontend immediately falls back to the default local `/assets/images/cocktail-placeholder.jpg`.

**UC 2.12: Server-Side Ingestion of External API Images**
* **Given** TheCocktailDB API returns a cocktail with `strDrinkThumb` containing an external image URL.
* **When** the Aggregator Service maps the external data.
* **Then** the backend returns `null` for both `image_full` and `image_thumb` during Unified Search queries (complete image blackout).
* **And** only downloads and processes the image through the local `ImageService` (Sharp) when a user explicitly forks the recipe via the 'Save as Custom Cocktail' action. Favorited or Prepared external cocktails remain subject to the complete image blackout.
* **And** stores/returns the safe local `/uploads/` paths to the frontend after ingestion.
* **Architectural Decision: Complete Image Blackout During External Search**
  * **Explicit Trade-off:** To strictly adhere to the "No Image URLs" mandate without triggering a Node.js event loop DoS (which would occur if we synchronously downloaded and processed 50 images via Sharp during a single search request), we explicitly mandate that all External API search results will return `null` for `image_full` and `image_thumb`. The Angular frontend will render local static `/assets/` placeholders. External images are ONLY downloaded, processed, and saved locally when a user explicitly forks the recipe via the 'Save as Custom Cocktail' action. We trade Search UI aesthetics for absolute adherence to the Local-Only Assets mandate and guaranteed server stability.

**UC 2.13: Image Upload Validation & Processing**
* **Given** a user submits an image file.
* **When** the backend processes the `POST /cocktails` request.
* **Then** the Multer interceptor strictly rejects files > 2MB or non-image MIME types.
* **And** the Sharp processor automatically resizes, converts to WebP, and forces a 1:1 aspect ratio.

**UC 2.14: Local vs. External Duplicate Resolution**
* **Given** a user searches for "Mojito".
* **And** the local database contains an exact name match for "Mojito" (a curated/internal recipe).
* **And** TheCocktailDB also returns "Mojito".
* **When** the `CocktailAggregatorService` unifies the results.
* **Then** the aggregator applies a deduplication strategy (e.g., Local Database takes priority over External API for exact string matches).
* **And** only returns the Local "Mojito" to prevent UX clutter.

**UC 2.15: Searching with Empty or Special Characters**
* **Given** a user types `" %%% "` or a string of blank spaces into the search bar.
* **When** the request reaches the Aggregator Service.
* **Then** the backend validation pipe intercepts it.
* **And** returns an empty array (or 400 Bad Request) without executing heavy SQL LIKE queries or calling external APIs.

**UC 2.16: Handling External API Rate Limits (429 Too Many Requests)**
* **Given** MixologyHub's backend exceeds TheCocktailDB's allowed requests per second.
* **When** a user initiates a search and the external API returns `429 Too Many Requests`.
* **Then** the Aggregator Service catches the 429 error.
* **And** gracefully falls back to returning *only* local database and Redis-cached results.
* **And** temporarily trips a Circuit Breaker to stop pinging the external API for X seconds to prevent an IP ban.
* **Architectural Decision: Localized Circuit Breaking for External APIs**
  * **Explicit Trade-off:** To strictly adhere to the "No Concurrency / No Distributed State" mandate, we explicitly refuse to back our Circuit Breakers with Redis. We accept that in a horizontally scaled environment, circuit breaker states are isolated to individual Node.js processes. If an external API issues a 429 Rate Limit, each backend instance must independently fail and trip its own breaker. We trade immediate, cluster-wide external API protection for the absolute eradication of distributed state coordination.

**UC 2.17: Public Cocktail Integrity**
* **Given** User A creates a public "Mojito" and User B favorites it.
* **When** User A edits the recipe to contain "Bleach".
* **Then** the system detects the recipe is favorited by other users.
* **And** either forks the recipe (creates a new version) OR prevents editing of core ingredients for public cocktails with >0 favorites.
* **Architectural Decision: Author Forking Sprawl vs Community Immutability**
  * **Explicit Trade-off:** We explicitly accept that Authors lose absolute mutation rights over their own creations the moment a single other user favorites them. We mandate that any ingredient edits to a favorited public recipe will forcefully fork it into a new record for the Author, preserving the legacy version in the database for the community. We trade author dashboard simplicity (which will become cluttered with version forks) for strict community recipe immutability.

**UC 2.18: Advanced Filtering**
* **Given** a user searches for "Margarita".
* **When** they apply a filter for `ingredients_exclude=["Tequila"]` (e.g., looking for mocktails/variations).
* **Then** the Aggregator filters out results containing that ingredient.
* **Architectural Decision: External API Advanced Filtering Degradation**
  * **Explicit Trade-off:** Because external 3rd-party APIs do not natively support complex boolean AND/OR/EXCLUDE ingredient filtering, applying these filters to Unified Search creates an impossible query state. We explicitly mandate that whenever an advanced filter is applied, the CocktailAggregatorService will silently drop all external API queries and return only Local Database results. We trade search comprehensiveness for the ability to offer advanced, highly specific filtering to power users.

**UC 2.19: Strict Inclusion Search**
* **Given** a user wants to find cocktails containing BOTH Gin AND Campari.
* **When** they apply a filter for `ingredients_include=["Gin", "Campari"]`.
* **Then** the Aggregator strictly returns only cocktails containing ALL specified ingredients.
* **And** performs case-insensitive matching against ingredient names.
* **And** works across both local and external cocktail sources.

**UC 2.20: Flexible OR Search Filter**
* **Given** a user wants to find cocktails containing EITHER Gin OR Vodka.
* **When** they apply a filter for `ingredients_any=["Gin", "Vodka"]`.
* **Then** the Aggregator returns cocktails containing ANY of the specified ingredients.
* **And** performs case-insensitive matching against ingredient names.
* **And** works across both local and external cocktail sources.
* **And** can be combined with `ingredients_include` for complex queries (e.g., Gin OR Vodka AND Vermouth).

**UC 2.22: Forking External Recipes on Edit**
* **Given** a user views a public cocktail from TheCocktailDB (`source: 'api'`).
* **When** the user clicks "Edit Recipe" to change an ingredient.
* **Then** the backend intercepts the request and creates a *new* local `Cocktails` record.
* **And** sets `source: 'local'`, `parent_external_id: '11000'`, and `created_by: user_id`.
* **Architectural Decision: Lineage Tracking for Forked Cocktails**
  * **Explicit Trade-off:** When users edit external API cocktails, we create local forks rather than modifying the original. The `parent_external_id` field preserves lineage, allowing us to track which external cocktail inspired each local variant. We trade database simplicity (no need for complex versioning systems) for clear attribution and the ability to analyze popular source cocktails.

**UC 2.23: Sorting Unified Search by Makeability**
 * **Given** the user searches for "Martini" and gets 10 results.
 * **When** the frontend requests the results with `sort=makeability`.
 * **Then** the Aggregator Service passes the results through the `MakeableCocktailsService`.
 * **And** pushes the cocktails the user has 100% of the ingredients for to the top of the array.
 * **And** pushes the "Missing 1 ingredient" to the middle, and completely unmakeable to the bottom.
  * **Architectural Decision: Makeability Sorting Exclusion for External APIs**
    * **Explicit Trade-off:** Because external API cocktails require expensive on-the-fly NLP trigram resolution to map string measurements to local UUIDs (UC 3.21), sorting a Unified Search by makeability creates a severe CPU and Database bottleneck. We explicitly dictate that when `sort=makeability` is applied to Unified Search, the CocktailAggregatorService will automatically drop all External API results, returning ONLY Local Database cocktails. We trade search comprehensiveness for guaranteed server stability under heavy Math/NLP loads.
  * **Architectural Decision: O(N) Redundant Computation on Deep Pagination**
    * **Explicit Trade-off:** Because we use offset-based pagination (page/limit) combined with in-memory math filtering for the `sort=makeability` endpoint, requesting Page 5 (offset 40) forces the Node.js event loop to recalculate the exact same unit-conversion math for the first 40 items just to discard them, plus the next 10 items. We explicitly accept this CPU penalty and redundant computation on every subsequent page request, trading perfect algorithmic efficiency for the immediate delivery of dynamic makeability sorting. (This is bounded by the 200-iteration hard cap).

**UC 2.24: Aggregator Search Caching**
* **Given** an external API returns an unpaginated array of 50 cocktails.
* **When** the Aggregator maps this to internal DTOs.
* **Then** the Aggregator caches the external API results in Redis under a search-specific cache key.
* **And** subsequent page requests pull external results directly from the cached Redis array using `slice(offset, offset + limit)` rather than hitting the external API again.
* **And** implements TTL expiration (5 minutes) to prevent stale search results.
* **Architectural Decision:** Both local and external results are combined and cached as a unified array for each search query, with page-based pagination applied to the cached results.

**UC 2.25: Fuzzy Search / Typo Tolerance**
* **Given** a user searches for "Margaritta" (typo).
* **When** the query is processed by the Aggregator.
* **Then** the local PostgreSQL `pg_trgm` (trigram) extension or Levenshtein distance matching identifies "Margarita".
* **And** successfully returns the corrected results without requiring an exact string match.

*Note: UC 2.26-2.32 (ABV Range, Glass Type, Category, Preparation Time, Difficulty, Dietary Restrictions, Seasonal Availability) are Phase 2 features that require additional data sources beyond TheCocktailDB. These will be implemented when we expand our data partnerships.*

**UC 2.26: Filtering by Ingredient Synonyms**
* **Given** a user searches for cocktails with "Triple Sec".
* **When** the user has "Curaçao" in their inventory (a synonym).
* **Then** the makeability engine recognizes the synonym relationship.
* **And** returns cocktails requiring "Triple Sec" as makeable.

**UC 2.27: Personalization Injection in Search Results**
* **Given** a user has favorited a cocktail and rated it 4.5 stars.
* **When** the user searches and that cocktail appears in results.
* **Then** the backend cross-references the user's session.
* **And** dynamically injects `is_favorited: true` and `user_rating: 4.5` into the response DTO so the frontend can render filled hearts/stars.

**UC 2.28: Direct Access Guard for Private Cocktails**
* **Given** User A creates a cocktail with `is_public: false`.
* **When** User B obtains the UUID and attempts to directly call `GET /cocktails/<uuid>`.
* **Then** the backend verifies ownership.
* **And** returns a `403 Forbidden` or `404 Not Found` to prevent URL sharing of private recipes.

**UC 2.29: Flattening numbered API keys into arrays**
* **Given** TheCocktailDB returns a flat object with `strIngredient1: "Rum"`, `strMeasure1: "2 oz"`, `strIngredient2: null`, `strIngredient3: ""`
* **When** the Aggregator Service maps the data to the internal DTO.
* **Then** it dynamically loops through keys 1-15.
* **And** stops processing when it encounters a `null` or empty string.
* **And** successfully outputs a clean `ingredients: []` array containing only valid entries.

**UC 2.30: SIMPLIFIED - Basic Cocktail Rating**
 * **Given** a user views a cocktail they've prepared or favorited.
 * **When** they submit a 1-5 star rating via `POST /cocktails/:id/rate`.
 * **Then** the system checks if the cocktail exists locally:
    * **If local cocktail:** Inserts or updates their row in the `COCKTAIL_RATINGS` pivot table and recalculates the average rating.
    * **If external cocktail:** Creates a record in the `EXTERNAL_COCKTAIL_RATINGS` table.
  * **Architectural Decision: Acceptance of Concurrent Rating Overwrites**
    * **Explicit Trade-off:** We explicitly reject optimistic concurrency control and atomic updates for user ratings. We accept that concurrent user ratings might temporarily overwrite each other, causing minor rating average drift. We trade absolute rating consistency for simplified rating system implementation and elimination of database locking overhead.
  * **Architectural Decision: Rating Freeze on Tombstoned Content**
    * **Explicit Trade-off:** To protect the historical integrity of deleted data, we explicitly mandate that any cocktail flagged as is_deleted = true is permanently frozen from receiving new user ratings or rating updates. Attempting to submit a POST /cocktails/:id/rate against a soft-deleted cocktail will result in a 403 Forbidden: Cannot rate deleted content. We trade user engagement flexibility on legacy favorites for strict database immutability on deleted records.

**UC 2.35: On-The-Fly Rating Aggregation for External Cocktails**
* **Given** the Unified Search has fetched 50 external API cocktails from TheCocktailDB.
* **When** the `CocktailAggregatorService` maps them to internal DTOs.
* **Then** the service extracts the array of string IDs (e.g., `['11000', '11001']`).
* **And** executes a single bulk SQL query against the `EXTERNAL_COCKTAIL_RATINGS` table: `SELECT external_id, AVG(score), COUNT(id) WHERE external_id IN (...) GROUP BY external_id`.
* **And** maps the resulting averages to the external DTOs before caching the unified array.
* **Architectural Decision: Synchronous On-The-Fly External Rating Aggregation**
  * **Explicit Trade-off:** Because external API cocktails have no permanent row in the local `COCKTAILS` database, they cannot utilize a pre-calculated, cached `rating` column. We explicitly accept that the `CocktailAggregatorService` must execute a synchronous bulk SQL `AVG()` query on every external search cache-miss. We trade micro-second search latency for the ability to rate and display community scores on third-party content without eagerly forking thousands of external recipes into our local database.

**UC 2.31: SIMPLIFIED - Basic Rating Update**
* **Given** a user has previously rated a cocktail 4 stars.
* **When** they change their rating to 5 stars via `POST /cocktails/:id/rate`.
* **Then** the system updates their row in the `COCKTAIL_RATINGS` table.
* **And** recalculates the average rating.
* **Architectural Decision: Acceptance of Concurrent Rating Overwrites**
  * **Explicit Trade-off:** We explicitly reject optimistic concurrency control and atomic updates for user ratings. We accept that concurrent user ratings might temporarily overwrite each other, causing minor rating average drift. We trade absolute rating consistency for simplified rating system implementation and elimination of database locking overhead.

**UC 2.33: Handling External API Image Ingestion Failures**
* **Given** the backend attempts to ingest a TheCocktailDB image (UC 2.12) but the external URL returns a 404/403.
* **When** the Axios download request fails.
* **Then** the Aggregator catches the error gracefully.
* **And** assigns `null` to `image_full` and `image_thumb`, allowing the frontend to seamlessly render the default local placeholder.

**UC 2.34: Bounding Custom Cocktail Recipe Amounts**
* **Given** a malicious user creates a custom cocktail.
* **When** they pass an ingredient with `amount: 999999999.99`, `unit: 'ml'`.
* **Then** the global validation pipe rejects the payload with `400 Bad Request`.
* **And** enforces maximum bounds for ingredient amounts (e.g., `max: 100000` for volume in ml, `max: 1000` for count-based ingredients).
* **And** prevents PostgreSQL `decimal(10,4)` overflow errors upon saving the recipe.
* **And** provides clear error message: "Ingredient amount cannot exceed 100,000 ml (100 liters)".

**UC 2.36: External API Payload Size Limit (JSON Bomb)**
* **Given** the CocktailAggregatorService queries TheCocktailDB (or any future 3rd party API).
* **When** the external API gets compromised and returns a 50MB JSON payload (Billion Laughs / JSON Bomb attack).
* **Then** the Axios/HTTP client strictly bounds the `maxContentLength` to 5MB.
* **And** aborts the connection before `JSON.parse()` crashes the Node.js V8 event loop.
* **And** returns a graceful fallback error: "External API response too large" while continuing to serve local database results.
* **And** logs the oversized response attempt for security monitoring.