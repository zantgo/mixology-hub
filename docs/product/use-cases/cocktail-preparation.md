# ⚖️ Domain 4: Cocktail Preparation (ACID Transactions)

**UC 4.1: Successfully preparing a cocktail**
* **Given** the user has `500 ml` of "Whiskey".
* **And** prepares an "Old Fashioned" that requires `2 oz` (`59.14 ml`) of Whiskey.
* **When** the `POST /cocktails/:id/prepare` endpoint is called.
* **Then** a PostgreSQL database transaction begins.
* **And** the user's inventory is deducted to `440.86 ml`.
* **And** the transaction commits successfully.

**UC 4.2: Immediate Rejection of Insufficient Stock**
* **Given** the user has `50 ml` of "Whiskey".
* **And** attempts to prepare a drink requiring `60 ml`.
* **When** the `POST /cocktails/:id/prepare` endpoint is called.
* **Then** the system validates inventory sufficiency within a single ACID transaction.
* **And** when insufficient inventory is detected, the entire transaction rolls back.
* **And** the API returns `400 Bad Request` with error details about insufficient inventory.
* **And** the inventory remains at `50 ml` (no deduction).
* **And** no preparation log is created.
* **And** the frontend shows: "Cannot prepare: insufficient inventory"
* **Architectural Decision: Abandonment of Failed Preparation Logging**
  * **Explicit Trade-off:** To strictly adhere to the "Simple DB Transactions" mandate, Cocktail Preparations execute as a single, all-or-nothing ACID transaction. If an inventory quantity check fails, the entire transaction rolls back and immediately returns a 400 Bad Request. We explicitly abandon the insertion of "failed" or "pending" preparation logs. We trade the ability to run business analytics on failed cocktail attempts for absolute database transaction simplicity and the elimination of autonomous transaction workarounds.

**UC 4.3: SIMPLIFIED - Basic Inventory Validation**
* **Given** the user has exactly `50 ml` of "Vodka" left.
* **And** a cocktail requires `30 ml` of Vodka.
* **When** the user submits a `POST /cocktails/:id/prepare` request.
* **Then** the system validates inventory sufficiency before deducting.
* **Note**: No complex race condition handling. If users double-click, both requests may process. Basic database transactions prevent negative inventory but duplicate deductions may occur.

**UC 4.4: Undoing a Preparation with Inventory-Aware Logic**
 * **Given** the user accidentally clicked "Prepare" on a Martini.
 * **And** a preparation log exists with `inventory_status: 'deducted'` (59.14 ml of Gin was deducted).
 * **When** the user clicks "Undo" within a reasonable UI timeframe (triggering `POST /preparations/:log_id/undo`).
 * **Then** a transaction adds the exact required amounts back to the user's inventory.
 * **And** if the ingredient row was manually deleted by the user after reaching zero (not automatically deleted), the system recreates the row with the restored quantity.
 * **And** marks the preparation log as undone.
 * **Special Case - Failed Inventory**: If preparation log has `inventory_status: 'failed_insufficient'`, undo only marks log as undone (no inventory adjustment needed).
  * **Special Case - Admin Ingredient Deletion**: If an admin hard-deleted the ingredient from the global `INGREDIENTS` catalog (UC 1.20), the undo transaction will fail with a 500 Internal Server Error (consistent with UC 4.13). The preparation log remains marked as "prepared" (not undone), and no inventory is restored. This fail-closed approach prevents ledger corruption when the underlying ingredient taxonomy is mutated mid-flight.
  * **Architectural Decision: Fail-Closed Undo on Ingredient Taxonomy Mutation**
    * **Explicit Trade-off:** We acknowledge a microscopic race condition: if an Administrator hard-deletes or merges a global ingredient during a user's active 15-minute preparation window, the undo transaction will fail with a 500 Internal Server Error. We explicitly reject partial inventory restoration (which would corrupt the financial ledger) in favor of a clean, fail-closed transaction rollback. We trade the complexity of versioning historical ingredient taxonomies inside the PREPARATION_LOGS JSONB payload for absolute ledger integrity, accepting that users caught in this 1-in-a-million scenario must manually adjust their inventory via the UI.

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
* **Architectural Decision: Volumetric Bias for Ratio-Based Cocktails**
  * **Explicit Trade-off:** We explicitly accept a volumetric bias in our ratio math engine. When users input a `totalVolumeMl` for part-based drinks, the engine will blindly distribute that liquid volume across all parts, reverse-converting to mass for non-liquid ingredients using their density column. We trade strict culinary accuracy for simplified algorithmic distribution, accepting that part-based drinks heavily featuring solids/powders may calculate unpalatable ratios.
