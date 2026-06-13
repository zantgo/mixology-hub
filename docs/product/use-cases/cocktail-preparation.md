# ⚖️ Domain 4: Cocktail Preparation (Queue-Based ACID Transactions)

> **B2B ARCHITECTURE:** Cocktail preparation no longer executes synchronously in the HTTP controller. Instead, `POST /cocktails/:id/prepare` enqueues a job to the `bar-orders` BullMQ queue and returns `202 Accepted`. A single-threaded worker (`concurrency: 1`) processes jobs sequentially, executing PostgreSQL ACID transactions to deduct from the shared `bar_inventory`. See ADR 0017.

**UC 4.1: Submitting a cocktail preparation order (Queue Pattern)**
* **Given** a bartender wants to prepare an "Old Fashioned" requiring `2 oz` (`59.14 ml`) of Whiskey.
* **When** the bartender clicks "Prepare" (triggering `POST /cocktails/:id/prepare`).
* **Then** the backend validates the request (auth, role, cocktail ID).
* **And** creates a `PREPARATION_LOGS` record with `status = 'queued'` and `bartender_id = current_user`.
* **And** pushes a job to the Redis `bar-orders` BullMQ queue.
* **And** returns `202 Accepted` with `{ preparationLogId, statusUrl: '/preparations/:logId/status' }`.
* **And** the frontend displays a spinner/pending state.
* **Then** the BullMQ Worker (concurrency: 1) picks up the job.
* **And** opens a PostgreSQL ACID transaction.
* **And** validates that `bar_inventory` has sufficient Whiskey (via `UnitConverterService`).
* **And** if sufficient: deducts from `bar_inventory`, updates `PREPARATION_LOGS` to `status = 'completed'`, commits the transaction.
* **And** if insufficient: rolls back the transaction, updates `PREPARATION_LOGS` to `status = 'failed_insufficient_stock'`.
* **And** on infrastructure failure (e.g., Redis disconnection, worker crash): updates `PREPARATION_LOGS` to `status = 'failed_other'`.
* **And** the frontend detects the status change (via polling or WebSocket) and updates the UI accordingly.

**UC 4.2: Immediate Rejection of Invalid Requests**
* **Given** a bartender submits a prepare request for a non-existent cocktail.
* **When** the `POST /cocktails/:id/prepare` endpoint is called.
* **Then** the HTTP controller validates the cocktail exists BEFORE enqueuing.
* **And** returns `404 Not Found` without creating a queue job or preparation log.
* **Given** a bartender submits a prepare request with invalid servings (e.g., -1).
* **When** validation occurs.
* **Then** the system returns `400 Bad Request` immediately.

**UC 4.3: Inventory Validation Inside the Worker**
* **Given** the bar has exactly `50 ml` of "Vodka" left.
* **And** a bartender submits a prepare order requiring `30 ml` of Vodka.
* **When** the BullMQ worker processes the job.
* **Then** the worker validates inventory sufficiency within a single ACID transaction.
* **And** successfully deducts `30 ml` (balance: `20 ml`).
* **Note:** Because the worker runs with `concurrency: 1`, no other bartender's order can interleave between the SELECT and UPDATE. Race conditions are mathematically eliminated.

