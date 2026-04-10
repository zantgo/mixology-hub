# ⚖️ Domain 4: Cocktail Preparation (ACID Transactions)

**UC 4.1: Successfully preparing a cocktail**
* **Given** the user has `500 ml` of "Whiskey".
* **And** prepares an "Old Fashioned" that requires `2 oz` (`59.14 ml`) of Whiskey.
* **When** the `POST /cocktails/:id/prepare` endpoint is called.
* **Then** a PostgreSQL database transaction begins.
* **And** the user's inventory is deducted to `440.86 ml`.
* **And** the transaction commits successfully.

**UC 4.2: Two-Phase Preparation with Insufficient Stock**
* **Given** the user has `50 ml` of "Whiskey".
* **And** attempts to prepare a drink requiring `60 ml`.
* **When** the `POST /cocktails/:id/prepare` endpoint is called.
* **Then** the system executes two-phase preparation:
  * **Phase 1**: Creates preparation log with `inventory_status: 'pending'`
  * **Phase 2**: Attempts inventory deduction, which fails validation in Math Engine
* **And** updates preparation log with `inventory_status: 'failed_insufficient'` and error details
* **And** the inventory remains at `50 ml` (no deduction).
* **And** the API returns `201 Created` with preparation log ID and warning about insufficient inventory.
* **And** the frontend shows: "Cocktail prepared! (Note: Inventory insufficient for full deduction)"

**UC 4.3: Race Condition Handling with Two-Phase Preparation**
* **Given** the user has exactly `50 ml` of "Vodka" left.
* **And** a cocktail requires `30 ml` of Vodka.
* **When** the user inadvertently double-clicks, sending two simultaneous `POST /cocktails/:id/prepare` requests.
* **Then** both requests create preparation logs with `inventory_status: 'pending'`.
* **And** the database row-level lock processes inventory deductions sequentially:
  * First transaction succeeds, deducting `30 ml` (leaving `20 ml`), updates log to `inventory_status: 'deducted'`
  * Second transaction fails validation, updates log to `inventory_status: 'failed_insufficient'`
* **And** both preparation logs exist for analytics and undo history.
* **And** the database is protected from dropping to `-10 ml`.

**UC 4.4: Undoing a Preparation with Inventory-Aware Logic**
 * **Given** the user accidentally clicked "Prepare" on a Martini.
 * **And** a preparation log exists with `inventory_status: 'deducted'` (59.14 ml of Gin was deducted).
 * **When** the user clicks "Undo" within a reasonable UI timeframe (triggering `POST /preparations/:log_id/undo`).
 * **Then** a transaction adds the exact required amounts back to the user's inventory.
 * **And** if the ingredient row was manually deleted by the user after reaching zero (not automatically deleted), the system recreates the row with the restored quantity.
 * **And** marks the preparation log as undone.
 * **Special Case - Failed Inventory**: If preparation log has `inventory_status: 'failed_insufficient'`, undo only marks log as undone (no inventory adjustment needed).
 * **Special Case - Admin Ingredient Deletion**: If an admin hard-deleted the ingredient from the global `INGREDIENTS` catalog (UC 1.20), the undo transaction gracefully skips restoring that specific ingredient rather than failing with a Foreign Key Constraint Violation. The preparation log is still marked as undone, and other ingredients are restored normally.

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
* **Senior Architectural Decision: Volumetric Bias for Ratio-Based Cocktails**
  * **Explicit Trade-off:** We explicitly accept a volumetric bias in our ratio math engine. When users input a `totalVolumeMl` for part-based drinks, the engine will blindly distribute that liquid volume across all parts, reverse-converting to mass for non-liquid ingredients using their density column. We trade strict culinary accuracy for simplified algorithmic distribution, accepting that part-based drinks heavily featuring solids/powders may calculate unpalatable ratios.

