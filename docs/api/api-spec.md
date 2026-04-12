# REST API Specification

  

The MixologyHub backend exposes a strictly typed, RESTful API built with NestJS. The API enforces strict input validation, standardizes response formats, and is fully documented via **OpenAPI (Swagger)**.

  

## 📖 Swagger UI (Interactive Documentation)

  

When the backend is running, an interactive Swagger interface is automatically generated from the application's decorators and DTOs.

  

- **Local URL:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

  

You can use this interface to explore all endpoints, view schema models, and execute requests directly from the browser.

  

---

  

## 🛡️ Global API Standards

  

1. **Strict Validation:** All endpoints use NestJS's `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. If a client sends an undocumented field, the API will automatically reject the request with a `400 Bad Request`, protecting against mass-assignment attacks.

2. **Standardized Pagination:** All list endpoints use traditional page/limit pagination for simplicity and consistency. To prevent deep pagination performance issues, page numbers are capped at 100.

    **Page-based Pagination (Standard):**
    - `limit` (default: 10, max: 100): Number of items per page
    - `page` (default: 1, max: 100): Page number (1-indexed)
   
   **Benefits:**
   - Simple and intuitive API for clients
   - Consistent implementation across all endpoints
   - Easy to implement pagination UI with page numbers
   - Predictable performance with page number caps
   - Compatible with traditional database queries using OFFSET/LIMIT

   **Security Considerations:**
   - Page number is capped at 100 to prevent deep pagination DoS attacks
   - Users can browse up to 1,000 results (100 pages × 10 items per page)
   - For deeper results, users must use search filters
   - `page` (optional, default: 1): Page number for offset calculation
   
    **Trade-off:** When sorting by dynamically calculated fields (makeability, rating), page-based pagination is used with strict page number limits to prevent performance degradation. For MVP simplicity, we accept offset-based pagination for these specific endpoints, acknowledging the potential for duplicates if data changes during pagination.

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

4. **Response Envelope:** Paginated endpoints return data in a standard page-based envelope:

```json
{
  "data": [],
  "meta": {
    "currentPage": 1,
    "nextPage": 2,
    "itemsPerPage": 10,
    "totalItems": 150,
    "totalPages": 15
  }
}
```

**Implementation notes:**
- `currentPage`: The current page number (1-indexed)
- `nextPage`: The next page number, or `null` if this is the last page
- `itemsPerPage`: Number of items per page (matches the `limit` parameter)
- `totalItems`: Total number of items across all pages
- `totalPages`: Total number of pages available
- When `nextPage` is `null`, the client has reached the end of results
- Always include proper ordering (e.g., `created_at DESC, id DESC`) for consistent pagination

 5. **Simple Request Handling:** All POST, PUT, PATCH, and DELETE endpoints process requests directly without complex idempotency mechanisms. In the MVP, duplicate requests from network retries or double-clicks may result in duplicate operations that users must manually correct.

 6. **Rate Limiting:** Rate-limited endpoints return standard HTTP headers for client-side handling:

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

**Architectural Decision: Asymmetric Catalog Browsing (External API Dropping)**
**Explicit Trade-off:** Because third-party REST APIs like TheCocktailDB require strict search parameters and do not natively support unbounded, paginated catalog browsing, an architectural asymmetry exists. We explicitly mandate that if a client calls GET /cocktails without providing a name search query, the CocktailAggregatorService MUST silently drop the external API query entirely and return ONLY paginated results from the Local PostgreSQL Database. We trade external catalog browsing comprehensiveness for 3rd-party API compatibility and adherence to external rate limits.

  
- **Query Parameters:** 
  - `limit`: Number of items per page (default: 10, max: 100)
  - `page`: Page number (default: 1, max: 100)
  - `name`: Search query (optional)
  - `sort`: Sorting strategy (optional, default: `relevance`, options: `relevance`, `makeability`, `rating`)
    - `relevance`: Default sorting based on search relevance
    - `makeability`: Sorts by makeability status (makeable → missing 1 ingredient → unmakeable)
    - `rating`: Sorts by rating (highest to lowest)
      - **Architectural Decision: External API Sorting Exclusion for Makeability**
      - **Explicit Trade-off:** When users apply `sort=makeability`, external API cocktails require expensive on-the-fly NLP trigram resolution to map string measurements to local UUIDs (UC 3.21), creating a severe CPU and Database bottleneck. We explicitly dictate that when `sort=makeability` is applied to Unified Search, the CocktailAggregatorService will automatically drop all External API results, returning ONLY Local Database cocktails. We trade search comprehensiveness for guaranteed server stability under heavy Math/NLP loads.
      - **Note:** For other sort types (`rating`, `relevance`), external API results are included with appropriate default values.

