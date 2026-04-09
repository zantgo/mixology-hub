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

**UC 4.6: Deducting Optional Ingredients Conditionally**
* **Given** a recipe has an optional ingredient (e.g., Salt Rim).
* **When** the user prepares the cocktail.
* **Then** the system deducts the salt if present in inventory, but allows the transaction to succeed if the salt is missing.

**UC 4.7: Preparing Part/Ratio-Based Cocktails**
* **Given** a cocktail uses parts (1 part Gin, 1 part Vermouth).
* **When** the user prepares it providing `totalVolumeMl: 120`.
* **Then** the math engine divides the volume by total parts (60ml each) and deducts accordingly.

**UC 4.8: Time-Bounded "Undo" Functionality**
* **Given** a user prepared a cocktail 20 minutes ago.
* **When** they attempt to trigger the Undo endpoint.
* **Then** the system rejects it with a `TimeLimitExceeded` error (strictly enforcing the 15-minute window).

**UC 4.12: Undoing a Batch Preparation**
* **Given** a user prepared a batch of 4 Mojitos (deducting `8 oz` of Rum).
* **When** the user clicks "Undo" within the 15-minute window.
* **Then** the transaction references the specific preparation log.
* **And** successfully restores the full `8 oz` (amount × servings) back to the inventory, not just a single serving.
* **And** maintains ACID consistency across all ingredients in the batch.

**UC 4.13: Undoing preparation after manual ingredient hard-delete**
* **Given** the user prepares a cocktail, deducting `2 oz` of Vodka.
* **And** the user immediately goes to their inventory and **manually deletes** the entire "Vodka" row.
* **When** the user clicks "Undo" on the cocktail preparation within the 15-minute window.
* **Then** the `restoreInventory` transaction detects the missing row.
* **And** safely re-creates the Vodka row with the exact deducted amount (`2 oz`).
* **And** ensures the undo works even if the user manually deleted the ingredient after the preparation.

**UC 4.14: Preparing External Cocktails On-The-Fly**
* **Given** the user discovers a cocktail from TheCocktailDB.
* **When** they click "Prepare" directly from the external search results.
* **Then** the system first fetches the external recipe from TheCocktailDB API.
* **And** only AFTER the external HTTP request resolves successfully, the PostgreSQL transaction begins.
* **Architectural Decision:** Never hold a PostgreSQL transaction open while waiting on a 3rd party HTTP request to prevent connection pool exhaustion and deadlocks.
* **And** creates a transient `PREPARATION_LOGS` entry referencing the external cocktail ID.
* **And** deducts inventory from the user's stock based on the external recipe's measurements.
* **And** allows the user to undo the preparation within the 15-minute window (even though the cocktail doesn't exist in the local database).

**UC 4.15: Handling missing ingredient rows during preparation**
* **Given** a cocktail requires `2 oz` of "Vodka" and `1 oz` of "Olives".
* **And** the user has Vodka but has never added Olives to their inventory (no row exists).
* **When** the user attempts to prepare the cocktail.
* **Then** the transaction fails validation for the missing Olives.
* **And** if the user had 0 Olives, the transaction still succeeds, deducting only the Vodka.

**UC 4.16: Deducting from fragmented synonym inventory**
* **Given** a cocktail requires `2 oz` of "Orange Liqueur".
* **And** the user's inventory has `1.5 oz` of "Cointreau" and `1.5 oz` of "Triple Sec" (both synonyms).
* **When** the user clicks "Prepare".
* **Then** the backend applies a "Greedy Deduction Algorithm".
* **And** deducts the full `1.5 oz` from the largest stock ("Cointreau" or "Triple Sec"), and deducts the remaining `0.5 oz` from the other.
* **And** correctly logs both deductions in the `PREPARATION_LOGS` to allow for a perfect Undo.

**UC 4.17: Undoing preparation after manual stock addition**
* **Given** a user has `10 oz` of Vodka.
* **And** they prepare a drink, deducting `2 oz` (balance: `8 oz`).
* **And** they manually add `5 oz` to their inventory via the UI (balance: `13 oz`).
* **When** they click "Undo" on the preparation within the 15-minute window.
* **Then** the transaction correctly adds the `2 oz` back to the current balance.
* **And** the final inventory balance is `15 oz` (preventing the undo from overwriting the manual addition).

**UC 4.18: "Forced" Preparation of Almost Makeable Cocktails**
* **Given** a cocktail is "Almost Makeable" (missing Lime, but has Tequila).
* **When** the user explicitly triggers `POST /cocktails/:id/prepare?force=true`.
* **Then** the math engine deducts the Tequila from inventory.
* **And** ignores the missing Lime without throwing a `400 Bad Request`.
* **And** the transaction succeeds with partial deduction.

**UC 4.19: Idempotency of the Undo Action**
* **Given** a preparation log (`log_id: 123`) has already been successfully undone (`undone = true`).
* **When** a second concurrent or subsequent `POST /preparations/123/undo` request arrives.
* **Then** the database detects the `undone = true` state.
* **And** returns a `409 Conflict` (not `200 OK`) without adding the inventory back a second time.
* **Architectural Decision:** Returning `409 Conflict` explicitly tells the UI "This was already handled," preventing the frontend from accidentally incrementing visual stock twice if it relies on success responses. A `200 OK` would imply the action just succeeded, potentially causing UI state inconsistencies.
* **And** prevents the user from artificially inflating their inventory.

**UC 4.20: Preparation Undo vs. Mutated Recipes**
* **Given** a user prepares a cocktail, and the exact deduction is logged in the `PREPARATION_LOGS.deducted_ingredients` JSONB snapshot.
* **And** the cocktail's recipe is subsequently modified or deleted by the author.
* **When** the user triggers the Undo action.
* **Then** the system relies strictly on the `deducted_ingredients` JSONB payload to restore inventory.
* **And** completely ignores the current state of the `COCKTAILS` table.
* **And** ensures the undo works even if the cocktail no longer exists or has different ingredient requirements.

**UC 4.21: Idempotency Keys for Preparation (Network Retries)**
* **Given** a client sends a `POST /cocktails/:id/prepare` request with an `Idempotency-Key` header (e.g., a UUID generated on button click).
* **When** a network timeout occurs and the client automatically retries the exact same request.
* **Then** the backend checks the Redis idempotency cache using the `Idempotency-Key`.
* **And** returns the cached `200 OK` response without deducting the inventory a second time.
* **And** prevents double-deduction from mobile network retries while maintaining exactly-once semantics.