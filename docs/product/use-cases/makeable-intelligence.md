# 🧮 Domain 3: Smart Inventory & Makeable Intelligence

**UC 3.1: Discovering makeable cocktails with unit conversion**
* **Given** the user's inventory contains `1000 ml` of "Gin".
* **And** the database contains a "Martini" requiring `2 oz` of Gin.
* **When** the user requests the list of "Makeable" cocktails.
* **Then** the `UnitConverterService` mathematically converts `2 oz` to `59.14 ml`.
* **And** verifies that `1000 >= 59.14`.
* **And** "Martini" is returned in the Makeable list.

**UC 3.2: Filtering out missing ingredients**
* **Given** the user has `50 ml` of "Rum" and no "Mint".
* **And** a "Mojito" recipe requires Rum and Mint.
* **When** the user requests the "Makeable" list.
* **Then** the SQL `HAVING` clause detects the missing "Mint" relation.
* **And** "Mojito" is completely excluded from the Makeable list.

**UC 3.3: Handling Qualitative/Non-Numeric Measures**
* **Given** a "Margarita" recipe requires `2 oz` of Tequila and `"A pinch"` of Salt.
* **And** the user's inventory contains `500 ml` of Tequila and `100 g` of Salt.
* **When** the `prepare` transaction evaluates the ingredients.
* **Then** the `MeasureParserService` evaluates `"A pinch"` as an amount of `null`.
* **And** the math engine safely bypasses the strict numeric deduction for Salt.
* **And** the Tequila is successfully mathematically deducted.

**UC 3.4: Rejecting Incompatible Unit Conversions**
* **Given** the user's inventory has `500 ml` of "Honey".
* **And** a recipe requires `200 g` (grams) of "Honey".
* **When** the `UnitConverterService` attempts to validate makeability.
* **Then** it detects a base unit mismatch (Volume vs. Mass without density data).
* **And** throws an `IncompatibleUnitError`.
* **And** gracefully excludes the cocktail from the Makeable list instead of crashing.

**UC 3.5: Handling "Optional" Ingredients**
* **Given** a "Gin & Tonic" recipe requires `Gin`, `Tonic Water`, and an **optional** `Lime Wedge` garnish.
* **And** the user has `Gin` and `Tonic Water` but NO `Lime Wedge`.
* **When** the Makeable Cocktails query runs.
* **Then** the SQL engine ignores the missing `Lime Wedge` due to its `is_optional = true` flag.
* **And** "Gin & Tonic" is successfully returned in the Makeable list.

**UC 3.6: Discovering "Almost Makeable" (Missing Ingredients or Insufficient Quantity)**
 * **Given** the user has Tequila and Triple Sec, but no Lime.
 * **When** the Makeable Cocktails query runs.
 * **Then** the system identifies "Margarita".
 * **And** tags it as `missing_ingredients: ["Lime"]`.
 * **And** returns it in a separate "Almost Makeable" category to drive user engagement/shopping.
 * **Definition:** "Almost Makeable" includes cocktails where:
   * User is missing exactly 1 required ingredient (has >0 quantity of N-1 ingredients)
   * OR user has all ingredients but insufficient quantity of at least one (e.g., has 4oz Vodka but needs 6oz for 3 servings - UC 3.8)
   * Excludes cocktails missing 2+ ingredients (those remain "Unmakeable")

**UC 3.7: Serving Size Multipliers (Scaling)**
* **Given** a user wants to make a batch of 4 "Mojitos".
* **When** they query the makeability engine with `servings=4`.
* **Then** the system mathematically multiplies all required recipe ingredient volumes by 4.
* **And** evaluates makeability against the inventory using the new scaled requirements.

**UC 3.8: Scaling-Induced "Almost Makeable" Transition**
* **Given** a user has 4oz of Vodka and a Martini requires 2oz per serving.
* **When** they request `servings=1`, the cocktail is **Makeable**.
* **When** they request `servings=3` (requires 6oz total), the cocktail transitions to **"Almost Makeable"**.
* **Then** the system dynamically recalculates makeability based on scaled requirements.
* **And** provides clear feedback: "Missing 2oz Vodka for 3 servings".
* **And** maintains accurate categorization as inventory changes relative to serving size.

**UC 3.9: Ratio/Part-based Measurements**
* **Given** a cocktail recipe uses "parts" (e.g., 1 part Gin, 1 part Campari).
* **When** the system evaluates makeability without a `totalVolumeMl` parameter.
* **Then** it flags the cocktail as `requiresUserInput` to prompt the user for their desired total volume.

**UC 3.10: Synonym Aggregation for Makeability**
* **Given** a user has 30ml "Triple Sec" and 40ml "Cointreau" (synonyms for Orange Liqueur).
* **And** a recipe requires 60ml "Orange Liqueur".
* **When** makeability is calculated.
* **Then** the engine aggregates the synonyms (70ml total) and marks the drink as Makeable.

**UC 3.11: Makeability with Un-tracked Garnishes**
* **Given** a cocktail requires an optional garnish (e.g., "Mint Sprig").
* **When** the user has the base spirits but lacks the garnish.
* **Then** the cocktail is marked as "Makeable (Missing Garnish)" rather than completely unmakeable.

