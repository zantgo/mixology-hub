# Database Schema & Data Modeling

  

MixologyHub uses **PostgreSQL** as its primary persistent data store, interfaced via **TypeORM**. The schema is highly relational and strictly typed, ensuring robust data integrity, cascading deletions, and mathematical accuracy for inventory calculations.

  

## 📊 Entity-Relationship Diagram (ERD)

  

```mermaid

erDiagram

USERS ||--o{ COCKTAILS : "creates"

USERS ||--o{ USER_INVENTORY : "owns"

USERS ||--o{ FAVORITES : "saves"

USERS ||--o{ AI_RECIPES : "generates"

USERS ||--|| USER_PROFILES : "has_preferences"

COCKTAILS ||--o{ COCKTAIL_INGREDIENTS : "contains"

INGREDIENTS ||--o{ COCKTAIL_INGREDIENTS : "used_in"

INGREDIENTS ||--o{ USER_INVENTORY : "stocked_as"
INGREDIENTS ||--o{ INGREDIENT_RELATIONS : "has_children"
INGREDIENTS ||--o{ INGREDIENT_RELATIONS : "has_parents"

COCKTAILS ||--o{ FAVORITES : "is_favorited"

USERS ||--o{ COCKTAIL_RATINGS : "rates"
COCKTAILS ||--o{ COCKTAIL_RATINGS : "is_rated_by"
USERS ||--o{ PREPARATION_LOGS : "performs"
COCKTAILS }o--o{ PREPARATION_LOGS : "is_prepared_as"
USERS ||--o{ REFRESH_TOKENS : "has_sessions"

  

USERS {
  uuid id PK
  string email UK
  string display_name
  string password_hash
  string role DEFAULT 'user'
  boolean is_email_verified DEFAULT false
  integer token_version DEFAULT 1
  timestamp last_logout_timestamp "nullable: true"
  timestamp created_at
}
  
  USER_PROFILES {
  uuid id PK
  uuid user_id FK
  string unit_system DEFAULT 'metric'
  string theme DEFAULT 'system'
  }
  
   INGREDIENTS {

 uuid id PK

 string name

 string normalized_name "lowercase, trimmed, for matching"

 boolean is_global DEFAULT false "true = system ingredient, false = user custom"

 string baseUnit

 decimal(5,4) density DEFAULT 1.0 "Used for Mass <-> Volume conversions"

 uuid created_by FK "nullable: true"

 }
 
 /* 
  * Unique Constraints:
  * - Global ingredients: UNIQUE(normalized_name) WHERE is_global = true
  * - Custom ingredients: UNIQUE(normalized_name, created_by) WHERE is_global = false
  * This prevents User B from being blocked by User A's private ingredient names
  */

  

INGREDIENT_RELATIONS {
  uuid parent_id FK
  uuid child_id FK
  string relationship_type "enum: 'synonym', 'is_a'"
}

  

 COCKTAILS {

 uuid id PK

 string name

 text instructions

 boolean is_public

 boolean is_deleted DEFAULT false "soft delete flag"

  string source

  string external_id

   string image_url
   decimal rating
   string category "nullable: true"
   string glassware "nullable: true"
   uuid created_by FK "nullable: true"
   }

  

COCKTAIL_INGREDIENTS {

uuid id PK

uuid cocktail_id FK

uuid ingredient_id FK

 string measure

 decimal(10,4) amount "precision for fraction scaling (e.g., 1/3 = 0.3333)"

 string unit

}

  

USER_INVENTORY {

uuid id PK

uuid user_id FK

uuid ingredient_id FK

decimal quantity

string unit

}

  

 FAVORITES {

 uuid id PK

 uuid user_id FK

 uuid cocktail_id FK "nullable: true"

 string external_cocktail_id "nullable: true"

 }

  

AI_RECIPES {
  uuid id PK
  string prompt
  jsonb generated_recipe
  uuid created_by FK "nullable: true"
  timestamp created_at
}

COCKTAIL_RATINGS {
  uuid id PK
  uuid user_id FK
  uuid cocktail_id FK
  decimal score
  timestamp created_at
  timestamp updated_at
}

PREPARATION_LOGS {
  uuid id PK
  uuid user_id FK
  uuid cocktail_id FK "nullable: true"
  string external_cocktail_id "nullable: true"
  integer servings
  jsonb deducted_ingredients "Stores exact IDs, amounts, units deducted"
  timestamp created_at "Used for the 15-minute undo window"
  boolean undone DEFAULT false
}

REFRESH_TOKENS {
  uuid id PK
  uuid user_id FK
  string token_family "Used for rotating token chains"
  string hashed_token "bcrypt hash of the current refresh token"
  boolean is_revoked DEFAULT false
  timestamp expires_at
  timestamp created_at
}

REPORTED_CONTENT {
  uuid id PK
  uuid reported_by FK "User who reported the content"
  uuid cocktail_id FK "nullable: true"
  string external_cocktail_id "nullable: true"
  string report_reason "enum: 'inappropriate', 'spam', 'copyright', 'other'"
  string details "optional text details from reporter"
  string status "enum: 'pending', 'reviewed', 'dismissed', 'action_taken' DEFAULT 'pending'"
  uuid reviewed_by FK "nullable: true, admin who reviewed"
  timestamp created_at
  timestamp reviewed_at "nullable: true"
}

```

  

