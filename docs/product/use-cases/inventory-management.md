# 📦 Domain 1: Inventory Management (Backend)

**UC 1.1: Adding a new ingredient to inventory**
* **Given** the user has no "Vodka" in their inventory.
* **When** the user submits a request to add `500 ml` of "Vodka".
* **Then** a new inventory record is created in the database.
* **And** the user's inventory reflects `500 ml` of "Vodka".

**UC 1.2: Updating existing ingredient quantity (UPSERT)**
* **Given** the user already has `500 ml` of "Vodka" in their inventory.
* **When** the user submits a request to add `250 ml` of "Vodka".
* **Then** the database does not create a duplicate row (Composite Key Constraint).
* **And** the existing inventory record is mathematically updated to `750 ml`.

**UC 1.3: Parsing fractional measurements with recurring decimals**
* **Given** a cocktail recipe contains "1/3 oz" of an ingredient.
* **When** the `MeasureParserService` parses the measurement.
* **Then** it correctly converts "1/3" to a decimal value.
* **And** stores the result with 4 decimal places (0.3333) in `decimal(10,4)` database storage for accurate scaling.
* **And** preserves the unit "oz" for later unit conversion.
* **Note:** With 4 decimal places, scaling 1/3 oz to 10,000 servings yields 3333.3333 oz (accurate), not 3300.00 oz (truncated).
* **Architectural Decision: Acceptance of Fractional Truncation Drift**
  * **Explicit Trade-off:** By storing recipe fractions as `decimal(10,4)` in PostgreSQL, we permanently truncate recurring decimals (e.g., 1/3 becomes 0.3333). We explicitly accept that scaling a recipe to massive batch sizes (e.g., 10,000 servings) will result in a maximum precision drift of ±0.5 oz of total liquid. We trade absolute mathematical perfection (which would require storing numerators and denominators as separate database columns) for database schema simplicity and standard `decimal.js` interoperability.

**UC 1.4: Depleting inventory to zero**
* **Given** the user has exactly `50 ml` of "Vodka".
* **When** the user prepares a drink requiring `50 ml` (automatic depletion).
* **Then** the mathematical deduction results in exactly `0`.
* **And** the system maintains the row with `quantity = 0` (does NOT delete it automatically).
* **Architectural Decision:** Keeping the `0 ml` row allows the frontend to display "Out of Stock" state for the user's favorite ingredients, enabling seamless "Shopping List / Restock" views and preventing the need to recreate rows when users restock.
* **And** the Makeable list instantly stops showing Vodka-based drinks.
* **Note:** Users can still manually delete the row via UI (UC 1.6). If they do, and later undo a preparation that would restore that ingredient, the system must recreate the row (UC 4.4).

**UC 1.5: Normalizing base units on insertion**
* **Given** a user inputs an inventory addition of `1 Liter` of "Vodka".
* **When** the request reaches the backend.
* **Then** the `UnitConverterService` intercepts the input and normalizes it to the system base unit (`1000 ml`).
* **And** it is stored in the database strictly as `1000` with the unit implicitly defined by the ingredient's `baseUnit` field.
* **Architectural Decision: Elimination of Redundant Unit Column**
  * **Explicit Trade-off:** The `USER_INVENTORY` table originally contained a redundant `unit` column that duplicated information available via the `INGREDIENTS.baseUnit` foreign key relationship. We explicitly remove this column to enforce data normalization and prevent potential inconsistencies. All inventory quantities are stored in their base unit form, with the unit type determined by joining to the `INGREDIENTS` table. We trade a minor performance cost (additional join) for absolute data consistency and elimination of update anomalies.

**UC 1.6: Manual deletion of an ingredient**
* **Given** a user no longer wants "Vodka" tracked in their inventory.
* **When** the user explicitly triggers a DELETE request for the "Vodka" inventory row.
* **Then** the row is permanently removed from the `user_inventory` table.
* **And** all Vodka-based drinks immediately disappear from the Makeable list.

**UC 1.7: Fetching user inventory**
* **Given** an authenticated user has 5 different ingredients in their inventory.
* **When** they request `GET /inventory`.
* **Then** the API returns a list of inventory items.
* **And** successfully joins the relational `Ingredients` catalog to provide the ingredient names, categories, and images alongside the quantities.