**UC 4.4: Undoing a Preparation with Inventory-Aware Logic**
 * **Given** a bartender accidentally clicked "Prepare" on a Martini.
 * **And** a preparation log exists with `status: 'completed'` (59.14 ml of Gin was deducted).
 * **When** the bartender clicks "Undo" within 15 minutes (triggering `POST /preparations/:log_id/undo`).
 * **Then** a transaction adds the exact required amounts back to `bar_inventory`.
 * **And** if the ingredient row was manually deleted by an admin after reaching zero, the system recreates the row with the restored quantity.
 * **And** marks the preparation log as undone.
 * **Special Case - Failed Preparation**: If preparation log has `status: 'failed_insufficient_stock'` or `status: 'failed_other'`, undo only marks the log as undone (no inventory adjustment needed).
 * **Special Case - Admin Ingredient Deletion**: If an admin hard-deleted the ingredient from the global `INGREDIENTS` catalog (UC 1.20), the undo transaction will fail with a 500 Internal Server Error. The preparation log remains marked as "completed" (not undone), and no inventory is restored.
 * **Architectural Decision: Fail-Closed Undo on Ingredient Taxonomy Mutation**
   * **Explicit Trade-off:** If an Administrator hard-deletes or merges a global ingredient during the 15-minute preparation window, the undo transaction will fail with a 500 Internal Server Error. We explicitly reject partial inventory restoration in favor of a clean, fail-closed transaction rollback. Users caught in this scenario must manually adjust inventory via the admin UI.

**UC 4.5: Batch Preparation Deduction**
* **Given** a bartender wants to make 4 "Mojitos".
* **When** they click "Prepare 4 Servings".
* **Then** the queue job includes `servings: 4` in the payload.
* **And** the BullMQ worker multiplies all recipe ingredient requirements by 4 before deducting from `bar_inventory`.
* **And** commits a single ACID transaction with all deductions.

**UC 4.6: Deducting Optional Ingredients Conditionally**
* **Given** a recipe has an optional ingredient (e.g., Salt Rim).
* **When** a bartender submits a prepare order.
* **Then** the worker deducts the salt if present in `bar_inventory`, but allows the transaction to succeed if the salt is missing.

**UC 4.7: Preparing Part/Ratio-Based Cocktails**
* **Given** a cocktail uses parts (1 part Gin, 1 part Vermouth).
* **When** a bartender prepares it providing `totalVolumeMl: 120`.
* **Then** the worker divides the volume by total parts (60ml each) and deducts accordingly.
* **Architectural Decision: Volumetric Bias for Ratio-Based Cocktails**
  * **Explicit Trade-off:** The math engine applies a volumetric bias — distributing `totalVolumeMl` across all parts and reverse-converting to mass for non-liquid ingredients using their density column. We trade strict culinary accuracy for simplified algorithmic distribution.
* **Architectural Decision: Volume Scaling Exclusivity for Part-Based Recipes**
  * **Explicit Trade-off:** `totalVolumeMl` is exclusive to part/ratio-based cocktails. For fixed-unit recipes, the engine scales strictly using the `servings` multiplier integer.
* **Architectural Decision: Frontend Volume Conversion Responsibility**
  * **Explicit Trade-off:** The API contract demands Metric (`totalVolumeMl`). The Angular frontend must convert Imperial (oz) to milliliters before submitting the payload.

**UC 4.8: Time-Bounded "Undo" Functionality**
* **Given** a bartender prepared a cocktail 20 minutes ago.
* **When** they attempt to trigger the Undo endpoint.
* **Then** the system rejects it with a `TimeLimitExceeded` error (15-minute window).
* **Architectural Decision: Token Refresh Grace Period for Undo Boundaries**
  * **Explicit Trade-off:** The backend allows a 16-minute window (60-second hidden grace period) for network latency and JWT rotation cycles, while the UI advertises 15 minutes.

**UC 4.12: Undoing a Batch Preparation**
* **Given** a bartender prepared a batch of 4 Mojitos (deducting `8 oz` of Rum).
* **When** the bartender clicks "Undo" within the 15-minute window.
* **Then** the transaction references the specific preparation log.
* **And** successfully restores the full `8 oz` (amount × servings) back to `bar_inventory`.
* **And** maintains ACID consistency across all ingredients in the batch.

