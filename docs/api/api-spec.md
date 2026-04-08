```markdown
# REST API Specification

The MixologyHub backend exposes a strictly typed, RESTful API built with NestJS. The API enforces strict input validation, standardizes response formats, and is fully documented via **OpenAPI (Swagger)**.

## 📖 Swagger UI (Interactive Documentation)

When the backend is running, an interactive Swagger interface is automatically generated from the application's decorators and DTOs. 

- **Local URL:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

You can use this interface to explore all endpoints, view schema models, and execute requests directly from the browser.

---

## 🛡️ Global API Standards

1. **Strict Validation:** All endpoints use NestJS's `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. If a client sends an undocumented field, the API will automatically reject the request with a `400 Bad Request`, protecting against mass-assignment attacks.
2. **Standardized Pagination:** Any endpoint returning a list accepts a standard `PaginationQueryDto` containing `limit` (default: 10) and `offset` (default: 0).
3. **Response Envelope:** Paginated endpoints return data in a standard envelope:
   ```json
   {
     "data": [],
     "total": 100,
     "limit": 10,
     "offset": 0
   }
   ```

---

## 🍹 Core Endpoints Reference

### 1. Cocktails

#### `GET /cocktails` (Unified Search)
Fetches a paginated list of cocktails. If the `name` query parameter is provided, the API triggers the **CocktailAggregatorService** to seamlessly blend local DB recipes with external recipes from TheCocktailDB.

- **Query Parameters:** `limit`, `offset`, `name` (optional)
- **Response (200 OK):**
  ```json
  {
    "data": [
      {
        "id": "11000",
        "name": "Mojito",
        "source": "api",
        "is_public": true,
        "ingredients": [
          { "measure": "2 oz", "ingredient": { "name": "light rum" } }
        ]
      }
    ],
    "total": 1
  }
  ```

#### `POST /cocktails/:id/prepare`
Calculates required ingredient amounts, mathematically converts units to match the user's inventory, and deducts the stock within an ACID-compliant database transaction.

- **Response (200 OK):**
  ```json
  { "message": "Cocktail Mojito prepared successfully!" }
  ```
- **Error (400 Bad Request):**
  ```json
  { "statusCode": 400, "message": "Not enough stock for ingredient: light rum" }
  ```

---

### 2. User Inventory & Algorithm

#### `GET /user-inventory/makeable`
The core business logic endpoint. Evaluates the user's current inventory against all local cocktail recipes. Uses a complex SQL `HAVING` clause to find recipes where the user owns all required ingredients, followed by mathematical quantity validation.

- **Query Parameters:** `limit`, `offset`
- **Response (200 OK):** List of fully prepare-able `Cocktail` objects.

#### `POST /user-inventory`
Adds or updates an ingredient in the user's inventory. Uses an `UPSERT` pattern (updates quantity if the ingredient already exists).

- **Request Body:**
  ```json
  {
    "ingredientId": "uuid-string",
    "quantity": 500,
    "unit": "ml"
  }
  ```

---

### 3. AI Generative Models

#### `POST /ai`
Triggers the agnostic LLM integration to generate a new cocktail recipe.

- **Request Body:**
  ```json
  {
    "ingredients": ["dark rum", "pineapple juice", "coconut cream"]
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": "uuid-string",
    "prompt": "Ingredients: dark rum, pineapple juice, coconut cream",
    "generated_recipe": {
      "name": "Tropical Midnight",
      "ingredients": [
        { "name": "dark rum", "measure": "2 oz" },
        { "name": "pineapple juice", "measure": "3 oz" }
      ],
      "instructions": "Shake with ice and strain into a chilled glass."
    }
  }
  ```

#### `POST /ai/:id/save-as-cocktail`
Transforms a transient JSON AI recipe into persistent relational database entities (`Cocktail`, `CocktailIngredient`, `Ingredient`).

- **Request Body:**
  ```json
  {
    "name": "My Custom Tropical Midnight"
  }
  ```

---

### 4. Ingredients & Favorites
Standard CRUD endpoints utilizing REST conventions:
- `GET /ingredients` - Fetch global ingredient catalog.
- `POST /ingredients` - Create a new base ingredient.
- `GET /favorites` - Fetch user's saved drinks.
- `POST /favorites` - Save a cocktail (supports local `cocktailId` or public `externalCocktailId`).
- `DELETE /favorites/:id` - Remove a saved drink.

```