**UC 1.8: Adding a custom, unrecognized ingredient**
* **Given** a user wants to add a hyper-local craft bitter not found in the global database.
* **When** the user submits the new ingredient.
* **Then** a new record is created in the `Ingredients` catalog flagged with `created_by = user_id` and `is_global = false`.
* **And** it is immediately linked to the `user_inventory` table with the specified quantity.
* **And** it only appears in search results and recipe creation for this specific user.
* **Architectural Decision: Acceptance of Orphaned Private "Ghost" Ingredients**
  * **Explicit Trade-off:** Custom ingredients created by users are flagged `is_global = false`. If a user deletes their account, `ON DELETE SET NULL` anonymizes the creator to protect relational integrity. However, because the ingredient is not global, no other user can query or view it. We explicitly accept that the database will permanently accumulate these private, ownerless "ghost ingredients." We trade minor database storage bloat for the absolute prevention of cascading relational failures on custom recipes.

**UC 1.9: Ingredient Name Normalization & Deduplication**
* **Given** the global catalog already contains "Vodka".
* **When** a user attempts to add a new custom ingredient spelled " vOdka " or "vodka".
* **Then** the backend normalizes the string (trims whitespace, converts to title/lower case).
* **And** detects the existing "Vodka" record.
* **And** links the user's inventory to the existing global Vodka record instead of creating a duplicate.

**UC 1.10: Strict Input Validation (Preventing Negative/Invalid Inputs)**
* **Given** an authenticated user.
* **When** they attempt to add `-500 ml` of Vodka or `"ABC ml"` of Gin.
* **Then** the global Validation Pipe (e.g., `class-validator`) intercepts the request.
* **And** rejects it with a `400 Bad Request` *before* it touches the database or math engine.

**UC 1.11: Admin Promotion of Custom Ingredients to Global Catalog**
* **Given** an admin user reviews the list of user-created custom ingredients.
* **When** they approve "Grandma's Bitters" (created by User A) for global availability.
* **Then** the ingredient's `is_global` flag is set to `true`.
* **And** it becomes available to all users in search and recipe creation.
* **And** User A receives notification that their ingredient was approved.

**UC 1.12: Inventory Pagination & Sorting**
* **Given** a power-user has added 500 unique ingredients to their inventory.
* **When** they request `GET /user-inventory`.
* **Then** the API applies page-based pagination (just like all other endpoints).
* **And** the results are sorted alphabetically by ingredient name or by recently updated.

**UC 1.13: Upper Boundary / Overflow Prevention**
* **Given** a user attempts to add `99999999999 ml` of Vodka to their inventory.
* **When** the request hits the API.
* **Then** the global validation pipe rejects the payload.
* **And** enforces a reasonable maximum limit (e.g., `max: 100000`) to prevent PostgreSQL `decimal(10,4)` overflow errors.

**UC 1.14: Adding "Count-Based" or Qualitative Inventory Items**
* **Given** a user wants to add "Lemons" or "Mint Leaves" to their inventory.
* **When** they select "Pieces" or "Whole" as the unit.
* **Then** the `UnitConverterService` recognizes this as a `count` base unit.
* **And** deducts them linearly (e.g., 1 Lemon - 0.5 Lemons = 0.5 Lemons) without attempting to map them to volume (`ml`) or mass (`g`).

**UC 1.15: Inventory Row Limits**
* **Given** a malicious or hyper-active user.
* **When** they attempt to add their 10,001st distinct ingredient to their inventory.
* **Then** the system returns a `422 Unprocessable Entity` to prevent database bloat/abuse.

**UC 1.16: Handling unparseable measurements during Cocktail Creation**
* **Given** a user is creating a custom cocktail.
* **When** they input a nonsensical measure (e.g., "a whole bunch of vodka").
* **Then** the `MeasureParserService` attempts to extract an amount and unit.
* **And** if it fails, it saves the `amount` as `null` and `unit` as `'unknown'`.
* **And** the UI displays a warning: "This ingredient's quantity cannot be tracked in inventory automatically."
* **And** when the user clicks "Prepare", this specific ingredient bypasses strict mathematical deduction (like qualitative measures in UC 3.3).