---

  

## 🗄️ Core Tables & Design Decisions

  

### 1. `users`

Handles authentication and relationship anchoring.

- **Primary Key:** `UUID` (Standardized across all tables for security and distributed generation).

- **Unique Constraint:** `email`.

- **`role`:** String field with default value `'user'`. Supports role-based access control (RBAC) for admin features. Possible values: `'user'`, `'admin'`.

  

### 2. `ingredients`

The global catalog of all possible ingredients.

- **`name`:** Stored in lowercase to prevent case-sensitive duplication (e.g., "Vodka" vs "vodka").

- **`baseUnit`:** A critical field (e.g., `ml`, `g`). It dictates the mathematical baseline for unit conversions when checking inventory.

- **`density`:** Decimal field (`decimal(5,4)`) with default value `1.0`. Used for mass-to-volume conversions (e.g., honey has density ≈ 1.42 g/ml). Enables the `UnitConverterService` to convert between mass and volume units for ingredients where both measurement types are valid.

  

### 3. `user_inventory`

Tracks what a user physically owns.

- **Composite Unique Constraint:** `['user_id', 'ingredient_id']`. A user cannot have two separate rows for "Vodka". If they add more, the existing row's quantity is updated mathematically via an `UPSERT` pattern.

- **`quantity`:** Uses PostgreSQL `decimal(10,2)`. *Floating-point types (`float`, `real`) are strictly avoided* to prevent rounding errors during fractional unit conversions.

### 4. `ingredient_relations`

Maps hierarchical and synonym relationships between ingredients.

- **`parent_id` & `child_id`:** Foreign keys to `INGREDIENTS` table, forming a closure table pattern for efficient hierarchical queries.
- **`relationship_type`:** Enum field with values `'synonym'` (alternative names for same ingredient) or `'is_a'` (hierarchical parent-child relationship).
- **Composite Unique Constraint:** `['parent_id', 'child_id', 'relationship_type']` prevents duplicate relationship entries.
- **Self-Referential:** Allows ingredients to have multiple parents/children (e.g., "Vodka" is_a "Spirit", "Gin" is_a "Spirit", "Vodka" synonym "Wódka").
- **Use Cases:** Supports UC 3.10 (Synonyms) and UC 3.12 (Hierarchy) for intelligent ingredient matching and substitution.

  

### 5. `cocktails` & `cocktail_ingredients` (Many-to-Many)

Stores user-created recipes or AI-saved recipes.

- **`cocktails.source`:** Enum-like string (`local`, `api`, `ai`) tracking where the recipe originated.