**UC 4.13: Undoing preparation after manual ingredient hard-delete**
 * **Given** a bartender prepares a cocktail, deducting `2 oz` of Vodka from `bar_inventory`.
 * **And** an admin immediately hard-deletes the entire "Vodka" row from `bar_inventory`.
 * **When** the bartender clicks "Undo" on the cocktail preparation within the 15-minute window.
 * **Then** the `restoreInventory` transaction detects the missing row.
 * **And** safely re-creates the Vodka row with the exact deducted amount (`2 oz`).
 * **And** ensures the undo works even if an admin manually deleted the ingredient after the preparation.
 * **Edge Case - Global Ingredient Deletion**: If an admin hard-deleted "Vodka" from the global `INGREDIENTS` catalog (UC 1.20), the undo transaction will fail with a 500 Internal Server Error.

**UC 4.14: Preparing External Cocktails On-The-Fly**
* **Given** a bartender discovers a cocktail from TheCocktailDB.
* **When** they click "Prepare" from the external search results.
* **Then** the system first fetches the external recipe from TheCocktailDB API.
* **And** only AFTER the external HTTP request resolves, the job is enqueued to BullMQ.
* **Architectural Decision:** Never hold a PostgreSQL transaction or a queue slot open while waiting on a 3rd party HTTP request.
* **And** creates a `PREPARATION_LOGS` entry referencing the external cocktail ID.
* **And** the BullMQ worker deducts inventory from `bar_inventory` based on the external recipe's measurements.
* **And** the bartender can undo the preparation within the 15-minute window.
* **Architectural Decision: Best-Effort External Preparation & NLP Resolution Failure**
  * **Explicit Trade-off:** External ingredient strings (e.g., "Light Rum") are resolved to local catalog UUIDs via NLP fuzzy-matching. If the resolver fails to find a high-confidence match for any required ingredient, the system returns `400 Bad Request: Unrecognized External Ingredient`. The bartender must fork the recipe ("Save as Custom Cocktail") and assign correct ingredients to prepare it.

**UC 4.15: Handling missing ingredient rows during preparation**
* **Given** a cocktail requires `2 oz` of "Vodka" and `1 oz` of "Olives".
* **And** `bar_inventory` has Vodka but no Olives (no row exists).
* **When** the BullMQ worker processes the job.
* **Then** the transaction fails validation for the missing Olives.
* **And** updates `PREPARATION_LOGS` to `status = 'failed_insufficient_stock'`.
* **Architectural Decision: Strict Zero-Quantity Rejection**
  * **Explicit Trade-off:** If a recipe requires > 0 of any non-optional ingredient, possessing exactly 0 quantity triggers immediate transaction rollback with `failed_insufficient_stock`. (Bartenders must use `?force=true` — UC 4.18 — to bypass this.)

**UC 4.16: Deducting from fragmented synonym inventory**
* **Given** a cocktail requires `2 oz` of "Orange Liqueur".
* **And** `bar_inventory` has `1.5 oz` of "Cointreau" and `1.5 oz` of "Triple Sec" (both synonyms).
* **When** the BullMQ worker processes the preparation.
* **Then** it applies a "Greedy Deduction Algorithm".
* **And** deducts the full `1.5 oz` from the largest stock, and deducts the remaining `0.5 oz` from the other.
* **And** correctly logs both deductions in `PREPARATION_LOGS` for a perfect Undo.

**UC 4.17: Undoing preparation after manual stock addition**
* **Given** `bar_inventory` has `10 oz` of Vodka.
* **And** a bartender prepares a drink, deducting `2 oz` (balance: `8 oz`).
* **And** an admin manually adds `5 oz` via the UI (balance: `13 oz`).
* **When** the bartender clicks "Undo" on the preparation within the 15-minute window.
* **Then** the transaction correctly adds the `2 oz` back to the current balance.
* **And** the final inventory balance is `15 oz` (preventing the undo from overwriting the manual addition).

