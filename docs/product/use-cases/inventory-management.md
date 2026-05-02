# 📦 Domain 1: Inventory Management (Backend)

> **B2B CONTEXT:** Only users with `role = 'admin'` (Bar Manager) may add, update, or delete stock in the shared `bar_inventory`. Bartenders (`role = 'bartender'`) have read-only access to view inventory levels and check makeability.

**UC 1.1: Admin adding a new ingredient to the bar inventory**
* **Given** the bar has no "Vodka" in `bar_inventory`.
* **When** an admin submits a request to add `500 ml` of "Vodka".
* **Then** a new inventory record is created in `bar_inventory`.
* **And** the bar's inventory reflects `500 ml` of "Vodka" (visible to all bartenders).

**UC 1.2: Admin updating existing ingredient quantity (UPSERT)**
* **Given** the bar already has `500 ml` of "Vodka" in `bar_inventory`.
* **When** an admin submits a request to add `250 ml` of "Vodka".
* **Then** the database does not create a duplicate row (Unique Constraint on `ingredient_id`).
* **And** the existing `bar_inventory` record is mathematically updated to `750 ml`.

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
* **Given** the bar has exactly `50 ml` of "Vodka".
* **When** a bartender prepares a drink requiring `50 ml` (via BullMQ worker automatic depletion).
* **Then** the mathematical deduction results in exactly `0`.
* **And** the system maintains the row with `quantity = 0` (does NOT delete it automatically).
* **Architectural Decision:** Keeping the `0 ml` row allows the frontend to display "Out of Stock" state, enabling seamless "Restock" views for the admin.
* **And** the Makeable list instantly stops showing Vodka-based drinks.
* **Note:** Admins can still manually delete the row via UI (UC 1.6). If they do, and later undo a preparation that would restore that ingredient, the system must recreate the row (UC 4.4).

**UC 1.5: Normalizing base units on insertion**
* **Given** an admin inputs an inventory addition of `1 Liter` of "Vodka".
* **When** the request reaches the backend.
* **Then** the `UnitConverterService` intercepts the input and normalizes it to the system base unit (`1000 ml`).
* **And** it is stored in the database strictly as `1000` with the unit implicitly defined by the ingredient's `baseUnit` field.

**UC 1.6: Admin deletion of an ingredient from bar inventory**
* **Given** the bar no longer stocks "Vodka".
* **When** an admin explicitly triggers a DELETE request for the "Vodka" inventory row.
* **Then** the row is permanently removed from `bar_inventory`.
* **And** all Vodka-based drinks immediately disappear from the Makeable list.

**UC 1.7: Fetching bar inventory**
* **Given** an authenticated bartender or admin wants to view the bar's stock.
* **When** they request `GET /bar-inventory`.
* **Then** the API returns a list of all inventory items in the shared `bar_inventory`.
* **And** successfully joins the relational `Ingredients` catalog to provide ingredient names, categories, and images alongside quantities.
* **And** any authenticated user (admin or bartender) can access this endpoint.

**UC 1.8: Admin adding a custom, unrecognized ingredient**
* **Given** an admin wants to add a hyper-local craft bitter not found in the global database.
* **When** the admin submits the new ingredient.
* **Then** a new record is created in the `Ingredients` catalog flagged with `created_by = admin_id` and `is_global = false`.
* **And** it is immediately linked to `bar_inventory` with the specified quantity.
* **And** it becomes available to all bartenders for search, recipe creation, and preparation.
* **Architectural Decision: Admin-Managed Ingredient Catalog**
  * **Explicit Trade-off:** Only admins can create new ingredients. If a bartender needs an ingredient added, they must request it from the bar manager. We trade bartender self-service flexibility for a clean, curated, admin-audited ingredient taxonomy.

