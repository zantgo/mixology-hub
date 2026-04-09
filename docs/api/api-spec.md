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
  - `imageUrl`: Optional, must be valid URL format if provided (string only, no binary uploads)
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

**Headers:**
- `Idempotency-Key`: Optional UUID string to prevent duplicate preparations from network retries. If provided and matches a recent successful preparation, returns the previous response without performing the operation again.

**Request Body (optional):**
```json
{
  "servings": 1,
  "partSize": 30
}
```

**Parameters:**
- `servings`: Optional number of servings (default: 1, min: 1, max: 1000)
- `partSize`: Optional size in ml for part-based recipes (default: 30, min: 1, max: 10000)

**Response (200 OK):**
```json
{
  "message": "Cocktail Mojito prepared successfully!",
  "preparationId": "uuid-of-preparation-log",
  "deductedIngredients": [
    {
      "ingredientId": "rum-uuid",
      "ingredientName": "Rum",
      "amount": 2,
      "unit": "oz",
      "remainingStock": 480
    }
  ]
}
```

**Response (200 OK - Idempotent Replay):**
If the same `Idempotency-Key` is reused within 24 hours:
```json
{
  "message": "Cocktail already prepared with this idempotency key",
  "preparationId": "uuid-of-original-preparation",
  "preparedAt": "2026-04-08T10:30:00.000Z",
  "isReplay": true
}
```

**Headers (Idempotent Response):**
- `X-Idempotent-Replayed`: `true` when returning cached response

**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Not enough stock for ingredient: light rum",
  "details": {
    "ingredient": "light rum",
    "required": 2,
    "available": 1.5,
    "unit": "oz"
  }
}
```

**Error (400 Bad Request - Part Size):**
```json
{
  "statusCode": 400,
  "message": "Part size (50.0 L) exceeds maximum allowed (10.0 L)"
}
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

### 5. User Preferences & Authored Cocktails

#### `GET /users/me/cocktails` (Fetch Authored Custom Cocktails)
Fetches a paginated list of cocktails authored by the authenticated user.

