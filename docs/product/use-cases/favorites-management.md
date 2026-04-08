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