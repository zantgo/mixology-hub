# 🧮 Domain 3: Smart Inventory & Makeable Intelligence

> **B2B CONTEXT:** Makeability is calculated against the single, shared `bar_inventory`. All bartenders see the exact same "Makeable" list. There is no per-user inventory isolation.

**UC 3.1: Discovering makeable cocktails with unit conversion**
* **Given** `bar_inventory` contains `1000 ml` of "Gin".
* **And** the database contains a "Martini" requiring `2 oz` of Gin.
* **When** any bartender requests the "Makeable" cocktails list.
* **Then** the `UnitConverterService` mathematically converts `2 oz` to `59.14 ml`.
* **And** verifies that `1000 >= 59.14`.
* **And** "Martini" is returned in the Makeable list (visible to all bartenders).

**UC 3.2: Filtering out missing ingredients**
* **Given** `bar_inventory` has `50 ml` of "Rum" and no "Mint".
* **And** a "Mojito" recipe requires Rum and Mint.
* **When** any bartender requests the "Makeable" list.
* **Then** the SQL `HAVING` clause detects the missing "Mint" relation.
* **And** "Mojito" is completely excluded from the Makeable list.

**UC 3.3: Handling Qualitative/Non-Numeric Measures**
* **Given** a "Margarita" recipe requires `2 oz` of Tequila and `"A pinch"` of Salt.
* **And** `bar_inventory` contains `500 ml` of Tequila and `100 g` of Salt.
* **When** the BullMQ worker evaluates the preparation job.
* **Then** the `MeasureParserService` evaluates `"A pinch"` as an amount of `null`.
* **And** the math engine safely bypasses the strict numeric deduction for Salt.
* **And** the Tequila is successfully mathematically deducted.
* **Architectural Decision: Acceptance of Infinite Qualitative Inventory with Rinse Exception**
  * **Explicit Trade-off:** Qualitative units (dash, pinch) experience zero automated inventory depletion, with the explicit exception of a rinse. Admins must manually decrement bottles of bitters, salt, or citrus peels for qualitative measures.

**UC 3.4: Rejecting Incompatible Unit Conversions**
* **Given** `bar_inventory` has `500 ml` of "Honey".
* **And** a recipe requires `200 g` (grams) of "Honey".
* **When** the `UnitConverterService` attempts to validate makeability.
* **Then** it detects a base unit mismatch (Volume vs. Mass without density data).
* **And** throws an `IncompatibleUnitError`.
* **And** gracefully excludes the cocktail from the Makeable list instead of crashing.

**UC 3.5: Handling "Optional" Ingredients**
* **Given** a "Gin & Tonic" recipe requires `Gin`, `Tonic Water`, and an **optional** `Lime Wedge` garnish.
* **And** `bar_inventory` has `Gin` and `Tonic Water` but NO `Lime Wedge`.
* **When** the Makeable Cocktails query runs.
* **Then** the SQL engine ignores the missing `Lime Wedge` due to its `is_optional = true` flag.
* **And** "Gin & Tonic" is successfully returned in the Makeable list.

**UC 3.6: Discovering "Almost Makeable" (Missing Ingredients or Insufficient Quantity)**
 * **Given** `bar_inventory` has Tequila and Triple Sec, but no Lime.
 * **When** the Makeable Cocktails query runs.
 * **Then** the system identifies "Margarita".
 * **And** tags it as `missing_ingredients: ["Lime"]`.
 * **And** returns it in a separate "Almost Makeable" category to prompt admin restocking.
 * **Definition:** "Almost Makeable" includes cocktails where:
   * The bar is missing exactly 1 required ingredient (has >0 quantity of N-1 ingredients)
   * OR the bar has all ingredients but insufficient quantity of at least one
   * Excludes cocktails missing 2+ ingredients (those remain "Unmakeable")

**UC 3.7: Serving Size Multipliers (Scaling)**
* **Given** a bartender wants to make a batch of 4 "Mojitos".
* **When** they query the makeability engine with `servings=4`.
* **Then** the system mathematically multiplies all required recipe ingredient volumes by 4.
* **And** evaluates makeability against `bar_inventory` using the new scaled requirements.

**UC 3.8: Scaling-Induced "Almost Makeable" Transition**
* **Given** `bar_inventory` has 4oz of Vodka and a Martini requires 2oz per serving.
* **When** a bartender requests `servings=1`, the cocktail is **Makeable**.
* **When** they request `servings=3` (requires 6oz total), the cocktail transitions to **"Almost Makeable"**.
* **Then** the system dynamically recalculates makeability based on scaled requirements.
* **And** provides clear feedback: "Missing 2oz Vodka for 3 servings".

**UC 3.9: Ratio/Part-based Measurements**
* **Given** a cocktail recipe uses "parts" (e.g., 1 part Gin, 1 part Campari).
* **When** the system evaluates makeability without a `totalVolumeMl` parameter.
* **Then** for background evaluations, it uses `USER_PROFILES.default_part_size` (default: 30ml) multiplied by total parts.
* **And** for interactive evaluations, it flags the cocktail as `requiresUserInput` to prompt for desired total volume.

**UC 3.10: Synonym Aggregation for Makeability**
* **Given** `bar_inventory` has 30ml "Triple Sec" and 40ml "Cointreau" (synonyms for Orange Liqueur).
* **And** a recipe requires 60ml "Orange Liqueur".
* **When** makeability is calculated.
* **Then** the engine aggregates the synonyms (70ml total) and marks the drink as Makeable.

**UC 3.11: Makeability with Un-tracked Garnishes**
* **Given** a cocktail requires an optional garnish (e.g., "Mint Sprig").
* **When** `bar_inventory` has the base spirits but lacks the garnish.
* **Then** the cocktail is marked as "Makeable (Missing Garnish)" rather than completely unmakeable.

