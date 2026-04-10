# 🍸 Domain 2: Cocktail Discovery & Aggregator

**UC 2.1: Unified Search (Local + External)**
* **Given** a local cocktail named "Mojito Original" exists in PostgreSQL.
* **And** TheCocktailDB API returns a public recipe for "Mango Mojito".
* **When** the user requests a search for the term "Mojito".
* **Then** the Aggregator Service maps the external JSON to the strict internal `Cocktail` DTO.
* **And** the API returns a unified, paginated list containing both recipes.

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

**UC 2.5: Browsing by Category or Base Spirit**
* **Given** the user wants to see only "Tequila" based drinks.
* **When** the user applies a filter for "Tequila" to the unified search.
* **Then** the Aggregator Service filters local cocktails via SQL `WHERE`.
* **And** makes a specific API call to TheCocktailDB (`filter.php?i=Tequila`).
* **And** unifies and returns the results.

**UC 2.6: Unified Pagination Handling**
 * **Given** a unified search where the local DB has 2 results and the external API has 50 results.
 * **When** the user requests `limit=10`.
 * **Then** the Aggregator Service:
    * **Local Database:** Uses cursor-based pagination with `WHERE (created_at < :cursorTimestamp OR (created_at = :cursorTimestamp AND id < :cursorId))`
    * **External API:** Uses offset-based pagination by caching full results in Redis and slicing based on array index position (not cursor ID)
    * **Combination:** Correctly combines 2 local and 8 external results using array indexing over the Redis cache
 * **And** returns a `nextCursor` that is a Base64 encoded JSON object containing both the local database timestamp/UUID and the external API array index (e.g., `eyJ0IjoiMjAyNi...`).
 * **And** caches pagination state in Redis to maintain consistency across requests.
 * **Architectural Decision:** For unified search with mixed ID types (UUID vs integer strings), use composite cursors encoded as Base64 JSON to track both local cursor state and external API offset simultaneously.

**UC 2.7: Manual Custom Cocktail Creation**
* **Given** a user wants to add their family's secret Margarita recipe.
* **When** they submit the `POST /cocktails` payload containing ingredients, instructions, measures, and optional `image_url`.
* **Then** the backend validates all required relational data (ingredients exist or creates custom ones).
* **And** validates the `image_url` format if provided (UC 2.13).
* **And** creates a local `Cocktails` record flagged with `created_by = user_id`.
* **And** makes it immediately searchable in the unified search (UC 2.1).

**UC 2.8: Editing/Updating a Custom Cocktail**
* **Given** a user has previously created a custom "Secret Margarita".
* **When** the user submits a `PUT /cocktails/:id` request to modify the ingredients, instructions, or `image_url`.
* **Then** the backend verifies `created_by === current_user_id` (Ownership Guard).
* **And** validates the `image_url` format if provided (UC 2.13).
* **And** successfully updates the relational mappings and cocktail details.

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

**UC 2.11: Cocktail Image URL Storage & Fallback**
* **Given** a cocktail has an optional `image_url` field in the database.
* **When** the cocktail data is retrieved from any source (local DB or external API).
* **Then** the system includes the `image_url` in the response payload.
* **And** if the `image_url` is null or empty, a default fallback image path is provided.
* **And** the frontend handles failed image loads by falling back to the default image.

**UC 2.12: External API Image Mapping**
* **Given** TheCocktailDB API returns a cocktail with `strDrinkThumb` field containing an image URL.
* **When** the Aggregator Service maps external data to internal `Cocktail` DTO.
* **Then** it maps `strDrinkThumb` to the `image_url` field.
* **And** validates the URL format before storing or returning it.

**UC 2.13: Image URL Validation on Cocktail Creation/Update**
* **Given** a user submits a custom cocktail with an `image_url` field.
* **When** the backend processes the `POST /cocktails` or `PUT /cocktails/:id` request.
* **Then** the validation layer checks if the `image_url` is a valid URL format.
* **And** rejects the request with `400 Bad Request` if the URL format is invalid.
* **And** allows `null` or empty string for no image.

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

