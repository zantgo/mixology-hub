# Features Deep-Dive

  

MixologyHub is designed as a feature-rich platform that balances automated recipe discovery with manual inventory management. This document outlines the key functional capabilities and the business logic behind them.

  

---

  

## 1. 🍹 Smart Cocktail Discovery

The platform handles two types of cocktail recipes: **Local** and **Public/External**.

- **Unified Search:** Users don't need to know where a recipe comes from. Our aggregator service merges local database content with the global *TheCocktailDB* repository.

- **Filtering Logic:** Search results are filterable by name or availability (makeable vs. missing ingredients).

- **Public vs. Private:** Users can create their own private recipes or "save" recipes from the public repository into their personal favorites list for quick access.

  

## 2. 🧠 AI-Driven Bartender (Generative Recipes)

The AI Bartender is the core "delighter" feature of MixologyHub.

- **Context-Aware Generation:** Unlike a static database, the AI can invent new, creative cocktails based on limited ingredients provided by the user.

- **Workflow:**

1. **Input:** User submits a list of ingredients (e.g., "Gin, Cucumber, Lime").

2. **Prompting:** The backend dynamically constructs a prompt and sends it to the configured LLM (e.g., DeepSeek) via an environment-variable-defined endpoint.

3. **Persistence:** The generated JSON recipe is stored temporarily in `ai_generated_recipes`. If the user likes the result, they can call `save-as-cocktail`, which triggers an atomic database transaction to map the LLM’s JSON output into the permanent `Cocktails` and `Cocktail_Ingredients` relational tables.

  

## 3. 📦 Inventory & "Makeable" Intelligence

The system doesn't just list cocktails; it analyzes your stock to tell you what you can actually prepare.

  

### The "Makeable" Algorithm:

1. **Fetch:** Get all local recipes and the bar's current `BarInventory` (Ingredients + Quantities).

2. **Filter (SQL):** Use a `HAVING` clause to discard any recipes where the user lacks any of the required ingredients.

3. **Validate (Math Engine):** For recipes that pass the initial filter, the system uses the `UnitConverterService` to perform granular checks:

- *Example:* If a recipe requires `1 oz` of syrup and the user has `50 ml` of syrup, the converter maps both to a base unit (`ml`) to determine if `29.57ml <= 50ml`.

4. **Outcome:** The user sees a list of cocktails they can "Prepare" immediately.

  

## 4. 📝 Recipe Creation (Dynamic Forms)

Users can craft their own recipes using an interactive form:

- **Dynamic Fields:** Using Angular's `FormArray`, users can add or remove an unlimited number of ingredients per cocktail.

- **Validation & Parsing:** Every ingredient row captures a human-readable `measure` (e.g., "1 1/2 oz") which is automatically parsed into `amount` (1.5) and `unit` ("oz") for mathematical operations. The backend uses a `MeasureParserService` to handle fractions ("3/4"), mixed numbers ("1 1/2"), decimals ("0.5"), and qualitative measures ("a pinch").

  

## 5. ⚡ Performance & Caching

- **API Throughput:** We acknowledge that public APIs like *TheCocktailDB* have rate limits and latency issues. By implementing **Redis caching**, we ensure that repeat searches for the same cocktail return results in sub-10ms time without hitting the external provider.

- **State Management:** The frontend uses **Angular Signals** for reactive UI updates. When a bartender clicks "Prepare", the order is enqueued to BullMQ (202 Accepted), and the UI polls the status endpoint until the worker confirms completion.

- **Inventory Management:** The Admin-only inventory page allows bar managers to add, update, and delete stock in the shared `bar_inventory`. All bartenders see the same inventory levels via the global bar inventory view.

  

---

  

## 🚀 Roadmap (Future Improvements)

While the current version is production-ready, we have identified these features for future iterations:

  

- [ ] **Social Sharing:** Allow users to make their custom recipes "Public" so others can discover and favorite them.

- [ ] **Barcode Scanner:** Implement a mobile web feature using `ZXing` to scan ingredient barcodes to add them to inventory automatically.

- [ ] **Shopping List:** Automatically generate a shopping list for "near-miss" cocktails (recipes where the user is missing only 1 or 2 ingredients).

- [ ] **Nutritional Analysis:** Integration with an AI endpoint to calculate approximate calories and ABV (Alcohol By Volume) for custom recipes.

- [ ] **Multi-user Collaboration:** Add "Bar Teams" so multiple users can share a single virtual inventory (useful for housemates or small bars).