**UC 3.12: Hierarchical Ingredient Satisfaction**
* **Given** a cocktail requires generic "Whiskey".
* **And** `bar_inventory` has specific "Bourbon".
* **When** makeability is checked.
* **Then** the engine resolves the IS-A relationship and marks it as Makeable.

**UC 3.17: Recursive Hierarchy/Synonym Infinite Loop Prevention**
* **Given** the ingredient database has a circular reference: `Bourbon → Whiskey → Bourbon`.
* **When** the `IngredientService.resolveHierarchy()` method is called for Bourbon.
* **Then** the method tracks visited nodes to detect circular references.
* **And** throws a `CircularReferenceError` or safely breaks the loop.
* **And** prevents stack overflow or infinite loops during makeability calculations.
* **And** logs the circular reference for database cleanup.

**UC 3.18: Deducting from overlapping synonym inventories**
* **Given** a recipe requires `1 oz Light Rum` AND `1 oz Dark Rum`.
* **And** `bar_inventory` has exactly `1.5 oz` of generic "Rum" (which maps as a hierarchical synonym to both).
* **When** the makeability engine evaluates the cocktail.
* **Then** it accurately sums the *total* required rum (`2 oz`).
* **And** correctly flags the cocktail as "Almost Makeable" (missing 0.5 oz), rather than double-counting the 1.5 oz for both requirements.
* **And** prevents inventory over-allocation across overlapping synonym hierarchies.

**UC 3.19: Handling 0-Volume / Rinse Ingredients**
 * **Given** a "Sazerac" recipe requires an "Absinthe Rinse" (amount: `0` or `null`, unit: `rinse`).
 * **When** the makeability engine checks `bar_inventory`.
 * **Then** the system requires Absinthe with `quantity >= 3` (the hardcoded micro-deduction amount in `ml`), not just `> 0`.
 * **And** when "Prepared", the system converts the qualitative `rinse` into a hardcoded micro-deduction of `3 ml` via the `UnitConverterService`.

**UC 3.20: Fractional Servings / Scaling Down**
* **Given** a cocktail requires `2 oz` of Whiskey, but `bar_inventory` has `1 oz`.
* **When** a bartender requests makeability with `servings=0.5`.
* **Then** the math engine divides the requirements (`1 oz` Whiskey).
* **And** flags the cocktail as `Makeable` for a half-portion.

**UC 3.21: Evaluating Makeability for External API Cocktails**
* **Given** TheCocktailDB returns a cocktail with string ingredients like "Light Rum".
* **When** the Aggregator Service processes external cocktails for makeability.
* **Then** it calls `resolveBaseIngredient("Light Rum")` to map the string to a local UUID.
* **And** queries the Redis synonym cache to find canonical ingredient relationships.
* **And** passes the resolved UUIDs to the Makeability Math Engine for calculation against `bar_inventory`.
* **And** caches the string-to-UUID mappings to optimize subsequent evaluations.
* **Clarification on Makeability Sorting:** When `sort=makeability` is applied to Unified Search, the CocktailAggregatorService automatically drops all External API results, returning ONLY Local Database cocktails.

**UC 3.22: Aggregating Specific Children to satisfy a Generic Parent**
* **Given** a cocktail requires `4 oz` of generic "Whiskey".
* **And** `bar_inventory` has NO generic "Whiskey" row, but has `2 oz` of "Bourbon" and `2 oz` of "Rye".
* **When** the Makeable Cocktails query runs.
* **Then** the math engine traverses the hierarchy upwards.
* **And** aggregates the children (`2 + 2 = 4`).
* **And** flags the cocktail as Makeable.

**UC 3.23: Bounding Part-Based Total Volumes**
* **Given** a bartender requests makeability or preparation of a part-based cocktail.
* **When** they input a `totalVolumeMl` exceeding `10,000 ml` (10 Liters).
* **Then** the validation pipe rejects the request with `400 Bad Request`.
* **And** prevents integer overflow or massive decimal calculations in the Math Engine.

**UC 3.24: Mass-to-Volume Density Conversion**
* **Given** a recipe requires `50 g` of "Honey" and `bar_inventory` has `100 ml` of Honey.
* **When** the `UnitConverterService` attempts to validate makeability.
* **Then** it references the `density` column on the Honey ingredient record (e.g., `1.42 g/ml`).
* **And** mathematically calculates that `50 g` equals `35.21 ml`.
* **And** successfully validates that `100 ml >= 35.21 ml` without throwing an `IncompatibleUnitError`.

**UC 3.25: The N+1 Makeability Pagination Problem**
 * **Context:** Cannot paginate in SQL after doing in-memory math for makeability validation.
 * **Given** a bartender requests `GET /makeable?limit=10&page=1&sort=makeability`.
 * **When** the SQL `HAVING` clause returns 5,000 potentially makeable cocktails.
 * **Then** the Math Engine evaluates cocktails sequentially with a hard cap of 200 iterations (ADR 0008 DoS protection).
 * **And** evaluates until either: (1) `limit` makeable cocktails are found, OR (2) 200 iterations reached.
 * **And** if the 200-iteration cap is reached before finding `limit` makeable cocktails, returns `400 Bad Request: PAGINATION_OVERSHOOT` to prevent deep pagination DoS attacks.
 * **Hard Limits:** Global maximum `page=100` (capped at 1,000 items with default limit=10). Makeability computation limited to 200 iterations.
 * **Chronological Bias:** Because the engine evaluates cocktails in database order (typically `created_at DESC`), it can only discover the 200 most recently added cocktails.