**UC 4.8: Time-Bounded "Undo" Functionality**
* **Given** a user prepared a cocktail 20 minutes ago.
* **When** they attempt to trigger the Undo endpoint.
* **Then** the system rejects it with a `TimeLimitExceeded` error (strictly enforcing the 15-minute window).
* **Senior Architectural Decision: Token Refresh Grace Period for Undo Boundaries**
  * **Explicit Trade-off:** Because our Access Token lifespan (15 minutes) exactly matches the Preparation Undo window (15 minutes), a mid-flight token refresh cycle (UC 9.5) can artificially delay an Undo request past the deadline. To prevent this race condition, the backend TimeLimitExceeded validator will internally allow a 16-minute window (a 60-second hidden grace period) to account for network latency and JWT rotation cycles, while the UI strictly advertises 15 minutes.

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
 * **Edge Case - Global Ingredient Deletion**: If an admin hard-deleted "Vodka" from the global `INGREDIENTS` catalog (UC 1.20), the undo transaction gracefully skips restoring this ingredient and logs a warning. The preparation log is marked as undone, and other ingredients are restored normally.
 * **Senior Architectural Decision: Ephemeral Undo Unit Corruption Tolerance**
   * **Explicit Trade-off:** We acknowledge a microscopic race condition: if an Administrator forcefully overrides a global ingredient's baseUnit during a user's active 15-minute preparation window, and the user clicks "Undo" after having deleted their inventory row, the system will recreate the row using the old numeric amount paired with the new, incompatible unit type. We explicitly accept this temporary data corruption risk. We trade the immense complexity of deeply versioning historical unit-types inside the PREPARATION_LOGS JSONB payload for a simpler architecture, accepting that this 1-in-a-million scenario will require manual user correction via the UI.

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
* **Senior Architectural Decision: Strict Zero-Quantity Rejection**
* **Explicit Trade-off**: The Preparation Engine must enforce strict mathematical reality. If a recipe requires > 0 of any non-optional ingredient, possessing exactly 0 quantity must trigger an immediate transaction rollback with 400 Insufficient Stock, exactly as if the user had never added the ingredient to their inventory. We trade the flexibility of "close enough" preparations for absolute inventory ledger accuracy. (Users must utilize the `?force=true` parameter—UC 4.18—if they wish to bypass this).

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

**UC 4.19: Idempotency of the Undo Action with Idempotency-Key**
 * **Given** a preparation log (`log_id: 123`) has already been successfully undone (`undone = true`).
 * **When** a second concurrent or subsequent `POST /preparations/123/undo` request arrives with the same `Idempotency-Key` header.
 * **Then** the backend checks the Redis idempotency cache using the unified format defined in ADR 0012: `idempotency:v2:{userId}:preparation:undo:{source}:{UUID}` (where source is `client` or `system`).
 * **And** returns the cached `200 OK` response (consistent with UC 4.21 pattern) without adding the inventory back a second time.
 * **Architectural Alignment:** The Redis caching layer strictly utilizes the unified format defined in ADR 0012 (`idempotency:v2:{userId}:{operation}:{source}:{uuid}`) rather than raw HTTP paths, ensuring namespace safety across different origin vectors.
 * **And** prevents the user from artificially inflating their inventory through retries or double-clicks.

**UC 4.20: Preparation Undo vs. Mutated Recipes**
* **Given** a user prepares a cocktail, and the exact deduction is logged in the `PREPARATION_LOGS.deducted_ingredients` JSONB snapshot.
* **And** the cocktail's recipe is subsequently modified or deleted by the author.
* **When** the user triggers the Undo action.
* **Then** the system relies strictly on the `deducted_ingredients` JSONB payload to restore inventory.
* **And** completely ignores the current state of the `COCKTAILS` table.
* **And** ensures the undo works even if the cocktail no longer exists or has different ingredient requirements.
* **Senior Architectural Decision: JSONB Log Corruption Tolerance on Admin Merges**
  * **Explicit Trade-off:** We explicitly accept that Admin taxonomy merges are instantly destructive to active 15-minute preparation undo windows. We trade the complexity of executing deep JSONB schema-migration queries (which would require parsing and updating thousands of JSON text blobs upon every ingredient merge) for simple, fast Admin moderation. Users attempting to undo a drink containing an ingredient that was merged mid-flight will receive a generic 500 error, and the undo action will fail.

**UC 4.21: Unified Idempotency System for State-Mutating Operations**
 * **Given** a client sends any state-mutating request (POST, PUT, PATCH, DELETE) with an idempotency identifier.
 * **When** a duplicate request arrives (network retry or double-click).
 * **Then** the Unified Idempotency Service checks:
    * **Primary**: Redis cache for performance (fast path)
    * **Fallback**: PostgreSQL `unified_idempotency` table as source of truth
    * **Format**: `idempotency:v2:{userId}:{operation}:{source}:{uuid}` (where source is `client` or `system`) as defined in ADR 0012
 * **And** returns the cached response without re-executing the operation.
 * **And** prevents double-deduction/inconsistent state while maintaining exactly-once semantics.
 * **Architecture**: PostgreSQL UNIQUE constraint guarantees no duplicates; Redis cache provides performance; automatic cache warming on startup.
 * **Security**: Idempotency keys are namespaced by user ID and operation to prevent cross-user attacks.