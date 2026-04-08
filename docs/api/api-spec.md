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
   - `limit` (default: 10, max: 100): Number of items per page
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

  

---

  

## 🍹 Core Endpoints Reference

  

### 1. Cocktails

  

#### `GET /cocktails` (Unified Search)

Fetches a paginated list of cocktails. If the `name` query parameter is provided, the API triggers the **CocktailAggregatorService** to seamlessly blend local DB recipes with external recipes from TheCocktailDB.

  

- **Query Parameters:** `limit`, `cursor`, `name` (optional)

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
 
"nextCursor": "2026-04-08T10:30:00.000Z_abc123",
"hasMore": false,
"limit": 10
 
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