**UC 2.17: Public Cocktail Integrity**
* **Given** User A creates a public "Mojito" and User B favorites it.
* **When** User A edits the recipe to contain "Bleach".
* **Then** the system detects the recipe is favorited by other users.
* **And** either forks the recipe (creates a new version) OR prevents editing of core ingredients for public cocktails with >0 favorites.

**UC 2.18: Advanced Filtering**
* **Given** a user searches for "Margarita".
* **When** they apply a filter for `ingredients_exclude=["Tequila"]` (e.g., looking for mocktails/variations).
* **Then** the Aggregator filters out results containing that ingredient.

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
* **Senior Architectural Decision: Lineage Tracking for Forked Cocktails**
  * **Explicit Trade-off:** When users edit external API cocktails, we create local forks rather than modifying the original. The `parent_external_id` field preserves lineage, allowing us to track which external cocktail inspired each local variant. We trade database simplicity (no need for complex versioning systems) for clear attribution and the ability to analyze popular source cocktails.

**UC 2.23: Sorting Unified Search by Makeability**
 * **Given** the user searches for "Martini" and gets 10 results.
 * **When** the frontend requests the results with `sort=makeability`.
 * **Then** the Aggregator Service passes the results through the `MakeableCocktailsService`.
 * **And** pushes the cocktails the user has 100% of the ingredients for to the top of the array.
 * **And** pushes the "Missing 1 ingredient" to the middle, and completely unmakeable to the bottom.
 * **Senior Architectural Decision: Makeability Sorting Exclusion for External APIs**
   * **Explicit Trade-off:** Because external API cocktails require expensive on-the-fly NLP trigram resolution to map string measurements to local UUIDs (UC 3.21), sorting a Unified Search by makeability creates a severe CPU and Database bottleneck. We explicitly dictate that when `sort=makeability` is applied to Unified Search, the CocktailAggregatorService will automatically drop all External API results, returning ONLY Local Database cocktails. We trade search comprehensiveness for guaranteed server stability under heavy Math/NLP loads.

**UC 2.24: Aggregator Pagination State via Redis**
* **Given** an external API returns an unpaginated array of 50 cocktails.
* **When** the Aggregator maps this to internal DTOs.
* **Then** the Aggregator caches the external API results in Redis under the `search_cursor_key`.
* **And** subsequent cursor requests pull external results directly from the cached Redis array using `slice(offset, offset + limit)` rather than hitting the external API again.
* **And** implements TTL expiration (e.g., 5 minutes) to prevent stale search results.
* **Senior Architectural Decision: Asymmetric Aggregator Caching**
  * **Explicit Trade-off:** The backend cannot cache an "entire unified array" because the local PostgreSQL database utilizes strict cursor pagination (fetching only 10 rows at a time). We explicitly mandate an Asymmetric Caching Strategy: The Redis cache will ONLY store the raw, unpaginated JSON payloads returned by the External API (TheCocktailDB), which are safely bounded (usually <100 items). Local database results are NEVER cached in this search array and rely entirely on live PostgreSQL cursor performance. We trade slightly higher database read volume for the prevention of massive Redis memory leaks.

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