- **Response (200 OK):**

```json

{

"data": [

  {
  
  "id": "11000",
  
  "name": "Mojito",
  
    "imageFull": null,
    "imageThumb": null,
  
  "source": "api",
  
   "isPublic": true,
  
  "ingredients": [
  
  { "measure": "2 oz", "ingredient": { "name": "light rum" } }
  
  ]
  
  }

 ],
  
 "meta": {
    "currentPage": 1,
    "nextPage": null,
    "itemsPerPage": 10,
    "totalItems": 1,
    "totalPages": 1
  }
  
   }
 
 ```

#### `POST /cocktails` (Create Custom Cocktail)

Creates a new custom cocktail recipe. The cocktail is automatically linked to the authenticated user as the creator.

- **Content-Type:** `multipart/form-data`
- **Request Body (Form Data):**
  - `name`: "Secret Margarita"
  - `instructions`: "1. Rim glass with salt..."
  - `isPublic`: "true"
  - `ingredients`: (JSON stringified array) `[{"ingredientId": "uuid...", "measure": "2 oz", "amount": "2", "unit": "oz"}]`
  - `image`: (File) The actual image file (JPG, PNG, WebP)

- **Validation:**
  - `name`: Required, string, max 100 chars
  - `instructions`: Required, string
  - `image`: Optional. Max 2MB. Enforced by Multer `FileInterceptor`. Must be `image/jpeg`, `image/png`, or `image/webp`.
  - `isPublic`: Optional boolean (default: true)
  - `ingredients`: Required array with at least 1 ingredient.

- **Response (201 Created):**
```json
{
  "id": "uuid-of-new-cocktail",
  "name": "Secret Margarita",
  "instructions": "1. Rim glass with salt...",
  "imageFull": "/uploads/cocktails/uuid-full.webp",
  "imageThumb": "/uploads/cocktails/uuid-thumb.webp",
  "isPublic": true,
  "source": "local",
  "createdBy": "user-uuid",
  "createdAt": "2026-04-08T10:30:00.000Z"
}
```

- **Error (400 Bad Request):** Invalid input data or invalid image file format/size (e.g., >2MB or non-image MIME type)
- **Error (401 Unauthorized):** User not authenticated

#### `GET /cocktails/:id` (Get Cocktail Details)

Fetches detailed information for a specific cocktail, including full ingredient details.