* **Architectural Decision: Bounding Minimum Part Values**
  * **Explicit Trade-off:** To prevent mathematical explosions (division by microscopically small floats) during part-to-volume ratio conversions, we explicitly mandate that any ingredient utilizing the part unit must have a minimum amount of 0.5. Custom recipes submitted with parts smaller than 0.5 will be rejected by the DTO validation layer with a 400 Bad Request. We trade extreme micro-ratio flexibility for guaranteed math-engine stability.
* **Architectural Decision: Volume Scaling Exclusivity for Part-Based Recipes**
  * **Explicit Trade-off:** We explicitly restrict the `totalVolumeMl` parameter exclusively to part/ratio-based cocktails. If a client passes `totalVolumeMl` to a fixed-unit recipe (e.g., standard ounces or ml), the backend will entirely ignore the volume request and scale strictly using the `servings` multiplier integer. We trade the flexibility of "make exactly 500ml of Margarita" for rigid, predictable mathematical integrity of classic culinary ratios.
* **Architectural Decision: Frontend Volume Conversion Responsibility**
  * **Explicit Trade-off:** The POST /cocktails/:id/prepare API contract strictly demands Metric (totalVolumeMl) for ratio-based volume scaling to maintain backend mathematical purity. We explicitly mandate that if a user operates in the Imperial unit system, the Angular frontend must convert their requested ounces to milliliters before submitting the payload. We accept the slight frontend-to-backend precision drift this causes, trading API flexibility for a rigidly normalized backend math engine.

* **Architectural Decision: DTO Optionality for Profile Context Injection**
  * **Explicit Trade-off:** To allow the backend to dynamically inject a user's default_part_size into ratio-based preparations, the totalVolumeMl parameter MUST remain strictly undefined (no default value) at the DTO validation layer. We explicitly trade the safety of DTO-level default initializers for the ability to contextually resolve user preferences at the service layer.
* **Architectural Decision: Rejection of Mixed-Ratio Recipes**
  * **Explicit Trade-off:** The math engine cannot safely interpolate a requested totalVolumeMl if a cocktail contains both fixed volumetric units (e.g., 15ml) and dynamic ratio units (e.g., 2 parts). We explicitly dictate that the Custom Cocktail Creation validation pipe MUST reject any recipe payload that attempts to mix part units with fixed volume/mass units (ml, oz, g). We trade advanced culinary flexibility for absolute math engine stability.

**UC 4.8: Time-Bounded "Undo" Functionality**
* **Given** a user prepared a cocktail 20 minutes ago.
* **When** they attempt to trigger the Undo endpoint.
* **Then** the system rejects it with a `TimeLimitExceeded` error (strictly enforcing the 15-minute window).
* **Architectural Decision: Token Refresh Grace Period for Undo Boundaries**
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
  * **Edge Case - Global Ingredient Deletion**: If an admin hard-deleted "Vodka" from the global `INGREDIENTS` catalog (UC 1.20), the undo transaction will fail with a 500 Internal Server Error. The preparation log remains marked as "prepared" (not undone), and no inventory is restored. This fail-closed approach prevents ledger corruption when the underlying ingredient taxonomy is mutated mid-flight.
  * **Architectural Decision: Fail-Closed Undo on Ingredient Taxonomy Mutation**
    * **Explicit Trade-off:** We acknowledge a microscopic race condition: if an Administrator hard-deletes or merges a global ingredient during a user's active 15-minute preparation window, the undo transaction will fail with a 500 Internal Server Error. We explicitly reject partial inventory restoration (which would corrupt the financial ledger) in favor of a clean, fail-closed transaction rollback. We trade the complexity of versioning historical ingredient taxonomies inside the PREPARATION_LOGS JSONB payload for absolute ledger integrity, accepting that users caught in this 1-in-a-million scenario must manually adjust their inventory via the UI.