**UC 3.12: Hierarchical Ingredient Satisfaction**
* **Given** a cocktail requires generic "Whiskey".
* **And** the user has specific "Bourbon".
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
* **And** the user has exactly `1.5 oz` of generic "Rum" (which maps as a hierarchical synonym to both).
* **When** the makeability engine evaluates the cocktail.
* **Then** it accurately sums the *total* required rum (`2 oz`).
* **And** correctly flags the cocktail as "Almost Makeable" (missing 0.5 oz), rather than double-counting the 1.5 oz for both requirements.
* **And** prevents inventory over-allocation across overlapping synonym hierarchies.

**UC 3.19: Handling 0-Volume / Rinse Ingredients**
 * **Given** a "Sazerac" recipe requires an "Absinthe Rinse" (amount: `0` or `null`, unit: `rinse`).
 * **When** the makeability engine checks the user's inventory.
 * **Then** the system requires the user to have Absinthe in their inventory with `quantity >= 3` (the hardcoded micro-deduction amount in `ml`), not just `> 0`.
 * **And** when "Prepared", the system automatically converts the qualitative `rinse` into a hardcoded micro-deduction of `3 ml` via the `UnitConverterService`.
 * **And** mathematically deducts this amount. Because the makeability check verified `quantity >= 3`, this prevents a PostgreSQL `CHECK (quantity >= 0)` constraint violation crash.

**UC 3.20: Fractional Servings / Scaling Down**
* **Given** a cocktail requires `2 oz` of Whiskey, but the user only has `1 oz`.
* **When** the user requests makeability with `servings=0.5`.
* **Then** the math engine divides the requirements (`1 oz` Whiskey).
* **And** flags the cocktail as `Makeable` for a half-portion.

**UC 3.21: Evaluating Makeability for External API Cocktails**
* **Given** TheCocktailDB returns a cocktail with string ingredients like "Light Rum".
* **When** the Aggregator Service processes external cocktails for makeability.
* **Then** it calls `resolveBaseIngredient("Light Rum")` to map the string to a local UUID.
* **And** queries the Redis synonym cache to find canonical ingredient relationships.
* **And** passes the resolved UUIDs to the Makeability Math Engine for calculation.
* **And** caches the string-to-UUID mappings to optimize subsequent evaluations.
* **Clarification on Makeability Sorting:** External API cocktails with unparseable NLP measurements (e.g., "top up", "1 part", "to taste") are excluded from strict makeability percentage sorting (`sort=makeability`). They appear in unified search results but maintain a default position in the sort order, as their makeability score cannot be reliably calculated without precise volume measurements.

**UC 3.22: Aggregating Specific Children to satisfy a Generic Parent**
* **Given** a cocktail requires `4 oz` of generic "Whiskey".
* **And** the user has NO generic "Whiskey" row, but has `2 oz` of "Bourbon" and `2 oz` of "Rye".
* **When** the Makeable Cocktails query runs.
* **Then** the math engine traverses the hierarchy upwards.
* **And** aggregates the children (`2 + 2 = 4`).
* **And** flags the cocktail as Makeable.
* **Note:** This requires hierarchical traversal different from synonym overlapping, as it sums quantities across multiple specific child ingredients.

**UC 3.23: Bounding Part-Based Total Volumes**
* **Given** a user requests makeability or preparation of a part-based cocktail.
* **When** they input a `totalVolumeMl` exceeding `10,000 ml` (10 Liters).
* **Then** the validation pipe rejects the request with `400 Bad Request`.
* **And** prevents integer overflow or massive decimal calculations in the Math Engine.
* **And** provides user-friendly error: "Total volume cannot exceed 10 liters (10,000 ml)."

**UC 3.24: Mass-to-Volume Density Conversion**
* **Given** a recipe requires `50 g` of "Honey" and the user's inventory has `100 ml` of Honey.
* **When** the `UnitConverterService` attempts to validate makeability.
* **Then** it references the `density` column on the Honey ingredient record (e.g., `1.42 g/ml`).
* **And** mathematically calculates that `50 g` equals `35.21 ml`.
* **And** successfully validates that `100 ml >= 35.21 ml` without throwing an `IncompatibleUnitError`.
* **Note:** Requires the `density` column in the INGREDIENTS table to enable mass↔volume conversions.

**UC 3.25: The N+1 Makeability Pagination Problem**
 * **Context:** Cannot paginate in SQL after doing in-memory math for makeability validation.
 * **Given** a user requests `GET /makeable?limit=10&page=1&sort=makeability`.
 * **When** the SQL `HAVING` clause returns 5,000 potentially makeable cocktails.
 * **Then** the Math Engine evaluates cocktails sequentially with a hard cap of 200 iterations (ADR 0008 DoS protection).
 * **And** evaluates until either: (1) `limit` makeable cocktails are found, OR (2) 200 iterations reached.
 * **And** returns partial results if iteration cap reached (may return fewer than `limit` cocktails).
 * **Performance & Security:** Uses offset-based pagination (not cursor-based) because cursor-based pagination is mathematically impossible when relying on dynamically computed in-memory scores without embedding the entire score state into the cursor.
 * **Hard Limits:** Maximum `page=10`, maximum `offset=100` regardless of page/limit combination (ADR 0008).
 * **Future Optimization:** For production-scale deployments, consider PostgreSQL materialized views or stored procedures to move unit conversion logic to database layer, enabling native `LIMIT 10` in SQL rather than in-memory evaluation (see Backend Architecture performance section).