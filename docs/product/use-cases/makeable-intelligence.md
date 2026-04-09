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

**UC 3.6: Discovering "Almost Makeable" (Missing 1 Ingredient)**
* **Given** the user has Tequila and Triple Sec, but no Lime.
* **When** the Makeable Cocktails query runs.
* **Then** the system identifies "Margarita".
* **And** tags it as `missing_ingredients: ["Lime"]`.
* **And** returns it in a separate "Almost Makeable" category to drive user engagement/shopping.

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

**UC 3.13: Recursive Hierarchy/Synonym Infinite Loop Prevention**
* **Given** the ingredient database has a circular reference: `Bourbon → Whiskey → Bourbon`.
* **When** the `IngredientService.resolveHierarchy()` method is called for Bourbon.
* **Then** the method tracks visited nodes to detect circular references.
* **And** throws a `CircularReferenceError` or safely breaks the loop.
* **And** prevents stack overflow or infinite loops during makeability calculations.
* **And** logs the circular reference for database cleanup.

**UC 3.14: Deducting from overlapping synonym inventories**
* **Given** a recipe requires `1 oz Light Rum` AND `1 oz Dark Rum`.
* **And** the user has exactly `1.5 oz` of generic "Rum" (which maps as a hierarchical synonym to both).
* **When** the makeability engine evaluates the cocktail.
* **Then** it accurately sums the *total* required rum (`2 oz`).
* **And** correctly flags the cocktail as "Almost Makeable" (missing 0.5 oz), rather than double-counting the 1.5 oz for both requirements.
* **And** prevents inventory over-allocation across overlapping synonym hierarchies.

**UC 3.15: Handling 0-Volume / Rinse Ingredients**
* **Given** a "Sazerac" recipe requires an "Absinthe Rinse" (amount: `0` or `null`, unit: `rinse`).
* **When** the makeability engine checks the user's inventory.
* **Then** the system requires the user to have Absinthe in their inventory (quantity > 0).
* **And** when "Prepared", the system does **not** deduct any volume for the Absinthe, but leaves the inventory untouched while deducting the primary spirits.
* **And** marks rinse ingredients as "qualitative" rather than "quantitative" for inventory tracking purposes.

**UC 3.16: Fractional Servings / Scaling Down**
* **Given** a cocktail requires `2 oz` of Whiskey, but the user only has `1 oz`.
* **When** the user requests makeability with `servings=0.5`.
* **Then** the math engine divides the requirements (`1 oz` Whiskey).
* **And** flags the cocktail as `Makeable` for a half-portion.