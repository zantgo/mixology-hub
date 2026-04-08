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
* **And** rounds the result to 2 decimal places (0.33) for `decimal(10,2)` database storage.
* **And** preserves the unit "oz" for later unit conversion.

**UC 1.4: Depleting inventory to zero**
* **Given** the user has exactly `50 ml` of "Vodka".
* **When** the user manually updates the quantity to `0 ml` OR prepares a drink requiring `50 ml`.
* **Then** the mathematical deduction results in exactly `0`.
* **And** the system either gracefully maintains a `0 ml` row OR deletes the row entirely from `user_inventory` (enforcing the chosen business rule).
* **And** the Makeable list instantly stops showing Vodka-based drinks.

**UC 1.5: Normalizing base units on insertion**
* **Given** a user inputs an inventory addition of `1 Liter` of "Vodka".
* **When** the request reaches the backend.
* **Then** the `UnitConverterService` intercepts the input and normalizes it to the system base unit (`1000 ml`).
* **And** it is stored in the database strictly as `1000` and `ml` to prevent unit fragmentation across queries.

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
* **Then** the API applies cursor-based pagination (just like Cocktails).
* **And** the results are sorted alphabetically by ingredient name or by recently updated.

**UC 1.13: Upper Boundary / Overflow Prevention**
* **Given** a user attempts to add `99999999999 ml` of Vodka to their inventory.
* **When** the request hits the API.
* **Then** the global validation pipe rejects the payload.
* **And** enforces a reasonable maximum limit (e.g., `max: 100000`) to prevent PostgreSQL `decimal(10,2)` overflow errors.

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