**UC 2.30: Rating a Cocktail with Optimistic Concurrency**
 * **Given** a user views a cocktail they've prepared or favorited.
 * **When** they submit a 1-5 star rating via `POST /cocktails/:id/rate`.
 * **Then** the system checks if the cocktail exists locally:
   * **If local cocktail:** Inserts or updates their row in the `COCKTAIL_RATINGS` pivot table and recalculates the cached `rating` average and `rating_count` on the `COCKTAILS` table.
   * **If external cocktail:** Creates a "Shadow Record" in the `EXTERNAL_COCKTAIL_RATINGS` table with `external_id` and `user_id`, without forking the cocktail into the local `COCKTAILS` table.
  * **And** uses **optimistic concurrency control** for local cocktails:
    * **Atomic Update**: Single SQL statement calculates new average: `UPDATE cocktails SET rating = COALESCE(((rating * rating_count) + :newRating) / NULLIF(rating_count + 1, 0), :newRating), rating_count = rating_count + 1 WHERE id = :cocktailId`
    * **NULL Handling**: Uses `COALESCE` and `NULLIF` to handle first rating (when `rating` is NULL and `rating_count` is 0)
    * **Conflict Handling**: If concurrent update detected (row count = 0), retry with exponential backoff
    * **No Row Locking**: Avoids `SELECT FOR UPDATE` to prevent contention
 * **And** returns the updated average rating and rating count in the response for local cocktails, or the user's personal rating for external cocktails.
 * **Senior Architectural Decision: Shadow Rating Aggregation for External APIs**
   * **Explicit Trade-off:** We cannot fork external cocktails per-user strictly for ratings without fragmenting the community score. We explicitly dictate that when a user rates an external cocktail, the system DOES NOT fork the cocktail into the `COCKTAILS` table. Instead, it creates a "Shadow Record" in a new `EXTERNAL_COCKTAIL_RATINGS` table. We trade unified table architecture for the ability to accurately aggregate and display community scores for public API drinks without polluting our local database with thousands of identical clones.
 * **Senior Architectural Decision: Personal-Only Ratings for External Cocktails**
   * **Explicit Trade-off:** Because we refuse to pollute our local database by forking external cocktails merely for rating purposes (UC 2.30), there is no table available to cache O(1) running averages for public API drinks. We explicitly dictate that the system will not attempt to dynamically aggregate and display community averages for External API cocktails during Unified Search. External cocktails will only display the current user's personal shadow rating (if one exists). We trade community-driven discovery of external drinks for strict database performance and catalog purity.

**UC 2.31: Updating a Rating with Atomic Recalculation**
* **Given** a user has previously rated a cocktail 4 stars.
* **When** they change their rating to 5 stars via `POST /cocktails/:id/rate`.
* **Then** the system performs an UPSERT on the `COCKTAIL_RATINGS` table.
  * **And** atomically recalculates the average: `UPDATE cocktails SET rating = GREATEST(0.00, LEAST(5.00, ((rating * rating_count) - :oldRating + :newRating) / NULLIF(rating_count, 0))) WHERE id = :cocktailId`
* **And** uses optimistic concurrency with retry logic for concurrent updates.
* **Note**: Rating count stays the same (user updating, not adding new rating).

**UC 2.32: Handling External API Image Link Rot**
* **Given** the user views an external cocktail from TheCocktailDB where the `strDrinkThumb` URL has expired or returns a 403/404.
* **When** the browser attempts to render the image.
* **Then** the Angular `onError` directive catches the broken image.
* **And** immediately swaps it for the local `cocktail-placeholder.jpg`.
* **And** prevents the UI layout from collapsing.
* **And** logs the broken image URL to analytics for monitoring external API image reliability.

**UC 2.33: Bounding Custom Cocktail Recipe Amounts**
* **Given** a malicious user creates a custom cocktail.
* **When** they pass an ingredient with `amount: 999999999.99`, `unit: 'ml'`.
* **Then** the global validation pipe rejects the payload with `400 Bad Request`.
* **And** enforces maximum bounds for ingredient amounts (e.g., `max: 100000` for volume in ml, `max: 1000` for count-based ingredients).
* **And** prevents PostgreSQL `decimal(10,2)` overflow errors upon saving the recipe.
* **And** provides clear error message: "Ingredient amount cannot exceed 100,000 ml (100 liters)".

**UC 2.34: External API Payload Size Limit (JSON Bomb)**
* **Given** the CocktailAggregatorService queries TheCocktailDB (or any future 3rd party API).
* **When** the external API gets compromised and returns a 50MB JSON payload (Billion Laughs / JSON Bomb attack).
* **Then** the Axios/HTTP client strictly bounds the `maxContentLength` to 5MB.
* **And** aborts the connection before `JSON.parse()` crashes the Node.js V8 event loop.
* **And** returns a graceful fallback error: "External API response too large" while continuing to serve local database results.
* **And** logs the oversized response attempt for security monitoring.