**UC 4.14: Preparing External Cocktails On-The-Fly**
* **Given** the user discovers a cocktail from TheCocktailDB.
* **When** they click "Prepare" directly from the external search results.
* **Then** the system first fetches the external recipe from TheCocktailDB API.
* **And** only AFTER the external HTTP request resolves successfully, the PostgreSQL transaction begins.
* **Architectural Decision:** Never hold a PostgreSQL transaction open while waiting on a 3rd party HTTP request to prevent connection pool exhaustion and deadlocks.
* **And** creates a transient `PREPARATION_LOGS` entry referencing the external cocktail ID.
* **And** deducts inventory from the user's stock based on the external recipe's measurements.
* **And** allows the user to undo the preparation within the 15-minute window (even though the cocktail doesn't exist in the local database).
* **Architectural Decision: Permanent Image Blackout for External API Favorites & Preparations**
  * **Explicit Trade-off:** Because Favoriting or Preparing an external cocktail does not auto-fork the recipe into a local COCKTAILS database row, there is no relational column available to store the localized .webp file path generated by the Sharp library. We explicitly mandate that external API cocktails will NEVER have images rendered in the Favorites list or Preparation History. The Sharp ingestion process is strictly limited to the "Save as Custom Cocktail" action. We trade visual asset completeness in user history for a highly normalized, lightweight polymorphic database schema.
* **Architectural Decision: Fail-Closed Preparation for Cached External Cocktails**
  * **Explicit Trade-off:** While the Unified Search engine utilizes Redis caching to gracefully hide external API outages (UC 11.3), Cocktail Preparation (UC 4.14) requires fetching live volumetric data directly from the external provider to ensure math-engine accuracy. We explicitly accept that if an external provider goes down, users will be able to see cached external cocktails in their UI, but will receive a 502 Bad Gateway if they attempt to prepare them. We trade high-availability preparation for the guarantee that we never execute inventory math against potentially stale or incomplete cached external schemas.
* **Architectural Decision: Best-Effort External Preparation & NLP Resolution Failure**
  * **Explicit Trade-off:** When a user prepares an external API cocktail on-the-fly, the backend relies on NLP fuzzy-matching to resolve external string ingredients (e.g., "Light Rum") to local catalog UUIDs. We explicitly acknowledge that this mapping is not guaranteed. If the NLP resolver fails to find a high-confidence local match for any required ingredient, we mandate that the preparation transaction MUST fail-closed with a 400 Bad Request: Unrecognized External Ingredient. We trade seamless external API preparation for absolute mathematical ledger integrity, forcing the user to manually fork the recipe ("Save as Custom Cocktail") and assign the correct ingredients if they wish to prepare it.

**UC 4.15: Handling missing ingredient rows during preparation**
* **Given** a cocktail requires `2 oz` of "Vodka" and `1 oz` of "Olives".
* **And** the user has Vodka but has never added Olives to their inventory (no row exists).
* **When** the user attempts to prepare the cocktail.
* **Then** the transaction fails validation for the missing Olives.
* **Architectural Decision: Strict Zero-Quantity Rejection**
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

**UC 4.19: SIMPLIFIED - No Idempotency for Undo Action**
 * **Given** a preparation log (`log_id: 123`) has already been successfully undone (`undone = true`).
 * **When** a second concurrent or subsequent `POST /preparations/123/undo` request arrives.
 * **Then** the system checks if `undone = true` and returns an error without processing.
 * **And** no Redis idempotency cache or complex idempotency system is used.
 * **Architectural Decision: Acceptance of Duplicate State-Mutating Operations**
   * **Explicit Trade-off:** We explicitly refuse to implement distributed idempotency systems for state-mutating operations. We accept that network retries or user double-clicks may cause duplicate inventory deductions or preparation logs. We trade absolute data consistency for architectural simplicity and elimination of Redis-based idempotency tracking.

**UC 4.20: Preparation Undo vs. Mutated Recipes**
* **Given** a user prepares a cocktail, and the exact deduction is logged in the `PREPARATION_LOGS.deducted_ingredients` JSONB snapshot.
* **And** the cocktail's recipe is subsequently modified or deleted by the author.
* **When** the user triggers the Undo action.
* **Then** the system relies strictly on the `deducted_ingredients` JSONB payload to restore inventory.
* **And** completely ignores the current state of the `COCKTAILS` table.
* **And** ensures the undo works even if the cocktail no longer exists or has different ingredient requirements.
* **Architectural Decision: JSONB Log Corruption Tolerance on Admin Merges**
  * **Explicit Trade-off:** We explicitly accept that Admin taxonomy merges are instantly destructive to active 15-minute preparation undo windows. We trade the complexity of executing deep JSONB schema-migration queries (which would require parsing and updating thousands of JSON text blobs upon every ingredient merge) for simple, fast Admin moderation. Users attempting to undo a drink containing an ingredient that was merged mid-flight will receive a generic 500 error, and the undo action will fail.

**UC 4.21: SIMPLIFIED - No Idempotency System for State-Mutating Operations**
 * **Given** a client sends any state-mutating request (POST, PUT, PATCH, DELETE).
 * **When** a duplicate request arrives (network retry or double-click).
 * **Then** the request is processed normally, potentially causing duplicate state changes.
 * **And** users must manually correct duplicate operations using the undo feature or UI.
 * **Architectural Decision: Acceptance of Duplicate State-Mutating Operations**
   * **Explicit Trade-off:** We explicitly refuse to implement distributed idempotency systems for state-mutating operations. We accept that network retries or user double-clicks may cause duplicate inventory deductions or preparation logs. We trade absolute data consistency for architectural simplicity and elimination of Redis-based idempotency tracking.