- **Response (200 OK):**
```json
{
  "id": "uuid-of-cocktail",
  "name": "Secret Margarita",
  "instructions": "1. Rim glass with salt...",
  "imageFull": "/uploads/cocktails/uuid-full.webp",
  "imageThumb": "/uploads/cocktails/uuid-thumb.webp",
  "isPublic": true,
  "source": "local",
  "createdBy": "user-uuid",
  "createdAt": "2026-04-08T10:30:00.000Z",
  "ingredients": [
    {
      "id": "uuid-of-cocktail-ingredient",
      "measure": "2 oz",
      "amount": "2",
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

#### `PUT /cocktails/:id` (Update or Fork Custom Cocktail)

Updates an existing custom cocktail. If the user is the original creator, the cocktail is updated in place. If the cocktail belongs to an external API (`source: 'api'`) or another user, the system automatically **forks** the recipe into a new local copy owned by the requesting user.

- **Request Body:** Same structure as `POST /cocktails` (all fields optional except at least one must be provided)
- **Response (200 OK):** Updated cocktail object (if owner)
- **Response (201 Created):** New forked cocktail object with a new UUID (if not owner)
- **Error (400 Bad Request):** Invalid input data or invalid image file format/size (e.g., >2MB or non-image MIME type)
- **Error (401 Unauthorized):** User not authenticated
- **Error (404 Not Found):** Cocktail not found

#### `DELETE /cocktails/:id` (Delete Custom Cocktail)

Deletes a custom cocktail. Only the original creator can delete their cocktail.

- **Response (204 No Content):** Successful deletion
- **Error (401 Unauthorized):** User not authenticated
- **Error (403 Forbidden):** User is not the original creator
- **Error (404 Not Found):** Cocktail not found

   
    
#### `POST /cocktails/:id/prepare`

Calculates required ingredient amounts, mathematically converts units to match the user's inventory, and deducts the stock within an ACID-compliant database transaction.

**Request Body (optional):**
```json
{
  "servings": 1,
  "totalVolumeMl": "120.00"
}
```

**Parameters:**
- `servings`: Optional number of servings (default: 1, min: 1, max: 1000)
- `totalVolumeMl`: Optional total volume in ml for part-based recipes, serialized as a string to preserve decimal precision (no default, min: "1", max: "10000")

**Architectural Decision: Volume-Over-Servings Precedence for Part-Based Math**
**Explicit Trade-off:** To resolve mathematical ambiguity during API requests, we dictate that if a recipe uses ratio/parts, the `totalVolumeMl` parameter represents the **absolute total yield** of the transaction. If `servings` is also provided, it is treated strictly as analytical metadata (stored in `PREPARATION_LOGS` for user history) and is mathematically ignored during inventory deduction. We trade dynamic per-serving multiplication on part-based drinks for strict, predictable total-volume deductions.

**Architectural Decision: Volume Scaling Exclusivity for Part-Based Recipes**
**Explicit Trade-off:** We explicitly restrict the `totalVolumeMl` parameter exclusively to part/ratio-based cocktails. If a client passes `totalVolumeMl` to a fixed-unit recipe (e.g., standard ounces or ml), the backend will entirely ignore the volume request and scale strictly using the `servings` multiplier integer. We trade the flexibility of "make exactly 500ml of Margarita" for rigid, predictable mathematical integrity of classic culinary ratios.

**Response (200 OK):**
```json
{
  "message": "Cocktail Mojito prepared successfully!",
  "preparationId": "uuid-of-preparation-log",
  "deductedIngredients": [
    {
      "ingredientId": "rum-uuid",
      "ingredientName": "Rum",
      "amount": "2",
      "unit": "oz",
      "remainingStock": "480"
    }
  ]
}
```



**Error (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Not enough stock for ingredient: light rum",
  "error": "Bad Request",
  "timestamp": "2026-04-08T10:30:00.000Z",
  "path": "/cocktails/123/prepare",
  "details": {
    "ingredient": "light rum",
    "required": "2",
    "available": "1.5",
    "unit": "oz"
  }
}
```

**Error (400 Bad Request - Total Volume):**
```json
{
  "statusCode": 400,
  "message": "Total volume (50.0 L) exceeds maximum allowed (10.0 L)",
  "error": "Bad Request",
  "timestamp": "2026-04-08T10:30:00.000Z",
  "path": "/cocktails/123/prepare"
}
```

  

---

  

### 2. User Inventory & Algorithm

  

#### `GET /user-inventory/makeable`

The core business logic endpoint. Evaluates the user's current inventory against all local cocktail recipes. Uses a complex SQL `HAVING` clause to find recipes where the user owns all required ingredients, followed by mathematical quantity validation.

  

- **Query Parameters:** `limit`, `page`

- **Response (200 OK):** List of fully prepare-able `Cocktail` objects with pagination metadata.

  

#### `POST /user-inventory`

Adds or updates an ingredient in the user's inventory. Uses an `UPSERT` pattern (updates quantity if the ingredient already exists).

  

 - **Request Body:**