**UC 1.9: Ingredient Name Normalization & Deduplication**
* **Given** the global catalog already contains "Vodka".
* **When** an admin attempts to add a new custom ingredient spelled " vOdka " or "vodka".
* **Then** the backend normalizes the string (trims whitespace, converts to lowercase).
* **And** detects the existing "Vodka" record.
* **And** links the bar's inventory to the existing Vodka record instead of creating a duplicate.

**UC 1.10: Strict Input Validation (Preventing Negative/Invalid Inputs)**
* **Given** an authenticated admin.
* **When** they attempt to add `-500 ml` of Vodka or `"ABC ml"` of Gin.
* **Then** the global Validation Pipe (e.g., `class-validator`) intercepts the request.
* **And** rejects it with a `400 Bad Request` *before* it touches the database or math engine.

**UC 1.11: Admin Promotion of Custom Ingredients to Global Catalog**
* **Given** an admin reviews the list of custom ingredients.
* **When** they approve a custom ingredient for full global availability.
* **Then** the ingredient's `is_global` flag is set to `true`.
* **And** it becomes available in all search and recipe creation contexts across the bar.

**UC 1.12: Inventory Pagination & Sorting**
* **Given** the bar has stocked 500 unique ingredients.
* **When** any user requests `GET /bar-inventory`.
* **Then** the API applies page-based pagination.
* **And** the results are sorted alphabetically by ingredient name or by recently updated.

**UC 1.13: Upper Boundary / Overflow Prevention**
* **Given** an admin attempts to add `99999999999 ml` of Vodka.
* **When** the request hits the API.
* **Then** the global validation pipe rejects the payload.
* **And** enforces a reasonable maximum limit (e.g., `max: 100000`) to prevent PostgreSQL `decimal(10,4)` overflow errors.

**UC 1.14: Adding "Count-Based" or Qualitative Inventory Items**
* **Given** an admin wants to add "Lemons" or "Mint Leaves" to the bar inventory.
* **When** they select "Pieces" or "Whole" as the unit.
* **Then** the `UnitConverterService` recognizes this as a `count` base unit.
* **And** deducts them linearly (e.g., 1 Lemon - 0.5 Lemons = 0.5 Lemons) without attempting to map them to volume (`ml`) or mass (`g`).

**UC 1.15: Inventory Row Limits**
* **Given** the bar catalog grows excessively.
* **When** an admin attempts to add the 10,001st distinct ingredient to `bar_inventory`.
* **Then** the system returns a `422 Unprocessable Entity` to prevent database bloat/abuse.

**UC 1.16: Handling unparseable measurements during Cocktail Creation**
* **Given** a user is creating a custom cocktail.
* **When** they input a nonsensical measure (e.g., "a whole bunch of vodka").
* **Then** the `MeasureParserService` attempts to extract an amount and unit.
* **And** if it fails, it saves the `amount` as `null` and `unit` as `'unknown'`.
* **And** the UI displays a warning: "This ingredient's quantity cannot be tracked in inventory automatically."
* **And** when "Prepare" is clicked, this specific ingredient bypasses strict mathematical deduction (like qualitative measures in UC 3.3).

**UC 1.17: Inventory Addition Unit Validation**
* **Given** the global ingredient catalog defines Vodka's `baseUnit` as `ml` (volume).
* **When** an admin attempts to add "1 slice of Vodka" or "500g of Vodka" to `bar_inventory`.
* **Then** the `POST /bar-inventory` endpoint validates the unit against the ingredient's `baseUnit` type.
* **And** rejects count-based or mass-based inputs for volume-based ingredients at insertion time.
* **And** returns a `400 Bad Request` with a clear error message about incompatible units.

**UC 1.18: Editing Ingredient Names (Admin Only)**
 * **Given** an ingredient in the catalog has a typo (e.g., "My Sirup").
 * **When** an admin submits a `PUT` request to correct the spelling to "My Syrup".
 * **Then** the system updates the ingredient name across all cocktails and inventory entries.
 * **When** a bartender attempts the same operation.
 * **Then** the system returns `403 Forbidden` — only administrators can rename ingredients.
 * **Rationale**: Ingredients are shared across all bartenders. Allowing arbitrary name changes would affect everyone's recipes and inventory views.

