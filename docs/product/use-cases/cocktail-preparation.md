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
* **And** `59.14 ml` of Gin was just deducted.
* **When** the user clicks "Undo" within a reasonable UI timeframe (triggering `POST /cocktails/:id/unprepare`).
* **Then** a transaction adds the exact required amounts back to the user's inventory.
* **And** handles restoring a deleted row if the ingredient had previously reached `0`.

**UC 4.5: Batch Preparation Deduction**
* **Given** the user verifies they can make 4 "Mojitos" (UC 3.7).
* **When** the user clicks "Prepare 4 Servings".
* **Then** the `POST /cocktails/:id/prepare` transaction deducts `Quantity * 4` from the inventory.
* **And** successfully commits the single transaction.