**UC 1.17: Inventory Addition Unit Validation**
* **Given** the global ingredient catalog defines Vodka's `baseUnit` as `ml` (volume).
* **When** a user attempts to add "1 slice of Vodka" or "500g of Vodka" to their inventory.
* **Then** the `POST /user-inventory` endpoint validates the unit against the ingredient's `baseUnit` type.
* **And** rejects count-based or mass-based inputs for volume-based ingredients at insertion time.
* **And** returns a `400 Bad Request` with a clear error message about incompatible units.
* **And** prevents corrupting the inventory ledger with incompatible unit types.

**UC 1.18: Editing Custom Ingredient Names (Admin Only)**
 * **Given** a user created a custom ingredient ("My Sirup").
 * **When** they submit a `PUT` request to correct the spelling to "My Syrup".
 * **Then** the system returns `403 Forbidden` - only administrators can rename custom ingredients.
 * **Rationale**: Custom ingredients are shared across users by name (UC 10.5). Allowing User B to rename "Secret Syrup" to "Poison" would affect User A's inventory and recipes.
 * **Admin Workflow**: Administrators can rename custom ingredients via admin panel, which updates the display name across all cocktails and inventory entries using this ingredient.
 * **Architectural Decision: Ingredient Ownership vs. Shared Catalog**
   * **Explicit Trade-off:** Users cannot rename their own custom ingredients because ingredients are shared globally by name. This prevents User A from maliciously renaming "Vodka" to "Poison" affecting all users. However, it creates a poor user experience where users cannot fix typos in their own ingredient names without admin assistance. We accept this trade-off for data integrity over user convenience.

**UC 1.19: Locking `baseUnit` for In-Use Ingredients**
* **Given** a user created "Custom Bitters" with a `baseUnit` of `ml`.
* **And** it is currently used in a Custom Cocktail or active Inventory row.
* **When** the user attempts to change the `baseUnit` to `count` or `g`.
* **Then** the system rejects the update with a `409 Conflict`.
* **And** prevents historical unit-conversion math from breaking.
* **And** provides a clear error message: "Cannot change base unit because ingredient is used in X recipes and Y inventory entries."

**UC 1.20: Admin Hard-Deletion of a Global Ingredient**
 * **Given** an Admin deletes a global ingredient "Bad Vodka".
 * **When** the DELETE request is executed.
 * **Then** the database safely cascades the deletion to remove it from all `user_inventory` rows.
 * **And** sets the `ingredient_id` to `NULL` (or softly tombstones it) in `cocktail_ingredients` so existing custom recipes do not completely break, but flag the missing ingredient.
 * **Architectural Decision: Orphaned Ingredient Math Degradation**
   * **Explicit Trade-off:** When an Admin hard-deletes an ingredient, the relational link is severed, and the math engine can no longer deduce the `baseUnit`. We explicitly mandate that any cocktail containing an ingredient where `ingredient_id IS NULL` is immediately and silently filtered out of the "Makeable Cocktails" SQL query. We trade historical recipe preservation for math engine stability; recipes with deleted ingredients are permanently classified as "Unmakeable."
 * **Architectural Decision: Recipe UI Degradation on Admin Hard Deletes**
   * **Explicit Trade-off:** We explicitly accept that when an Administrator hard-deletes a global ingredient, any custom recipes relying on that ingredient will permanently lose the ingredient's name reference, rendering it as an blank or "Unknown Ingredient" in the UI. We trade strict relational database normalization (refusing to duplicate string names into the COCKTAIL_INGREDIENTS pivot table) for this rare, edge-case UI degradation. If an author wants to fix their recipe, they must edit it and assign a new ingredient.

