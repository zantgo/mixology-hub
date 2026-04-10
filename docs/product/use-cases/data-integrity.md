# 📊 Domain 10: Data Integrity & Edge Cases

**UC 10.1: Decimal Precision Preservation**
* **Given** a recipe requires `1/3 oz` of an ingredient (0.333... recurring decimal).
* **When** the `MeasureParserService` processes the measurement.
* **Then** it rounds to 2 decimal places (0.33) for database storage.
* **And** maintains a separate `original_measure` field preserving the human-readable `"1/3 oz"` for display.

**UC 10.2: Unit Conversion Edge Cases**
* **Given** a recipe requires `1 cup` of an ingredient.
* **And** the user's inventory contains `250 ml` of the same ingredient.
* **When** the `UnitConverterService` attempts to validate makeability.
* **Then** it correctly converts `1 cup` to `236.59 ml` using the appropriate conversion factor.
* **And** accurately determines makeability based on the converted value.

**UC 10.3: Ingredient Synonym Resolution**
* **Given** a recipe calls for `"Cointreau"`.
* **And** the user's inventory contains `"Triple Sec"`.
* **When** the system evaluates makeability.
* **Then** it consults the `ingredient_synonyms` mapping table.
* **And** recognizes `"Cointreau"` and `"Triple Sec"` as equivalent for makeability calculations.

**UC 10.4: Soft-Deletion of Favorited Custom Cocktails**
* **Given** User A creates "Custom Drink" and User B adds it to Favorites.
* **When** User A calls `DELETE /cocktails/:id`.
* **Then** the cocktail is not hard-deleted (to protect User B's UI experience).
* **And** the `is_deleted` flag is set to `true` (Soft Delete).
* **And** User B's Favorites list flags it as "Recipe deleted by author" but doesn't crash.

**UC 10.5: Concurrent Custom Ingredient Creation (Upsert/Locking)**
* **Given** two users concurrently trigger the creation of a custom ingredient named "Local Bitters".
* **When** the backend attempts to insert both records.
* **Then** a database-level `UNIQUE(normalized_name)` constraint catches the collision.
* **And** TypeORM handles the `ON CONFLICT DO NOTHING` (or returns the ID of the first inserted row).
* **And** both users successfully add the *same* ingredient ID to their inventory without a 500 Server Error.

**UC 10.6: Orphaned Custom Ingredient Integrity on Account Deletion**
* **Given** User A created a custom ingredient ("My Secret Syrup") and used it in a Public Cocktail.
* **When** User A deletes their account (GDPR request).
* **Then** the custom ingredient record is NOT deleted, ensuring the Public Cocktail's relational integrity does not break.
* **And** the custom ingredient's `created_by` foreign key is safely set to `NULL` (anonymized).



**UC 10.8: Exposing Private Ingredients via Public Cocktails**
* **Given** User A creates a custom ingredient (`is_global: false`) and uses it in a custom cocktail.
* **When** User A sets the cocktail to `is_public: true`.
* **Then** the custom ingredient remains `is_global: false` (not in the global search catalog).
* **But** the system grants "Read-Only context visibility" to User B when viewing that specific recipe.
* **And** allows User B to add that specific ingredient to their inventory directly from the recipe page so they can prepare it.

**UC 10.9: Concurrent Custom Cocktail Modification & Preparation**
* **Given** User A is preparing a cocktail (transaction started).
* **And** User B concurrently submits an edit to that exact cocktail's ingredients.
* **When** both transactions attempt to commit.
* **Then** the preparation transaction uses `REPEATABLE READ` isolation level to prevent phantom reads during inventory validation.
* **And** the edit transaction uses `READ COMMITTED` isolation level (PostgreSQL default) for non-inventory operations.
* **And** the preparation transaction strictly uses the ingredient snapshot from the moment the transaction began.
* **And** the edit transaction succeeds independently, updating the cocktail for future preparations.
* **And** prevents data corruption by ensuring each transaction operates on a consistent snapshot.
* **Architectural Decision:** Inventory deduction transactions require stricter isolation (`REPEATABLE READ` or `SERIALIZABLE`) to prevent race conditions, while non-inventory operations can use the default `READ COMMITTED`.
* **Implementation:** Uses PostgreSQL's MVCC (Multi-Version Concurrency Control) to maintain consistency without explicit locking.