```json

{

"ingredientId": "uuid-string",

"quantity": "500",

 "unit": "ml", // Must match INGREDIENTS.baseUnit for the given ingredientId

 "sourceCocktailId": "uuid-string" // Optional: allows adding private ingredients from public recipes (UC 10.8)

 }

 - **Response (200 OK):**
 ```json
 {
   "id": "uuid-string",
   "ingredientId": "uuid-string",
   "quantity": "500",
   "unit": "ml", // Derived from INGREDIENTS.baseUnit via JOIN
   "ingredient": {
     "id": "uuid-string",
     "name": "Vodka",
     "category": "spirit",
     "baseUnit": "ml"
   }
  }
  ```

#### `POST /user-inventory/bulk` (Bulk Add Inventory Items)
Adds or updates multiple ingredients in the user's inventory within a single all-or-nothing transaction.

- **Request Body:**
```json
[
  {
    "ingredientId": "uuid-string-1",
    "quantity": "500",
    "unit": "ml"
  },
  {
    "ingredientId": "uuid-string-2", 
    "quantity": "2",
    "unit": "oz"
  }
]
```

- **Validation:**
  - Array must contain 1-100 items
  - Each item must have valid `ingredientId`, `quantity` (positive number), and `unit` matching the ingredient's base unit
  - All items validated before any database operations

- **Response (200 OK):**
```json
{
  "success": true,
  "added": 2,
  "updated": 0,
  "failed": 0,
  "items": [
    {
      "id": "uuid-string-1",
      "ingredientId": "uuid-string-1",
      "quantity": "500",
      "unit": "ml",
      "status": "added"
    },
    {
      "id": "uuid-string-2",
      "ingredientId": "uuid-string-2",
      "quantity": "2",
      "unit": "oz",
      "status": "added"
    }
  ]
}
```

- **Error (400 Bad Request):** Invalid input data (e.g., invalid unit, missing required fields)
- **Error (401 Unauthorized):** User not authenticated
- **Error (422 Unprocessable Entity):** Transaction rolled back due to validation error in one or more items

#### `DELETE /user-inventory/bulk` (Bulk Delete Inventory Items)
Deletes multiple inventory items within a single transaction.

- **Request Body:**
```json
{
  "inventoryIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

- **Validation:**
  - Array must contain 1-100 inventory item IDs
  - All IDs must belong to the authenticated user
  - Items used in recent preparations (within last 15 minutes) cannot be deleted

- **Response (200 OK):**
```json
{
  "success": true,
  "deleted": 3,
  "failed": 0,
  "blockedByPreparations": []
}
```

- **Error (400 Bad Request):** Invalid input data
- **Error (401 Unauthorized):** User not authenticated
- **Error (403 Forbidden):** Attempting to delete inventory items that don't belong to user
- **Error (409 Conflict):** One or more items cannot be deleted due to recent preparations

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

- **Query Parameters:** `limit`, `page`
- **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid-of-cocktail",
      "name": "Secret Margarita",
      "instructions": "1. Rim glass with salt...",
  "imageFull": "/uploads/cocktails/uuid-full.webp",
  "imageThumb": "/uploads/cocktails/uuid-thumb.webp",
      "isPublic": true,
      "source": "local",
       "createdBy": "user-uuid",
      "createdAt": "2026-04-08T10:30:00.000Z"
    }
  ],
  "meta": {
    "currentPage": 1,
    "nextPage": null,
    "itemsPerPage": 10,
    "totalItems": 1,
    "totalPages": 1
  }
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
      "external_cocktail_id": null,
      "cocktail_name": "Mojito",
      "servings": 2,
      "deducted_ingredients": [
        {
          "ingredient_id": "rum-uuid",
          "ingredient_name": "Rum",
          "amount": "4",
          "unit": "oz"
        }
      ],
      "created_at": "2026-04-08T10:30:00.000Z",
      "undone": false,
       "can_undo": true
    },
    {
      "id": "prep-uuid-124",
      "cocktail_id": null,
      "external_cocktail_id": "11000",
      "cocktail_name": "Mojito (External)",
      "servings": 1,
      "deducted_ingredients": [
        {
          "ingredient_id": "rum-uuid",
          "ingredient_name": "Rum",
          "amount": "2",
          "unit": "oz"
        }
      ],
      "created_at": "2026-04-08T10:25:00.000Z",
      "undone": false,
       "can_undo": true
    }
  ],
  "meta": {
    "currentPage": 1,
    "nextPage": 2,
    "itemsPerPage": 2,
    "totalItems": 10,
    "totalPages": 5
  }
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
  "showTutorial": true
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
  "showTutorial": false
}
```

- **Validation:**
  - `unitSystem`: Optional, must be either "metric" or "imperial"
  - `theme`: Optional, must be either "light", "dark", or "system"
  - `defaultPartSize`: Optional, integer between 1 and 10000
  - `showTutorial`: Optional boolean

- **Response (200 OK):** Updated preferences object
- **Error (400 Bad Request):** Invalid input data
- **Error (401 Unauthorized):** User not authenticated



---

### 7. Admin Moderation (Admin Only)

#### `GET /admin/reported-content`
Fetches reported content for moderation review.

**Headers:**
- `Authorization: Bearer <admin-token>`

**Query Parameters:**
- `status`: Filter by status (`pending`, `reviewed`, `resolved`, `dismissed`)
- `type`: Filter by content type (`cocktail`, `comment`, `user`)
- `limit`, `page`: Standard pagination

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
  "meta": {
    "currentPage": 1,
    "nextPage": 2,
    "itemsPerPage": 20,
    "totalItems": 100,
    "totalPages": 5
  }
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
- **Headers:** `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh`

#### `POST /auth/refresh`
- **Headers:** Requires the `refreshToken` HttpOnly cookie.
- **Response (200):** `{ "accessToken": "new_jwt..." }` (and sets a newly rotated `refreshToken` cookie).

#### `POST /auth/logout`
- **Response (200):** Clears the HttpOnly cookie and updates `last_logout_timestamp` in the DB.

---

## 📄 Pagination Implementation Guide

### Page-based Pagination (Standard Implementation)

All list endpoints use traditional page/limit pagination for simplicity and consistency. To prevent deep pagination performance issues, page numbers are capped at 100 (allowing users to browse up to 1,000 results with default limit of 10).

### Architectural Decision: Unified Cache-Slicing Pagination
**Explicit Trade-off:** Because we cannot natively execute SQL `LIMIT/OFFSET` across a unified blend of PostgreSQL rows and third-party REST API responses, we explicitly abandon database-level pagination for the Unified Search endpoint. We mandate that the `CocktailAggregatorService` will fetch a bounded batch (e.g., Top 100) from both sources, combine them in memory, cache the unified array in Redis for 5 minutes, and apply `slice(offset, offset + limit)` strictly against the cached array. We trade database memory optimization for mathematical pagination integrity across disjointed data sources.

### Architectural Decision: Hard-Capping Unified Search Depth
**Explicit Trade-off:** Because we combine and cache local and external arrays in memory to support unified page-based pagination, we must enforce a hard bounds-limit on the initial data fetch to prevent Redis payload explosion. We explicitly mandate that Unified Search will only ever fetch and cache the Top 100 local and Top 100 external results per query. We trade deep database exploration (users will never be able to paginate past the 100th local result for a broad term) for the ability to synchronously merge, sort, and cache disparate data sources.

### Architectural Decision: Acceptance of Pagination Data Anomalies (Offset Shift)
**Explicit Trade-off:** By strictly mandating standard page-based (offset) pagination and explicitly banning cursor-based pagination to maintain API simplicity, we inherently accept "Offset Shift" anomalies. If database rows are inserted or deleted by other users while a client is actively paginating through a list, the data offset will shift. We explicitly accept that users may occasionally see duplicate items on subsequent pages or miss items entirely during active data mutation. We trade strict pagination stability for universal REST API consistency and the eradication of complex base64 cursor state management.

**Implementation Pattern for Unified Search:**
```typescript
async unifiedSearch(limit: number, page: number = 1, query: string): Promise<PaginatedResponse<Cocktail>> {
  const offset = (page - 1) * limit;
  const cacheKey = `search_unified:${query}`;
  
  let combinedResults = await this.cacheManager.get<Cocktail[]>(cacheKey);
  
  if (!combinedResults) {
    // Fetch bounded UNPAGINATED results (e.g., top 100) from both sources
    const localResults = await this.getLocalCocktails(query, 100); 
    const externalResults = await this.getExternalCocktails(query, 100);
    
    // Combine and sort
    combinedResults = this.combineAndSortResults(localResults, externalResults);
    
    // Cache the entire array for 5 minutes
    await this.cacheManager.set(cacheKey, combinedResults, 300);
  }
  
  // Apply page-based pagination to the cached array
  const paginatedData = combinedResults.slice(offset, offset + limit);
  const totalItems = combinedResults.length;
  
  return {
    data: paginatedData,
    meta: {
      currentPage: page,
      nextPage: page < Math.ceil(totalItems / limit) ? page + 1 : null,
      itemsPerPage: limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit)
    }
  };
}

// Example service method for fetching local cocktails (unpaginated for unified search)
async getLocalCocktails(query: string, maxResults: number): Promise<Cocktail[]> {
  return await this.cocktailRepository.find({
    where: { 
      name: ILike(`%${query}%`),
      isDeleted: false 
    },
    order: { createdAt: 'DESC', id: 'DESC' },
    take: maxResults,
  });
}

// Example service method for fetching external cocktails (unpaginated for unified search)
async getExternalCocktails(query: string, maxResults: number): Promise<Cocktail[]> {
  const externalResults = await this.externalApiService.searchCocktails(query);
  // Return top N results from external API
  return externalResults.slice(0, maxResults);
}

```

**Benefits of Page-based Pagination:**
- ✅ Simple and intuitive API for clients
- ✅ Consistent implementation across all endpoints
- ✅ Easy to implement pagination UI with page numbers
- ✅ Predictable performance with page number caps
- ✅ Compatible with traditional database queries using OFFSET/LIMIT

**Implementation Status:**
- Page-based pagination is used for all endpoints
- Page number is capped at 100 to prevent performance issues
- Frontend components use page numbers for navigation
- API consistency is maintained through standardized response format

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
