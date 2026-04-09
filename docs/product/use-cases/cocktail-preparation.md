# ⚖️ Domain 4: Cocktail Preparation (ACID Transactions)

**UC 4.1: Successfully preparing a cocktail**
* **Given** the user has `500 ml` of "Whiskey".
* **And** prepares an "Old Fashioned" that requires `2 oz` (`59.14 ml`) of Whiskey.
* **When** the `POST /cocktails/:id/prepare` endpoint is called.
* **Then** a PostgreSQL database transaction begins.
* **And** the user's inventory is deducted to `440.86 ml`.
* **And** the transaction commits successfully.

**UC 4.2: Failing to prepare due to insufficient stock (Rollback)**
* **Given** the user has `50 ml` of "Whiskey".
* **And** attempts to prepare a drink requiring `60 ml`.
* **When** the `POST /cocktails/:id/prepare` endpoint is called.
* **Then** the validation fails in the Math Engine.
* **And** the database transaction rolls back automatically to prevent negative numbers.
* **And** the inventory remains exactly at `50 ml`.
* **And** the API returns a `400 Bad Request`.

**UC 4.3: Preventing Negative Inventory via Concurrent Requests (Race Condition)**
* **Given** the user has exactly `50 ml` of "Vodka" left.
* **And** a cocktail requires `30 ml` of Vodka.
* **When** the user inadvertently double-clicks, sending two simultaneous `POST /cocktails/:id/prepare` requests.
* **Then** the database row-level lock (or transaction isolation) processes them sequentially.
* **And** the first transaction succeeds, deducting `30 ml` (leaving `20 ml`).
* **And** the second transaction fails validation, triggering an automatic rollback.
* **And** the database is protected from dropping to `-10 ml`.

**UC 4.4: Undoing a Preparation (Accidental Click)**
* **Given** the user accidentally clicked "Prepare" on a Martini.
* **And** `59.14 ml` of Gin was just deducted, creating a preparation log entry.
* **When** the user clicks "Undo" within a reasonable UI timeframe (triggering `POST /preparations/:log_id/undo`).
* **Then** a transaction adds the exact required amounts back to the user's inventory.
* **And** handles restoring a deleted row if the ingredient had previously reached `0`.
* **And** marks the preparation log as undone.

**UC 4.5: Batch Preparation Deduction**
* **Given** the user verifies they can make 4 "Mojitos" (UC 3.7).
* **When** the user clicks "Prepare 4 Servings".
* **Then** the `POST /cocktails/:id/prepare` transaction deducts `Quantity * 4` from the inventory.
* **And** successfully commits the single transaction.

**UC 4.9: Undoing a Batch Preparation**
* **Given** a user prepared a batch of 4 Mojitos (deducting `8 oz` of Rum).
* **When** the user clicks "Undo" within the 15-minute window.
* **Then** the transaction references the specific preparation log.
* **And** successfully restores the full `8 oz` (amount × servings) back to the inventory, not just a single serving.
* **And** maintains ACID consistency across all ingredients in the batch.

**UC 4.10: Undoing preparation after manual ingredient hard-delete**
* **Given** the user prepares a cocktail, deducting `2 oz` of Vodka.
* **And** the user immediately goes to their inventory and **manually deletes** the entire "Vodka" row.
* **When** the user clicks "Undo" on the cocktail preparation within the 15-minute window.
* **Then** the `restoreInventory` transaction detects the missing row.
* **And** safely recreates the "Vodka" inventory row with exactly `2 oz` rather than throwing a `Foreign Key` or `Not Found` error.
* **And** preserves the original `user_id` and `ingredient_id` relationships.

**UC 4.11: Preparing an External API Cocktail On-The-Fly**
* **Given** the user requests `POST /cocktails/11000/prepare` for an external cocktail from TheCocktailDB.
* **When** the transaction begins.
* **Then** the backend dynamically fetches the recipe from TheCocktailDB (or Redis Cache).
* **And** uses `IngredientService.resolveBaseIngredient()` to map the external string ingredients to local inventory `UUIDs`.
* **And** mathematically deducts the stock from the user's inventory based on the dynamic mapping without requiring the external recipe to be permanently saved to the local database.

**UC 4.12: Deducting Garnishes During Preparation**
* **Given** a cocktail requires `2 oz Vodka` and an optional `1 piece Olive` (garnish).
* **And** the user has both in their inventory.
* **When** they click "Prepare".
* **Then** the backend mathematically deducts the Vodka (volume) AND linearly deducts 1 Olive (count-based).
* **And** if the user had 0 Olives, the transaction still succeeds, deducting only the Vodka.

**UC 4.13: Deducting from fragmented synonym inventory**
* **Given** a cocktail requires `2 oz` of "Orange Liqueur".
* **And** the user's inventory has `1.5 oz` of "Cointreau" and `1.5 oz` of "Triple Sec" (both synonyms).
* **When** the user clicks "Prepare".
* **Then** the backend applies a "Greedy Deduction Algorithm".
* **And** deducts the full `1.5 oz` from the largest stock ("Cointreau" or "Triple Sec"), and deducts the remaining `0.5 oz` from the other.
* **And** correctly logs both deductions in the `PREPARATION_LOGS` to allow for a perfect Undo.