- **`cocktails.external_id`:** Allows the local DB to reference `TheCocktailDB` recipes without duplicating all API data locally.

- **`cocktails.image_url`:** Optional URL string for cocktail images. Supports external URLs (e.g., from TheCocktailDB) or user-provided URLs. Frontend falls back to default image if URL is invalid or fails to load.

- **`cocktail_ingredients.measure`:** A human-readable string (e.g., "A pinch", "1 1/2 oz") for UI display.

- **`cocktail_ingredients.amount` & `unit`:** Strict numeric fields required for the backend's `UnitConverterService` to perform mathematical inventory deductions.

  

### 6. `favorites`

A mapping table allowing users to save recipes.

- **Polymorphic Design:** It contains both `cocktail_id` (FK to local table) and `external_cocktail_id` (string). This allows a user to favorite a drink regardless of whether it lives in our PostgreSQL DB or comes from the external public API aggregator.

  

### 7. `ai_generated_recipes`

Logs the history of AI requests.

- **`generated_recipe`:** Uses the PostgreSQL `JSONB` data type. This allows the backend to store the raw JSON output from the LLM provider efficiently, making it queryable and indexable if needed, before the user decides to convert it into a permanent `Cocktail` record.

### 8. `user_profiles`

Stores user preferences and settings.

- **`unit_system`:** Defines the user's preferred measurement system (`metric` or `imperial`). Used by the frontend to display measurements in the user's preferred units.
- **`theme`:** Stores the user's UI theme preference (`light`, `dark`, or `system`).
- **One-to-One Relationship:** Each user has exactly one profile record, created automatically when a user registers.

### 9. `cocktails.rating` Column

- **`rating`:** Decimal field (`decimal(3,2)`) storing average user ratings for cocktails (0.00 to 5.00 scale).
- **Nullable:** Can be `NULL` for cocktails without ratings.
- **Precision:** `decimal(3,2)` allows values from 0.00 to 9.99, providing sufficient range for 5-star rating systems with decimal precision.

### 10. `cocktail_ratings` Pivot Table

- **Purpose:** Stores individual user ratings for cocktails to prevent double-voting and enable rating updates.
- **Composite Unique Constraint:** `[user_id, cocktail_id]` ensures each user can rate a cocktail only once.
- **`score`:** Decimal field (`decimal(3,2)`) storing individual rating scores (0.00 to 5.00).
- **`updated_at`:** Timestamp tracking when a user updates their rating (enables UPSERT operations).
- **Relationship:** Many-to-many relationship between `USERS` and `COCKTAILS` tables.
- **Cached Average:** The `cocktails.rating` column is a cached average calculated from all `cocktail_ratings.score` values for that cocktail.

  

---

## 📐 Unit Conversion & Base Unit Catalog

The `ingredients.baseUnit` field is a constrained enumeration that defines the fundamental measurement type for that ingredient. The backend `UnitConverterService` uses a static dictionary to convert any supported unit to a standard base unit (`ml` for volumes, `g` for weights).

### Supported Units & Conversion Factors

| Category | Base Unit | Supported Input Units | Conversion Factor (to Base) |
|----------|-----------|----------------------|----------------------------|
| Volume   | `ml`      | `ml`, `cl`, `dl`, `l`, `oz`, `tbsp`, `tsp`, `dash` | Defined in `UnitConverterService` |
| Weight   | `g`       | `g`, `kg`, `oz`, `lb` | Defined in `UnitConverterService` |

**Important:** The `baseUnit` column for an ingredient must be set to one of the base units (`ml` or `g`). The system uses this value to determine which conversion table to apply when comparing inventory quantities against recipe requirements.

### Seeding the Ingredient Catalog

The global `ingredients` table is initially populated via a migration or seeder script. Each ingredient's `baseUnit` is explicitly set based on its physical nature (e.g., liquids → `ml`, solids → `g`). This ensures the math engine always operates on consistent, comparable units.

---

  

