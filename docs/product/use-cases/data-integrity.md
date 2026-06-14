# 📊 Domain 10: Data Integrity & Edge Cases

**UC 10.1: Decimal Precision Preservation**
* **Given** a recipe requires `1/3 oz` of an ingredient (0.333... recurring decimal).
* **When** the `MeasureParserService` processes the measurement.
* **Then** it rounds to 4 decimal places (0.3333) for database storage to align with the PostgreSQL decimal(10,4) schema.
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

**UC 10.5: SIMPLIFIED - Basic Custom Ingredient Creation**
* **Given** two users trigger the creation of a custom ingredient named "Local Bitters".
* **When** the backend attempts to insert both records.
* **Then** a database-level `UNIQUE(normalized_name)` constraint catches the collision.
* **And** the second request may fail or return the existing ingredient ID.
* **Note**: No complex concurrent upsert/locking logic. Basic database constraints handle duplicates.

**UC 10.6: Orphaned Custom Ingredient Integrity on Account Deletion**
* **Given** User A created a custom ingredient ("My Secret Syrup") and used it in a Public Cocktail.
* **When** User A deletes their account (GDPR request).
* **Then** the custom ingredient record is NOT deleted, ensuring the Public Cocktail's relational integrity does not break.
* **And** the custom ingredient's `created_by` foreign key is safely set to `NULL` (anonymized).
* **Architectural Decision: Acceptance of Orphaned Ghost Ingredients**
  * **Explicit Trade-off:** When a user invokes GDPR account deletion, we rely on `ON DELETE SET NULL` to anonymize their custom ingredients to protect any public recipes that might rely on them. However, if the ingredient was private (`is_global = false`), it becomes permanently orphaned and invisible to the system. We explicitly accept the permanent accumulation of these "ghost ingredients" in the database, trading minor storage bloat for the absolute prevention of cascading relational integrity failures.



**UC 10.8: Exposing Private Ingredients via Public Cocktails**
* **Given** User A creates a custom ingredient (`is_global: false`) and uses it in a custom cocktail.
* **When** User A sets the cocktail to `is_public: true`.
* **Then** the custom ingredient remains `is_global: false` (not in the global search catalog).
* **But** the system grants "Read-Only context visibility" to User B when viewing that specific recipe.
* **And** allows User B to add that specific ingredient to their inventory directly from the recipe page so they can prepare it.
* **Architectural Decision: Asymmetric Ingredient Catalog Visibility**
  * **Explicit Trade-off:** We explicitly accept that users can possess inventory of private "Ghost" ingredients (acquired by clicking "Add to Inventory" from another user's public recipe) that they are subsequently banned from using as primary ingredients in their own newly authored recipes. The ingredient catalog search will strictly filter by `is_global = true` OR `created_by = current_user`. We trade flawless user ingredient sharing for strict database privacy scoping.

**UC 10.9: BullMQ Serialized Concurrency for Shared Inventory**
* **Given** the shared bar inventory has exactly "50 ml" of Vodka remaining.
* **And** Bartender A and Bartender B simultaneously click "Prepare" for drinks requiring "30 ml" of Vodka.
* **When** the requests are enqueued to the single-threaded BullMQ worker.
* **Then** the worker processes Bartender A's job first, successfully deducting "30 ml" (balance: "20 ml").
* **And** when the worker processes Bartender B's job second, it detects the balance is "20 ml".
* **And** gracefully fails the transaction with "failed_insufficient_stock".
* **And** no double-deductions or negative inventory balances occur.