**UC 1.19: Locking `baseUnit` for In-Use Ingredients**
* **Given** an ingredient "Custom Bitters" with a `baseUnit` of `ml`.
* **And** it is currently used in a cocktail or active `bar_inventory` row.
* **When** an admin attempts to change the `baseUnit` to `count` or `g`.
* **Then** the system rejects the update with a `409 Conflict`.
* **And** prevents historical unit-conversion math from breaking.

**UC 1.20: Admin Hard-Deletion of a Global Ingredient**
 * **Given** an Admin deletes a global ingredient "Bad Vodka".
 * **When** the DELETE request is executed.
 * **Then** the database safely cascades the deletion to remove it from `bar_inventory`.
 * **And** sets the `ingredient_id` to `NULL` in `cocktail_ingredients` so existing recipes do not completely break, but flag the missing ingredient.
 * **Architectural Decision: Orphaned Ingredient Math Degradation**
   * **Explicit Trade-off:** When an Admin hard-deletes an ingredient, the relational link is severed, and the math engine can no longer deduce the `baseUnit`. We explicitly mandate that any cocktail containing an ingredient where `ingredient_id IS NULL` is immediately and silently filtered out of the "Makeable Cocktails" query. Recipes with deleted ingredients are permanently classified as "Unmakeable."
 * **Architectural Decision: Recipe UI Degradation on Admin Hard Deletes**
   * **Explicit Trade-off:** When an Administrator hard-deletes a global ingredient, any recipes relying on that ingredient will permanently lose the ingredient's name reference, rendering it as a blank or "Unknown Ingredient" in the UI. If an author wants to fix their recipe, they must edit it and assign a new ingredient.

**UC 1.21: Case-Insensitive Updates on Existing Ingredients**
* **Given** the bar has "My syrup" in `bar_inventory`.
* **When** an admin attempts to add an ingredient typed as "MY SYRUP".
* **Then** the system leverages the `normalized_name` logic.
* **And** updates the quantity of the existing row rather than creating a duplicate row or throwing a 400 error.

**UC 1.22: Maximum Quantity Threshold per Row**
* **Given** an admin attempts to add `999999` to an inventory item.
* **When** the system evaluates the request.
* **Then** it enforces a logical upper bound (e.g., `100,000 ml`) to prevent UI layout breaking, DB overflow, and integer-wrapping attacks.

**UC 1.23: Admin Merging Duplicate Ingredients**
* **Given** the database has "Fresh Lime" (ID: A) and "Lime" (ID: B).
* **When** an Admin triggers a merge of A into B via `POST /admin/ingredients/merge`.
* **Then** a transaction updates all `bar_inventory` rows containing A to point to B.
* **And** updates all `cocktail_ingredients` rows containing A to point to B.
* **And** safely handles collisions (if the bar already had both A and B, it sums the quantities).
* **And** safely deletes ingredient A.
* **Architectural Decision: Strict Base-Unit Isolation on Ingredient Merges**
  * **Explicit Trade-off:** We explicitly forbid Administrators from merging two ingredients that have differing `baseUnit` types (e.g., merging a Volume into a Count). To protect mathematical integrity, the Admin UI will throw a `409 Conflict: Incompatible Base Units`.
* **Architectural Decision: JSONB Log Corruption Tolerance on Admin Merges**
  * **Explicit Trade-off:** Admin taxonomy merges are instantly destructive to active 15-minute preparation undo windows. Users attempting to undo a drink containing an ingredient that was merged mid-flight will receive a generic 500 error, and the undo action will fail.

