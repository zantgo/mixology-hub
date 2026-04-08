# REST API Specification

  

The MixologyHub backend exposes a strictly typed, RESTful API built with NestJS. The API enforces strict input validation, standardizes response formats, and is fully documented via **OpenAPI (Swagger)**.

  

## 📖 Swagger UI (Interactive Documentation)

  

When the backend is running, an interactive Swagger interface is automatically generated from the application's decorators and DTOs.

  

- **Local URL:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

  

You can use this interface to explore all endpoints, view schema models, and execute requests directly from the browser.

  

---

  

## 🛡️ Global API Standards

  

1. **Strict Validation:** All endpoints use NestJS's `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. If a client sends an undocumented field, the API will automatically reject the request with a `400 Bad Request`, protecting against mass-assignment attacks.

2. **Standardized Pagination:** All list endpoints use cursor-based pagination for performance and consistency.

   **Parameters:**
   - `limit` (default: 10, max: 100): Number of items per page. Any value outside the 1-100 range returns a `400 Bad Request`.
   - `cursor` (optional): Opaque cursor string for pagination
   
   **Benefits:**
   - Prevents UI duplication when new items are added during pagination
   - More performant for large datasets (avoids OFFSET performance issues)
   - Consistent ordering across pagination requests
   - Deterministic results for infinite scroll implementations

3. **Standardized Error Response:** All error responses (4xx and 5xx) follow a consistent envelope structure to simplify frontend error handling.

   **Example (400 Bad Request):**
   ```json
   {
     "statusCode": 400,
     "message": "Not enough stock for ingredient: light rum",
     "error": "Bad Request",
     "timestamp": "2026-04-08T10:30:00.000Z",
     "path": "/cocktails/123/prepare"
   }
   ```

4. **Response Envelope:** Paginated endpoints return data in a standard cursor-based envelope:

```json
{
  "data": [],
  "nextCursor": "abc123_uuid_or_timestamp",
  "hasMore": true,
  "limit": 10
}
```

**Implementation notes:**
- Use `created_at` timestamp concatenated with `id` for deterministic ordering (e.g., `2026-04-08T10:30:00.000Z_uuid`)
- The `nextCursor` is the value to use in the next request's `cursor` parameter
- When `hasMore` is `false`, the client has reached the end of results
- Always order by `created_at DESC, id DESC` for consistent pagination
- Cursor is opaque to clients - they should treat it as an arbitrary string

5. **Rate Limiting:** Rate-limited endpoints return standard HTTP headers for client-side handling:

   **Headers:**
   - `X-RateLimit-Limit`: Maximum requests allowed in the time window
   - `X-RateLimit-Remaining`: Remaining requests in current window
   - `X-RateLimit-Reset`: Unix timestamp when the rate limit resets (seconds)
   - `Retry-After`: Seconds to wait before retrying (when rate limited)

   **Example (429 Too Many Requests):**
   ```http
   HTTP/1.1 429 Too Many Requests
   X-RateLimit-Limit: 100
   X-RateLimit-Remaining: 0
   X-RateLimit-Reset: 1736341200
   Retry-After: 60
   Content-Type: application/json
   
   {
     "statusCode": 429,
     "message": "Rate limit exceeded. Please wait 60 seconds.",
     "error": "Too Many Requests"
   }
   ```

   **Frontend Integration:** The Angular frontend reads these headers to display user-friendly messages like "Please wait X seconds before trying again."

6. **Query Parameter Validation:** All query parameters are strictly validated:
   - `limit` must be an integer between 1 and 100
   - `page` (when used) must be a positive integer
   - Boolean parameters (`?is_active=true`) accept `true`, `false`, `1`, `0`
   - Invalid parameters return `400 Bad Request` with specific validation messages

  

---

  

## 🍹 Core Endpoints Reference

  

### 1. Cocktails

  

#### `GET /cocktails` (Unified Search)

Fetches a paginated list of cocktails. If the `name` query parameter is provided, the API triggers the **CocktailAggregatorService** to seamlessly blend local DB recipes with external recipes from TheCocktailDB.

  

- **Query Parameters:** 
  - `limit`: Number of items per page (default: 10, max: 100)
  - `cursor`: Opaque cursor for pagination
  - `name`: Search query (optional)
  - `sort`: Sorting strategy (optional, default: `relevance`, options: `relevance`, `makeability`)
    - `relevance`: Default sorting based on search relevance
    - `makeability`: Sorts by makeability status (makeable → missing 1 ingredient → unmakeable)

- **Response (200 OK):**

```json

{

"data": [

 {
 
 "id": "11000",
 
 "name": "Mojito",
 
 "imageUrl": "https://www.thecocktaildb.com/images/media/drink/metwgh1606770327.jpg",
 
 "source": "api",
 
 "is_public": true,
 
 "ingredients": [
 
 { "measure": "2 oz", "ingredient": { "name": "light rum" } }
 
 ]
 
 }

 ],
 
"nextCursor": "2026-04-08T10:30:00.000Z_abc123",
"hasMore": false,
"limit": 10
 
  }
 
 ```

#### `POST /cocktails` (Create Custom Cocktail)

Creates a new custom cocktail recipe. The cocktail is automatically linked to the authenticated user as the creator.

- **Request Body:**
```json
{
  "name": "Secret Margarita",
  "instructions": "1. Rim glass with salt...",
  "imageUrl": "https://example.com/margarita.jpg",
  "isPublic": true,
  "ingredients": [
    {
      "ingredientId": "uuid-of-tequila",
      "measure": "2 oz",
      "amount": 2,
      "unit": "oz"
    }
  ]
}
```

- **Validation:**
  - `name`: Required, string, max 100 chars
  - `instructions`: Required, string
  - `imageUrl`: Optional, must be valid URL format if provided
  - `isPublic`: Optional boolean (default: true)
  - `ingredients`: Required array with at least 1 ingredient