**UC 4.18: "Forced" Preparation of Almost Makeable Cocktails**
* **Given** a cocktail is "Almost Makeable" (missing Lime, but has Tequila).
* **When** a bartender explicitly triggers `POST /cocktails/:id/prepare?force=true`.
* **Then** the BullMQ worker deducts available ingredients from `bar_inventory`.
* **And** ignores the missing Lime without failing the transaction.
* **And** the transaction succeeds with partial deduction.

**UC 4.19: Undo Idempotency via `undone` Column**
 * **Given** a preparation log (`log_id: 123`) has already been successfully undone (`undone = true`).
 * **When** a second `POST /preparations/123/undo` request arrives.
 * **Then** the system checks if `undone = true` and returns `409 Conflict` without processing.
 * **And** no duplicate inventory restoration occurs.
 * **Note:** The BullMQ serialization guarantees no concurrent undo operations on the same log. The `undone` flag provides defense-in-depth for sequential duplicate requests.

**UC 4.20: Preparation Undo vs. Mutated Recipes**
* **Given** a bartender prepares a cocktail, and the exact deduction is logged in the `PREPARATION_LOGS.deducted_ingredients` JSONB snapshot.
* **And** the cocktail's recipe is subsequently modified or deleted.
* **When** the bartender triggers the Undo action.
* **Then** the system relies strictly on the `deducted_ingredients` JSONB payload to restore inventory.
* **And** completely ignores the current state of the `COCKTAILS` table.
* **And** ensures the undo works even if the cocktail no longer exists.

**UC 4.21: Queue-Enforced Isolation Eliminates Duplicate Operations**
 * **Given** a bartender double-clicks "Prepare" on a cocktail.
 * **When** two nearly-identical `POST /cocktails/:id/prepare` requests arrive.
 * **Then** each creates a separate `PREPARATION_LOGS` entry with `status = 'queued'` and pushes an independent job to BullMQ.
 * **And** the `concurrency: 1` worker processes them sequentially.
 * **And** if the first job depletes the required ingredient, the second job will fail with `status = 'failed_insufficient_stock'`.
  * **And** no double-deduction occurs — the worker naturally serializes access to `bar_inventory`.
  * **Architectural Decision: Sequential Idempotency via Queue Serialization**
    * **Explicit Trade-off:** We rely on BullMQ's sequential execution (`concurrency: 1`) rather than complex distributed idempotency keys. Double-clicks produce two queue jobs, but only the first can succeed against available inventory. We trade the elimination of an idempotency system for the acceptance of a visible `failed_insufficient_stock` log entry for the duplicate click.

**UC 4.22: Order Status Pipeline Flow**
* **Given** a bartender submits a cocktail preparation order.
* **When** the order is successfully registered.
* **Then** the initial state is set to `queued` while awaiting processing.
* **And** when the single-threaded BullMQ worker picks up the job, the status transitions to `evaluating`.
* **And** the worker executes transactional checks against `bar_inventory` and returns the evaluation response.
* **And** if stock is sufficient, the status transitions to `preparing` while actual physical/simulated preparation (inventory deductions) occurs.
* **And** upon final database updates and commit, the status is set to `completed`.
* **And** during the `evaluating` phase, a re-check of the preparation log's status ensures that a mid-flight cancellation (from another HTTP connection) is honored before stock is deducted.

**UC 4.23: Mid-Flight Order Cancellation**
* **Given** a cocktail preparation order is in the `queued` or `evaluating` status.
* **When** the bartender requests a cancellation via `POST /preparations/:logId/cancel`.
* **Then** the database status is immediately set to `cancelled`.
* **And** if the single-threaded BullMQ worker has not yet picked up the job, it skips the job upon finding `status = 'cancelled'` without deducting stock.
* **And** if the worker is midway through the evaluation phase, the re-check (UC 4.22) detects the cancelled status and aborts before any deductions occur.
* **And** if the order has already transitioned to `preparing` or `completed` status, cancellation requests are strictly rejected with a `400 Bad Request` error.
* **And** a cancelled order is visible in the preparation log as a terminal state, with no inventory impact.