**UC 1.24: Admin Taxonomy & Synonym CRUD**
* **Given** the math engine relies on synonyms for makeability.
* **When** an Admin submits a `POST /admin/ingredients/synonyms` payload mapping "Curaçao" to the base ingredient "Orange Liqueur".
* **Then** the relationship is saved in the database.
* **And** the makeability engine instantly allows the bar to make "Orange Liqueur" based drinks using "Curaçao" without requiring a server restart.
* **Architectural Decision: Strict Hierarchical Base Unit Isomorphism**
  * **Explicit Trade-off:** We explicitly forbid Administrators from creating `is_a` hierarchical relationships between ingredients that possess different `baseUnit` types. The validation pipe will intercept this and throw a `409 Conflict: Hierarchical Base Unit Mismatch`.

**UC 1.25: Bulk Delete Inventory Items**
* **Given** an admin wants to clear out expired ingredients after a busy night.
* **When** they select multiple inventory items and click "Delete Selected" (triggering `DELETE /bar-inventory/bulk` with array of ingredient IDs).
* **Then** a single database transaction deletes all selected inventory rows.
* **And** returns success count and any failures.
* **And** maintains referential integrity with preparation logs.

**UC 1.26: Bulk Add Inventory Items**
* **Given** an admin returns from a supply run with multiple new ingredients.
* **When** they upload a CSV or use a multi-add form (triggering `POST /bar-inventory/bulk` with array of ingredient objects).
* **Then** a single database transaction inserts/updates all inventory items.
* **And** handles duplicates by summing quantities for existing ingredients.
* **And** validates all items before any are committed (all-or-nothing).

**UC 1.27: Querying the Global Ingredient Catalog**
* **Given** an admin is adding inventory and starts typing "Whis".
* **When** the UI calls `GET /ingredients?q=Whis&limit=10`.
* **Then** the backend searches the `INGREDIENTS` table using fuzzy matching on `normalized_name`.
* **And** returns paginated results with ingredient IDs, names, and base units.
* **And** prevents duplicate ingredient creation by suggesting existing matches from the catalog.

**UC 1.28: All-or-Nothing Bulk Inventory Addition**
* **Given** an admin submits a `POST /bar-inventory/bulk` payload with 50 ingredients.
* **And** ingredient #49 contains a validation error (e.g., `unit: "invalid_unit"`).
* **When** the request is processed.
* **Then** the database uses a strict transaction.
* **And** entirely rolls back the transaction.
* **And** returns a `400 Bad Request` specifying the exact index/ingredient that failed.
* **And** 0 items are added to `bar_inventory` to prevent fragmented state.

**UC 1.29: Preventing Recursive Synonyms in Admin Panel**
* **Given** an Admin attempts to map "Triple Sec" as a synonym of "Cointreau".
* **And** "Cointreau" is already mapped as a synonym of "Triple Sec" (or higher up the chain).
* **When** the `POST /admin/ingredients/synonyms` endpoint is called.
* **Then** the backend graph validation detects the cycle.
* **And** rejects the request with `409 Conflict: Cannot create circular synonym mapping`.
* **And** provides the detected cycle path for debugging: `Triple Sec → Cointreau → Triple Sec`.

**UC 1.30: Handling Out-of-Bounds Expiration Dates (Future-Proofing)**
 * **Given** an admin inputs a manual restock via raw API.
 * **When** they pass an absurd timestamp for an ingredient (e.g., year 9999 or year 1970).
 * **Then** the system rejects it to prevent PostgreSQL timestamp overflow/underflow errors.
 * **And** returns a `400 Bad Request` with clear error: "Expiration date must be between 2000-01-01 and 2100-12-31".

**UC 1.31: Global Ingredient Update Cache Invalidation**
* **Given** an Admin corrects a typo on a global ingredient (e.g., "Wihskey" → "Whiskey").
* **When** the update commits.
* **Then** the system flushes the Redis search cache for any cocktails containing that ingredient.
* **And** synchronously updates any cocktails that reference the old ingredient name.
* **And** ensures search results reflect the corrected name immediately.
* **Note:** With BullMQ now available as core infrastructure, future iterations may offload cache invalidation cascades to background queue workers rather than synchronous blocking updates.