- **Response (201 Created):**
```json
{
  "id": "uuid-of-new-cocktail",
  "name": "Secret Margarita",
  "instructions": "1. Rim glass with salt...",
  "imageUrl": "https://example.com/margarita.jpg",
  "isPublic": true,
  "source": "local",
  "createdBy": "user-uuid",
  "createdAt": "2026-04-08T10:30:00.000Z"
}
```

- **Error (400 Bad Request):** Invalid input data or invalid image URL format
- **Error (401 Unauthorized):** User not authenticated

#### `GET /cocktails/:id` (Get Cocktail Details)

Fetches detailed information for a specific cocktail, including full ingredient details.

- **Response (200 OK):**
```json
{
  "id": "uuid-of-cocktail",
  "name": "Secret Margarita",
  "instructions": "1. Rim glass with salt...",
  "imageUrl": "https://example.com/margarita.jpg",
  "isPublic": true,
  "source": "local",
  "createdBy": "user-uuid",
  "createdAt": "2026-04-08T10:30:00.000Z",
  "ingredients": [
    {
      "id": "uuid-of-cocktail-ingredient",
      "measure": "2 oz",
      "amount": 2,
      "unit": "oz",
      "ingredient": {
        "id": "uuid-of-tequila",
        "name": "Tequila",
        "category": "spirit"
      }
    }
  ]
}
```

- **Error (404 Not Found):** Cocktail not found

#### `PUT /cocktails/:id` (Update Custom Cocktail)

Updates an existing custom cocktail. Only the original creator can update their cocktail.

- **Request Body:** Same structure as `POST /cocktails` (all fields optional except at least one must be provided)
- **Response (200 OK):** Updated cocktail object
- **Error (400 Bad Request):** Invalid input data or invalid image URL format
- **Error (401 Unauthorized):** User not authenticated
- **Error (403 Forbidden):** User is not the original creator
- **Error (404 Not Found):** Cocktail not found

#### `DELETE /cocktails/:id` (Delete Custom Cocktail)

Deletes a custom cocktail. Only the original creator can delete their cocktail.

- **Response (204 No Content):** Successful deletion
- **Error (401 Unauthorized):** User not authenticated
- **Error (403 Forbidden):** User is not the original creator
- **Error (404 Not Found):** Cocktail not found

   

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

  

- **Query Parameters:** `limit`, `cursor`

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

---

## 📄 Pagination Implementation Guide

### Cursor-based Pagination (Production Recommended)

For production applications with real-time data updates, cursor-based pagination prevents the "skip/offset" problem where new items added during pagination cause duplicates or missed items.

**Request Format:**
```
GET /cocktails?limit=20&cursor=abc123_uuid
```

**Implementation Pattern:**
```typescript
// Entity must have created_at and id for deterministic ordering
@Entity()
export class Cocktail {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @CreateDateColumn()
  createdAt: Date;
  
  // ... other fields
}

// Service method for cursor-based pagination
async findAll(limit: number, cursor?: string): Promise<PaginatedResponse<Cocktail>> {
  const queryBuilder = this.cocktailRepository.createQueryBuilder('cocktail');
  
  // Apply cursor filter if provided
  if (cursor) {
    // Parse cursor (could be timestamp or UUID)
    const [cursorTimestamp, cursorId] = this.parseCursor(cursor);
    
    queryBuilder.where(
      '(cocktail.createdAt < :cursorTimestamp OR (cocktail.createdAt = :cursorTimestamp AND cocktail.id < :cursorId))',
      { cursorTimestamp, cursorId }
    );
  }
  
  // Always order consistently
  queryBuilder
    .orderBy('cocktail.createdAt', 'DESC')
    .addOrderBy('cocktail.id', 'DESC')
    .limit(limit + 1); // Fetch one extra to determine hasMore
  
  const results = await queryBuilder.getMany();
  
  // Check if there are more results
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, -1) : results;
  
  // Generate next cursor from last item
  let nextCursor = null;
  if (hasMore && data.length > 0) {
    const lastItem = data[data.length - 1];
    nextCursor = this.createCursor(lastItem.createdAt, lastItem.id);
  }
  
  return {
    data,
    nextCursor,
    hasMore,
    limit
  };
}

// Cursor encoding/decoding utilities
private createCursor(timestamp: Date, id: string): string {
  return `${timestamp.toISOString()}_${id}`;
}

private parseCursor(cursor: string): [Date, string] {
  const [timestampStr, id] = cursor.split('_');
  return [new Date(timestampStr), id];
}
```

**Benefits:**
- ✅ No duplicates when new items are added during pagination
- ✅ Consistent ordering across all pages
- ✅ Better performance for deep pagination (no OFFSET clause)
- ✅ Works well with infinite scroll UI patterns

**Implementation Status:**
- Cursor-based pagination is implemented from the start for all list endpoints
- Frontend components are designed to work with cursor-based pagination
- No offset-based pagination support to maintain API consistency

---

## ❌ Global Error Response Reference

All endpoints return errors in the format shown above. The `message` field contains a human-readable description, while `error` provides the standard HTTP reason phrase. Validation errors (e.g., from `class-validator`) will additionally include an array of validation failure details.

**Common HTTP Status Codes:**
- `400 Bad Request` – Invalid input (e.g., insufficient stock, malformed JSON).
- `401 Unauthorized` – Missing or invalid authentication token (Phase 1+).
- `403 Forbidden` – Authenticated but lacking permission.
- `404 Not Found` – Requested resource does not exist.
- `409 Conflict` – Duplicate resource (e.g., ingredient already in catalog).
- `500 Internal Server Error` – Unexpected server-side failure (logged via global exception filter).
