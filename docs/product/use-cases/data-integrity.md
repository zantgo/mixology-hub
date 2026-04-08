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

**UC 10.7: Maximum URL Length Enforcement (Image URLs)**
* **Given** a malicious user submits a Custom Cocktail with an `image_url` containing a 10,000-character string (Base64 payload or buffer overflow attempt).
* **When** the DTO validation pipe runs.
* **Then** it enforces a strict maximum length (e.g., 2048 characters) for URLs.
* **And** rejects the payload with a `400 Bad Request` before hitting the database.
* **And** prevents database column overflow and potential DoS attacks through oversized payloads.