**UC 1.20a: User Cannot Delete Custom Ingredients**
 * **Given** a user creates a custom ingredient "Secret Syrup" that enters the shared global namespace (UC 10.5).
 * **When** the user realizes the ingredient is misspelled or wants to remove it.
 * **Then** the user cannot delete the ingredient definition (per UC 1.18 - only admins can rename/delete).
 * **And** the user can only delete their `user_inventory` relation to the ingredient (UC 1.6).
 * **And** the ingredient definition remains in the database permanently unless merged/deleted by an Admin.
 * **Rationale:** Custom ingredients become shared assets once created; allowing deletion would break other users' recipes and inventory.

**UC 1.21: Case-Insensitive Updates on Existing Custom Ingredients**
* **Given** a user has "My syrup" in inventory.
* **When** they attempt to add an ingredient typed as "MY SYRUP".
* **Then** the system leverages the `normalized_name` logic.
* **And** updates the quantity of the existing row rather than creating a duplicate row or throwing a 400 error.

**UC 1.22: Maximum Quantity Threshold per Row**
* **Given** a user attempts to add `999999` to an inventory item.
* **When** the system evaluates the request.
* **Then** it enforces a logical upper bound (e.g., `100,000 ml`) to prevent UI layout breaking, DB overflow, and integer-wrapping attacks.

**UC 1.23: Admin Merging Duplicate Ingredients**
* **Given** the database has "Fresh Lime" (ID: A) and "Lime" (ID: B).
* **When** an Admin triggers a merge of A into B via `POST /admin/ingredients/merge`.
* **Then** a transaction updates all `user_inventory` rows containing A to point to B.
* **And** updates all `cocktail_ingredients` rows containing A to point to B.
* **And** safely handles collisions (if a user already had both A and B in their inventory, it sums the quantities).
* **And** safely deletes ingredient A.
* **Architectural Decision: Strict Base-Unit Isolation on Ingredient Merges**
  * **Explicit Trade-off:** We explicitly forbid Administrators from merging two ingredients that have differing `baseUnit` types (e.g., merging a Volume into a Count). To protect the mathematical integrity of historical `user_inventory` and `cocktail_ingredients` data, the Admin UI will throw a `409 Conflict: Incompatible Base Units`. We trade administrative convenience (forcing admins to manually delete the erroneous ingredient rather than merging it) for the guarantee that the `UnitConverterService` math engine will never crash on corrupted cross-unit sums.
  * **Note:** With the removal of offline sync functionality, there are no pending operations to fail when ingredients are merged.
* **Architectural Decision: JSONB Log Corruption Tolerance on Admin Merges**
  * **Explicit Trade-off:** We explicitly accept that Admin taxonomy merges are instantly destructive to active 15-minute preparation undo windows. We trade the complexity of executing deep JSONB schema-migration queries (which would require parsing and updating thousands of JSON text blobs upon every ingredient merge) for simple, fast Admin moderation. Users attempting to undo a drink containing an ingredient that was merged mid-flight will receive a generic 500 error, and the undo action will fail.

**UC 1.24: Admin Taxonomy & Synonym CRUD**
* **Given** the math engine relies on synonyms for makeability.
* **When** an Admin submits a `POST /admin/ingredients/synonyms` payload mapping "Curaçao" to the base ingredient "Orange Liqueur".
* **Then** the relationship is saved in the database.
* **And** the makeability engine instantly allows users with "Curaçao" to make "Orange Liqueur" based drinks without requiring a server restart.
* **Architectural Decision: Strict Hierarchical Base Unit Isomorphism**
  * **Explicit Trade-off:** We explicitly forbid Administrators from creating is_a hierarchical relationships between ingredients that possess different baseUnit types (e.g., mapping a Mass ingredient as a child of a Volume ingredient). The `POST /admin/ingredients/synonyms` validation pipe will intercept this and throw a `409 Conflict: Hierarchical Base Unit Mismatch`. We accept that this prevents certain creative taxonomy mappings, prioritizing absolute mathematical safety during dynamic inventory aggregation.

**UC 1.25: Bulk Delete Inventory Items**
* **Given** a user wants to clear out expired ingredients after a party.
* **When** they select multiple inventory items and clicks "Delete Selected" (triggering `DELETE /user-inventory/bulk` with array of ingredient IDs).
* **Then** a single database transaction deletes all selected inventory rows.
* **And** returns success count and any failures (e.g., ingredients used in recent preparations).
* **And** maintains referential integrity with preparation logs.