## 🛡️ Data Integrity Strategies

  

1. **Cascading Deletes (`ON DELETE CASCADE`) and Nullification (`ON DELETE SET NULL`):**

- If a `User` is deleted, their `UserInventory`, `Favorites`, and custom `Cocktails` are automatically wiped.

- If a `Cocktail` is deleted, its `Cocktail_Ingredients` are cleanly removed, preventing orphaned relational rows.

- If a `Cocktail` is deleted, `PREPARATION_LOGS.cocktail_id` is set to `NULL` (`ON DELETE SET NULL`) to preserve preparation history and enable undo functionality even after the original cocktail is deleted.

2. **Concurrency Control for `PREPARATION_LOGS`:**

- The `undone` column in `PREPARATION_LOGS` must be protected with database-level locking during undo operations to ensure idempotency (UC 4.19).

- Implementation uses `SELECT ... FOR UPDATE` or application-level distributed locks (Redis) when checking and updating the `undone` flag.

- Prevents duplicate inventory restoration from concurrent undo requests.

2. **Eager Loading Optimization:**

- On heavily queried pivot tables (like `CocktailIngredient`), the `Ingredient` relation is marked as `eager: true` in TypeORM. This ensures that the ingredient name is automatically joined and fetched without requiring manual `LEFT JOIN` boilerplate in every service method.

3. **Decimal Column Transformers:**

- PostgreSQL `decimal` columns are configured with TypeORM transformers to ensure proper JavaScript `number` type conversion. Without transformers, TypeORM may return decimal values as strings, breaking mathematical operations in the `UnitConverterService`.

**Example Entity Configuration:**
```typescript
import { ColumnNumericTransformer } from '../utils/column-numeric.transformer';

@Entity()
export class UserInventory {
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: new ColumnNumericTransformer(), // Critical for math operations
  })
  quantity: number;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount: number;
}

// ColumnNumericTransformer implementation:
export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  
  from(data: string): number {
    if (data === null || data === undefined) return null;
    return parseFloat(data);
  }
}
```

**Why this matters:** The `UnitConverterService` performs precise mathematical calculations for inventory management. String values would cause `NaN` errors or incorrect conversions, potentially allowing users to prepare cocktails they don't have ingredients for.

## 🔍 PostgreSQL Extensions for Advanced Features

### Required Extensions
The database requires specific PostgreSQL extensions for advanced functionality:

```sql
-- Enable pg_trgm for fuzzy string matching (AI entity resolution & search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create indexes for trigram similarity searches
CREATE INDEX idx_ingredients_name_trgm ON ingredients USING gin (normalized_name gin_trgm_ops);
CREATE INDEX idx_cocktails_name_trgm ON cocktails USING gin (name gin_trgm_ops);
```

### pg_trgm Usage Examples
1. **AI Entity Resolution (UC 5.26):** Fuzzy matching AI-generated ingredient strings to existing catalog
   ```sql
   SELECT id, name, similarity(normalized_name, 'fresh squeezed lime') AS score
   FROM ingredients 
   WHERE similarity(normalized_name, 'fresh squeezed lime') > 0.8
   ORDER BY score DESC
   LIMIT 1;
   ```

2. **Typo-Tolerant Search (UC 2.25):** Finding cocktails despite spelling errors
   ```sql
   SELECT id, name, similarity(name, 'margaritta') AS score
   FROM cocktails
   WHERE similarity(name, 'margaritta') > 0.3
   ORDER BY score DESC;
   ```

### Performance Benefits
- **Trigam similarity** is significantly faster than Levenshtein distance for large datasets
- **GIN indexes** enable efficient fuzzy matching without full table scans
- **Threshold-based matching** (e.g., `similarity() > 0.8`) provides accurate results while preventing false positives

### Deployment Requirements
- Include `CREATE EXTENSION` statements in database migration scripts
- Ensure PostgreSQL instance has `pg_trgm` extension available
- Test similarity thresholds during development to balance accuracy and performance