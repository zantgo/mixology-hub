# ❤️ Domain 6: Favorites Management

**UC 6.1: Favoriting Polymorphic Data**
* **Given** the user discovers a local cocktail (`UUID`) and an external cocktail (`String ID 11000`).
* **When** the user saves both to favorites.
* **Then** the `Favorites` table stores the local cocktail in the `cocktail_id` column.
* **And** stores the external cocktail in the `external_cocktail_id` column.

**UC 6.2: Idempotent Favoriting (Preventing Duplicates)**
* **Given** the user has already favorited "Mojito" (Cocktail ID `123`).
* **When** the user submits another request to favorite Cocktail ID `123`.
* **Then** the API detects the existing relation.
* **And** safely returns a `200 OK` (or `201`) without attempting to insert a duplicate row.
* **And** the `Favorites` table remains clean.

**UC 6.3: Removing a saved favorite**
* **Given** the user has favorited "Mojito".
* **When** the user calls the `DELETE /favorites/:id` endpoint.
* **Then** the specific mapping row is permanently removed from the `Favorites` table.
* **And** the original "Mojito" recipe in the `Cocktails` table remains completely untouched (no cascading delete of the cocktail itself).

**UC 6.4: Fetching the Favorites List (Hydration)**
* **Given** the user has 1 local favorite and 1 external API favorite.
* **When** they request `GET /favorites`.
* **Then** the DB returns the local cocktail details via SQL `JOIN`.
* **And** concurrently calls TheCocktailDB (or checks Redis Cache) to fetch the details of the external favorite.
* **And** returns a unified, hydrated list of `CocktailDetails` objects.

**UC 6.5: Handling Dangling External Favorites**
* **Given** a user favorited an external cocktail (ID: 99999).
* **And** TheCocktailDB later deletes or removes ID 99999.
* **When** the user fetches their Favorites list.
* **Then** the Aggregator catches the `404 Not Found` from the external API.
* **And** safely flags that favorite as "Recipe Unavailable" in the UI rather than failing the entire Favorites list hydration.

**UC 6.6: Handling Deleted Custom Cocktails in Favorites**
* **Given** a user has favorited a custom cocktail created by another user.
* **When** the original author deletes their custom cocktail (soft delete).
* **Then** the Favorites hydration detects the `is_deleted` flag.
* **And** displays a tombstone entry with "Recipe deleted by author" message.
* **And** allows the user to remove the deleted cocktail from their favorites.

**UC 6.7: Paginated & Batched Favorites Hydration**
* **Given** a user has 50+ favorites (mix of local and external).
* **When** they request their favorites list.
* **Then** the API returns paginated results (e.g., 20 per page).
* **And** batches external API calls to avoid overwhelming TheCocktailDB.
* **And** implements rate limiting between batch calls to respect external API limits.

**UC 6.8: Searching/Filtering Favorites**
* **Given** a user has a large collection of favorited cocktails.
* **When** they search for "rum" within their favorites.
* **Then** the system filters favorites by name and ingredient matches.
* **And** performs case-insensitive partial matching.
* **And** combines search with pagination for performance.

**UC 6.9: Handling Privacy Toggles on Favorited Cocktails**
* **Given** User A creates a Public cocktail and User B favorites it.
* **When** User A edits the cocktail and toggles `is_public: false`.
* **Then** the cocktail remains in User B's database relation.
* **And** User B's UI displays a tombstone: "This recipe was made private by the author" (similar to soft-delete behavior).
* **And** prevents unauthorized access to private recipe details while maintaining the favorite relationship.

**UC 6.10: Default Ordering of Favorites**
* **Given** a user has a mix of recently added and older favorites.
* **When** they request `GET /favorites` without sorting parameters.
* **Then** the backend inherently sorts the results by `created_at DESC` (most recently favorited first).
* **And** provides optional sorting parameters (`sort_by=name`, `sort_order=ASC`) for custom ordering.
* **And** maintains consistent pagination ordering across multiple requests.