**UC 1.26: Bulk Add Inventory Items**
* **Given** a user returns from grocery shopping with multiple new ingredients.
* **When** they upload a CSV or use a multi-add form (triggering `POST /user-inventory/bulk` with array of ingredient objects).
* **Then** a single database transaction inserts/updates all inventory items.
* **And** handles duplicates by summing quantities for existing ingredients.
* **And** validates all items before any are committed (all-or-nothing).

**UC 1.27: Querying the Global Ingredient Catalog**
* **Given** a user is adding inventory and starts typing "Whis".
* **When** the UI calls `GET /ingredients?q=Whis&limit=10`.
* **Then** the backend searches the `INGREDIENTS` table using fuzzy matching on `normalized_name`.
* **And** returns paginated results with ingredient IDs, names, and base units.
* **And** prevents duplicate ingredient creation by suggesting existing matches from the global catalog.

**UC 1.28: All-or-Nothing Bulk Inventory Addition**
* **Given** a user submits a `POST /user-inventory/bulk` payload with 50 ingredients.
* **And** ingredient #49 contains a validation error (e.g., `unit: "invalid_unit"`).
* **When** the request is processed.
* **Then** the database uses a strict transaction.
* **And** entirely rolls back the transaction.
* **And** returns a `400 Bad Request` specifying the exact index/ingredient that failed.
* **And** 0 items are added to the user's inventory to prevent fragmented state.

**UC 1.29: Preventing Recursive Synonyms in Admin Panel**
* **Given** an Admin attempts to map "Triple Sec" as a synonym of "Cointreau".
* **And** "Cointreau" is already mapped as a synonym of "Triple Sec" (or higher up the chain).
* **When** the `POST /admin/ingredients/synonyms` endpoint is called.
* **Then** the backend graph validation detects the cycle.
* **And** rejects the request with `409 Conflict: Cannot create circular synonym mapping`.
* **And** provides the detected cycle path for debugging: `Triple Sec → Cointreau → Triple Sec`.

**UC 1.30: Handling Out-of-Bounds Expiration Dates (Future-Proofing)**
 * **Given** a user inputs a manual restock via raw API.
* **When** they pass an absurd timestamp for an ingredient (e.g., year 9999 or year 1970).
* **Then** the system rejects it to prevent PostgreSQL timestamp overflow/underflow errors.
* **And** validates all timestamps are within reasonable bounds (e.g., 2000-01-01 to 2100-12-31).
* **And** returns a `400 Bad Request` with clear error: "Expiration date must be between 2000-01-01 and 2100-12-31".

**UC 1.31: Global Ingredient Update Cascade**
* **Given** an Admin corrects a typo on a global ingredient (e.g., "Wihskey" → "Whiskey").
* **When** the update commits.
* **Then** the system flushes the Redis search cache for any cocktails containing that ingredient.
* **And** synchronously updates any user-created cocktails that reference the old ingredient name.
* **And** ensures search results reflect the corrected name immediately.
* **Architectural Decision: Synchronous Taxonomy Cascades**
  * **Explicit Trade-off:** Because we have eradicated distributed background workers to maintain a zero-concurrency architecture, cascading string-name updates for global ingredients cannot be queued. We explicitly mandate that updating a global ingredient name will execute a synchronous, blocking SQL UPDATE against all reliant user-created cocktails. We accept that for heavily used ingredients, this may exceed reverse-proxy timeouts (e.g., 504 Gateway Timeout) during Admin operations. We trade administrative UI responsiveness for architectural simplicity.

* **Architectural Decision: Nuclear Cache Flushing on Taxonomy Edits**
  * **Explicit Trade-off:** Because Redis search caches are keyed by user search queries (e.g., search_unified:margarita), it is impossible to surgically identify which cached arrays contain a specific ingredient ID when an Admin updates the global taxonomy. We explicitly mandate that any Admin update to an Ingredient's name or baseUnit MUST execute a nuclear FLUSHALL or wildcard DEL search_unified:* across the Redis cache. We trade momentary system-wide cache-miss latency for absolute data consistency without complex cache-tagging architecture.