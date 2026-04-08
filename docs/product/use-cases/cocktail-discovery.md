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
* **When** the user requests `page=1&limit=10`.
* **Then** the Aggregator Service correctly combines 2 local and 8 external results.
* **And** preserves the cursor/offset so `page=2` correctly fetches external items 9-18.

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
* **Then** the cocktail is deleted (or soft-deleted via `is_deleted` flag).
* **And** the database utilizes a `CASCADE DELETE` (or the Aggregator handles it gracefully) so User B's Favorite list doesn't crash.

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

**UC 2.21: Forking External Recipes on Edit**
* **Given** a user views a public cocktail from TheCocktailDB (`source: 'api'`).
* **When** the user clicks "Edit Recipe" to change an ingredient.
* **Then** the backend intercepts the request and creates a *new* local `Cocktails` record.
* **And** sets `source: 'local'`, `parent_external_id: '11000'`, and `created_by: user_id`.

**UC 2.22: Sorting Unified Search by Makeability**
* **Given** the user searches for "Martini" and gets 10 results.
* **When** the frontend requests the results with `sort=makeable`.
* **Then** the Aggregator Service passes the results through the `MakeableCocktailsService`.
* **And** pushes the cocktails the user has 100% of the ingredients for to the top of the array.
* **And** pushes the "Missing 1 ingredient" to the middle, and completely unmakeable to the bottom.

**UC 2.23: Aggregator Pagination State via Redis**
* **Given** an external API returns an unpaginated array of 50 cocktails.
* **When** the Aggregator maps this to internal DTOs.
* **Then** the Aggregator caches the *entire unified array* in Redis under the `search_cursor_key`.
* **And** subsequent cursor requests pull directly from the cached Redis array using `slice(offset, offset + limit)` rather than hitting the database or external API again.
* **And** implements TTL expiration (e.g., 5 minutes) to prevent stale search results.

**UC 2.24: Fuzzy Search / Typo Tolerance**
* **Given** a user searches for "Margaritta" (typo).
* **When** the external API returns 0 results.
* **Then** the PostgreSQL local search utilizes `pg_trgm` (Trigram similarity) or `ILIKE` fallback matching.
* **And** successfully returns "Margarita" from the local database.
* **And** provides "Did you mean: Margarita?" suggestion in the UI when exact matches fail.

**UC 2.25: On-the-fly External Ingredient Resolution**
* **Given** the Aggregator fetches an external recipe containing the string `"Light rum"`.
* **When** evaluating if the cocktail is makeable (UC 2.22).
* **Then** the Aggregator passes the string through the `IngredientService.resolveBaseIngredient()` method.
* **And** maps the string to the closest known local ingredient `UUID` (e.g., using case-insensitive or synonym matching).
* **And** correctly assesses makeability against the user's inventory without requiring the external ingredient to be permanently saved in the local DB first.
* **And** caches the string-to-UUID mapping in Redis to avoid repeated database lookups for subsequent searches.