- **Query Parameters:** `limit`, `cursor`
- **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid-of-cocktail",
      "name": "Secret Margarita",
      "instructions": "1. Rim glass with salt...",
      "imageUrl": "https://example.com/margarita.jpg",
      "isPublic": true,
      "source": "local",
      "createdBy": "user-uuid",
      "createdAt": "2026-04-08T10:30:00.000Z"
    }
  ],
  "nextCursor": "2026-04-08T10:30:00.000Z_abc123",
  "hasMore": false,
  "limit": 10
}
```

#### `GET /users/me/preparations` (Get Recent Preparations)
Fetches the user's recent preparation logs, primarily used to populate the "Undo" history UI.

- **Query Parameters:** `limit` (default 10)
- **Response (200 OK):** Array of `PREPARATION_LOGS` objects, including a calculated boolean `can_undo` (true if `created_at` is within the last 15 minutes and `undone` is false).
```json
{
  "data": [
    {
      "id": "prep-uuid-123",
      "cocktail_id": "cocktail-uuid-456",
      "external_cocktail_id": "11000",
      "cocktail_name": "Mojito",
      "servings": 2,
      "deducted_ingredients": [
        {
          "ingredient_id": "rum-uuid",
          "ingredient_name": "Rum",
          "amount": 4,
          "unit": "oz"
        }
      ],
      "created_at": "2026-04-08T10:30:00.000Z",
      "undone": false,
      "can_undo": true
    }
  ],
  "nextCursor": "2026-04-08T10:30:00.000Z_abc123",
  "hasMore": false,
  "limit": 10
}
```

#### `GET /users/me/preferences` (Get User Preferences)
Fetches the authenticated user's preferences (unit system, theme).

- **Response (200 OK):**
```json
{
  "unitSystem": "metric",
  "theme": "system",
  "defaultPartSize": 30,
  "showTutorial": true,
  "enableOfflineMode": true
}
```

#### `PATCH /users/me/preferences` (Update User Preferences)
Updates the authenticated user's preferences.

- **Request Body:**
```json
{
  "unitSystem": "imperial",
  "theme": "dark",
  "defaultPartSize": 50,
  "showTutorial": false,
  "enableOfflineMode": false
}
```

- **Validation:**
  - `unitSystem`: Optional, must be either "metric" or "imperial"
  - `theme`: Optional, must be either "light", "dark", or "system"
  - `defaultPartSize`: Optional, integer between 1 and 10000
  - `showTutorial`: Optional boolean
  - `enableOfflineMode`: Optional boolean

- **Response (200 OK):** Updated preferences object
- **Error (400 Bad Request):** Invalid input data
- **Error (401 Unauthorized):** User not authenticated

#### `POST /offline/sync` (Bulk Offline Queue Sync)
Processes multiple offline operations in a single request to reduce network overhead during reconnection.

**Headers:**
- `Idempotency-Key`: Optional UUID string for the entire batch operation

**Request Body:**
```json
{
  "operations": [
    {
      "type": "prepare_cocktail",
      "cocktailId": "cocktail-uuid-123",
      "servings": 2,
      "timestamp": "2026-04-08T10:30:00.000Z",
      "localId": "local-operation-uuid"
    },
    {
      "type": "add_inventory",
      "ingredientId": "ingredient-uuid-456",
      "quantity": 500,
      "unit": "ml",
      "timestamp": "2026-04-08T10:31:00.000Z",
      "localId": "local-operation-uuid-2"
    },
    {
      "type": "update_preferences",
      "preferences": { "theme": "dark" },
      "timestamp": "2026-04-08T10:32:00.000Z",
      "localId": "local-operation-uuid-3"
    }
  ]
}
```

**Response (207 Multi-Status):**
```json
{
  "results": [
    {
      "localId": "local-operation-uuid",
      "status": "success",
      "serverId": "server-preparation-uuid",
      "timestamp": "2026-04-08T10:30:05.000Z"
    },
    {
      "localId": "local-operation-uuid-2",
      "status": "success",
      "serverId": "server-inventory-uuid",
      "timestamp": "2026-04-08T10:31:05.000Z"
    },
    {
      "localId": "local-operation-uuid-3",
      "status": "conflict",
      "error": "Preferences already updated to this value",
      "resolvedValue": { "theme": "dark" }
    }
  ],
  "summary": {
    "total": 3,
    "success": 2,
    "conflict": 1,
    "failed": 0
  }
}
```

**Error (400 Bad Request):** Invalid operation format or validation failure
**Error (413 Payload Too Large):** Too many operations in single batch (max: 100)
**Error (429 Too Many Requests):** Rate limit exceeded for batch operations

---

### 7. Admin Moderation (Admin Only)

#### `GET /admin/reported-content`
Fetches reported content for moderation review.

**Headers:**
- `Authorization: Bearer <admin-token>`

**Query Parameters:**
- `status`: Filter by status (`pending`, `reviewed`, `resolved`, `dismissed`)
- `type`: Filter by content type (`cocktail`, `comment`, `user`)
- `limit`, `cursor`: Standard pagination

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "report-uuid-123",
      "contentType": "cocktail",
      "contentId": "cocktail-uuid-456",
      "reason": "inappropriate_content",
      "description": "Contains offensive language",
      "reportedBy": "user-uuid-789",
      "reportedAt": "2026-04-08T10:30:00.000Z",
      "status": "pending",
      "contentSnapshot": {
        "name": "Offensive Cocktail Name",
        "createdBy": "author-uuid",
        "createdAt": "2026-04-07T14:20:00.000Z"
      }
    }
  ],
  "nextCursor": "cursor-string",
  "hasMore": true,
  "limit": 20
}
```

#### `POST /admin/reported-content/:id/review`
Updates the status of a reported content item.

**Headers:**
- `Authorization: Bearer <admin-token>`

**Request Body:**
```json
{
  "status": "resolved",
  "action": "hide_content",
  "notes": "Content violates community guidelines",
  "notifyReporter": true,
  "notifyAuthor": true
}
```

**Validation:**
- `status`: Required, must be `reviewed`, `resolved`, or `dismissed`
- `action`: Optional, depends on status (`no_action`, `hide_content`, `warn_author`, `suspend_author`, `delete_content`)
- `notes`: Optional string for internal documentation
- `notifyReporter`: Optional boolean (default: false)
- `notifyAuthor`: Optional boolean (default: false)

**Response (200 OK):**
```json
{
  "id": "report-uuid-123",
  "status": "resolved",
  "action": "hide_content",
  "resolvedAt": "2026-04-08T11:30:00.000Z",
  "resolvedBy": "admin-uuid",
  "contentStatus": "hidden",
  "notificationsSent": {
    "reporter": true,
    "author": true
  }
}
```

**Error (401 Unauthorized):** Not an admin user
**Error (404 Not Found):** Report not found
**Error (409 Conflict):** Report already resolved

---

### 8. Authentication

#### `POST /auth/register`
- **Request Body:** `{ "email": "...", "password": "..." }`
- **Response (201):** User object (without password hash).

#### `POST /auth/login`
- **Request Body:** `{ "email": "...", "password": "..." }`
- **Response (200):** `{ "accessToken": "jwt..." }`
- **Headers:** `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict`

#### `POST /auth/refresh`
- **Headers:** Requires the `refreshToken` HttpOnly cookie.
- **Response (200):** `{ "accessToken": "new_jwt..." }` (and sets a newly rotated `refreshToken` cookie).

#### `POST /auth/logout`
- **Response (200):** Clears the HttpOnly cookie and updates `last_logout_timestamp` in the DB.

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
