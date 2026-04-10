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
USERS ||--o{ EXTERNAL_COCKTAIL_RATINGS : "rates_external"
USERS ||--o{ PREPARATION_LOGS : "performs"
COCKTAILS }o--o{ PREPARATION_LOGS : "is_prepared_as"
USERS ||--o{ REFRESH_TOKENS : "has_sessions"

   
 
 enum base_unit_type {
  'ml',
  'g',
  'count'
 }
 
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
  uuid user_id FK "ON DELETE CASCADE"
  string unit_system DEFAULT 'metric'
  string theme DEFAULT 'system'
  integer default_servings DEFAULT 1 "default number of servings to prepare when making a drink"
  integer default_part_size DEFAULT 30 "default ml volume for a single 'part' in ratio-based recipes"
  boolean show_tutorial DEFAULT true "whether to show tutorial on first use"
  -- enable_offline_mode column removed as part of Online-Only Mandate
  }
  
    INGREDIENTS {

 uuid id PK

 string name

 string normalized_name "lowercase, trimmed, for matching"

 boolean is_global DEFAULT false "true = system ingredient, false = user custom"

 base_unit_type baseUnit "Strictly typed for math engine routing"

   decimal(5,4) density DEFAULT 1.0 "Used for Mass <-> Volume. CHECK (density >= 0.1)"

   uuid created_by FK "nullable: true, ON DELETE SET NULL"

  timestamp created_at

  }
 
 /* 
 * Unique Constraints:
 * - Global ingredients: UNIQUE(normalized_name) WHERE is_global = true
 * - Custom ingredients: UNIQUE(normalized_name) WHERE is_global = false
 * This ensures concurrent custom ingredient creation results in same ID (UC 10.5)
 * Custom ingredients are globally unique by name but marked as non-global
 * created_by can be NULL (anonymized when creator deletes account - UC 10.6)
 * 
 * SECURITY NOTE: Because custom ingredients are shared by name, name edits are
 * restricted to prevent User B from renaming User A's ingredient. Only admins
 * can rename custom ingredients to maintain data integrity across users.
 */

  

INGREDIENT_RELATIONS {
  uuid parent_id FK "ON DELETE CASCADE" -- ADD THIS
  uuid child_id FK "ON DELETE CASCADE"  -- ADD THIS
  string relationship_type "enum: 'synonym', 'is_a'"
}

  

 COCKTAILS {

 uuid id PK

 string name

 text instructions

 boolean is_public

 boolean is_deleted DEFAULT false "soft delete flag"

   string source

   string external_id "nullable: true, external API ID for API-sourced cocktails"

   string parent_external_id "nullable: true, tracks original external ID when forking API cocktails"

      string image_full "nullable: true, max length: 255 characters (varchar)"
      string image_thumb "nullable: true, max length: 255 characters (varchar)"
    decimal rating "nullable: true, cached average rating"
    integer rating_count DEFAULT 0 "number of ratings for calculating average"
    string category "nullable: true"
    string glassware "nullable: true"
    uuid created_by FK "nullable: true, ON DELETE SET NULL"
   timestamp created_at
   }

  

  COCKTAIL_INGREDIENTS {

  uuid id PK

  uuid cocktail_id FK "ON DELETE CASCADE"

    uuid ingredient_id FK "nullable: true, ON DELETE SET NULL" /* Allows Admin ON DELETE SET NULL to work */

   string measure

   decimal(10,4) amount "nullable: true, precision for fraction scaling"

  string unit

  string type DEFAULT 'regular' "enum: 'regular', 'garnish', 'rinse'"

  boolean is_optional DEFAULT false "true = optional ingredient (e.g., garnish)"

 }

  

   USER_INVENTORY {

  uuid id PK

  uuid user_id FK "ON DELETE CASCADE"

  uuid ingredient_id FK "ON DELETE CASCADE"

    decimal(10,4) quantity "CHECK (quantity >= 0)"

  timestamp created_at

 timestamp updated_at

 }

  

  FAVORITES {

 uuid id PK

 uuid user_id FK "ON DELETE CASCADE"

 uuid cocktail_id FK "nullable: true, ON DELETE CASCADE"

 string external_cocktail_id "nullable: true"

 timestamp created_at

   -- Ensure a favorite always points to something
   CHECK (cocktail_id IS NOT NULL OR external_cocktail_id IS NOT NULL)
    -- Prevent duplicate favorites using Partial Unique Indexes (Postgres standard for nullable unique pairs)
    CREATE UNIQUE INDEX idx_fav_local ON favorites(user_id, cocktail_id) WHERE cocktail_id IS NOT NULL;
    CREATE UNIQUE INDEX idx_fav_external ON favorites(user_id, external_cocktail_id) WHERE external_cocktail_id IS NOT NULL;

   -- Senior Architectural Decision: Silent Wiping of Favorites vs. User Experience
   -- Explicit Trade-off: When users delete their account, all their favorites are silently deleted via ON DELETE CASCADE.
   -- This provides clean data hygiene but violates user expectations of "exportable data" and GDPR "right to data portability".
   -- We accept this trade-off because implementing a favorites export feature would require:
   -- 1. Complex UI for exporting cocktail references (including external API cocktails)
   -- 2. Additional database columns to track favorite metadata for export
   -- 3. Migration path for re-importing favorites to a new account
   -- The silent deletion is documented in the account deletion confirmation dialog.

 }

  

AI_RECIPES {
  uuid id PK
  string prompt
  jsonb generated_recipe
  uuid created_by FK "nullable: true, ON DELETE SET NULL"
  uuid cocktail_id FK "nullable: true, links to saved cocktail if user saves it, ON DELETE SET NULL"
  timestamp created_at
}

COCKTAIL_RATINGS {
  uuid id PK
  uuid user_id FK "ON DELETE CASCADE"
  uuid cocktail_id FK "ON DELETE CASCADE"
  decimal score
  timestamp created_at
  timestamp updated_at
}

EXTERNAL_COCKTAIL_RATINGS {
  uuid id PK
  uuid user_id FK "ON DELETE CASCADE" -- ADD THIS
  string external_id "The external API ID (e.g., '11000' from TheCocktailDB)"
  decimal score
  timestamp created_at
  timestamp updated_at
  UNIQUE(user_id, external_id) "Prevent duplicate ratings per user per external cocktail"
}

PREPARATION_LOGS {
  uuid id PK
  uuid user_id FK "nullable: true, ON DELETE SET NULL"
  uuid cocktail_id FK "nullable: true, ON DELETE SET NULL"
  string external_cocktail_id "nullable: true"
  string cocktail_name_snapshot "Snapshot of the cocktail name at time of prep to prevent amnesia if original is deleted"
  integer servings
  jsonb deducted_ingredients "Stores exact IDs, amounts, units deducted"
  string inventory_status "enum: 'pending', 'deducted', 'failed_insufficient', 'failed_other' DEFAULT 'pending'"
  text inventory_error "nullable: true, details if inventory deduction failed"
  timestamp created_at "Used for the 15-minute undo window"
  boolean undone DEFAULT false
}

 REFRESH_TOKENS {
  uuid id PK
  uuid user_id FK "ON DELETE CASCADE"
  string token_family "Used for rotating token chains"
  string hashed_token "bcrypt hash of the current refresh token"
  boolean is_revoked DEFAULT false
  timestamp expires_at
  timestamp rotated_at "nullable: true, Used for 5-second grace period fallback"
  timestamp created_at
 }

REPORTED_CONTENT {
  uuid id PK
  uuid reported_by FK "User who reported the content" "nullable: true, ON DELETE SET NULL"
  uuid cocktail_id FK "nullable: true, ON DELETE SET NULL"
  string external_cocktail_id "nullable: true"
  string report_reason "enum: 'inappropriate', 'spam', 'copyright', 'other'"
  string details "optional text details from reporter"
  string status "enum: 'pending', 'reviewed', 'dismissed', 'action_taken' DEFAULT 'pending'"
  uuid reviewed_by FK "nullable: true, admin who reviewed, ON DELETE SET NULL"
  timestamp created_at
  timestamp reviewed_at "nullable: true"
}

 HIDDEN_EXTERNAL_COCKTAILS {
  string external_id PK
  uuid hidden_by FK "admin user id" "nullable: true, ON DELETE SET NULL"
  string reason
  timestamp created_at
}

  USER_AI_QUOTAS {
   uuid id PK
  uuid user_id FK "ON DELETE CASCADE"
   date quota_date "Date for which quota is tracked (YYYY-MM-DD)"
   integer usage_count DEFAULT 0 "Atomic counter for daily AI generations"
   timestamp last_updated_at
   UNIQUE(user_id, quota_date) "One row per user per day"
   -- DEPRECATED: AI quota enforcement moved to Redis for atomic INCR operations (UC 5.25)
   -- This table remains for historical analytics but is not the source of truth
   -- Frontend queries GET /ai/quota which reads from Redis, not this table
 }

 SYSTEM_SETTINGS {
  string setting_key PK "e.g., 'global_token_salt_version'"
  string setting_value "JSON or string value"
  timestamp updated_at
   uuid updated_by FK "nullable: true, admin who changed it, ON DELETE SET NULL"
}

-- SYNC_OPERATIONS table has been removed as part of the Online-Only Mandate
-- Offline sync functionality is no longer supported

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

- **`quantity`:** Uses PostgreSQL `decimal(10,4)` to match `COCKTAIL_INGREDIENTS.amount` precision and prevent truncation during inventory deductions. *Floating-point types (`float`, `real`) are strictly avoided* to prevent rounding errors during fractional unit conversions.

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

- **`cocktails.image_full`:** Path to full-size cocktail image (1024x1024 WebP format) stored locally in uploads directory.
- **`cocktails.image_thumb`:** Path to thumbnail cocktail image (300x300 WebP format) stored locally in uploads directory.

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

The `ingredients.baseUnit` field is a constrained enumeration that defines the fundamental measurement type for that ingredient. The backend `UnitConverterService` uses a static dictionary to convert any supported unit to a standard base unit (`ml` for volumes, `g` for weights, `count` for countable items).

### Supported Units & Conversion Factors

| Category | Base Unit | Supported Input Units | Conversion Factor (to Base) |
|----------|-----------|----------------------|----------------------------|
| Volume   | `ml`      | `ml`, `cl`, `dl`, `l`, `oz`, `tbsp`, `tsp`, `dash` | Defined in `UnitConverterService` |
| Weight   | `g`       | `g`, `kg`, `oz`, `lb` | Defined in `UnitConverterService` |
| Count    | `count`   | `piece`, `whole`, `item`, `unit` | 1:1 (no conversion needed) |

**Important:** The `baseUnit` column for an ingredient must be set to one of the base units (`ml`, `g`, or `count`). The system uses this value to determine which conversion table to apply when comparing inventory quantities against recipe requirements. Count-based ingredients (e.g., lemons, mint leaves) use `count` base unit and support linear deduction without volume/mass conversion (UC 1.14).

### Seeding the Ingredient Catalog

The global `ingredients` table is initially populated via a migration or seeder script. Each ingredient's `baseUnit` is explicitly set based on its physical nature (e.g., liquids → `ml`, solids → `g`, countable items → `count`). This ensures the math engine always operates on consistent, comparable units.

---

  

## 🛡️ Data Integrity Strategies

  

1. **Cascading Deletes (`ON DELETE CASCADE`) and Nullification (`ON DELETE SET NULL`):**

- If a `User` is deleted, their `UserInventory`, `Favorites`, and custom `Cocktails` are automatically wiped.

- If a `Cocktail` is deleted (hard delete for system cleanup only), its `Cocktail_Ingredients` are cleanly removed, preventing orphaned relational rows.

- **Note:** User-initiated cocktail deletion uses soft delete (`is_deleted = true`) not CASCADE DELETE, to preserve Favorites relationships (UC 10.4, UC 2.9).

- If a `Cocktail` is hard-deleted, `PREPARATION_LOGS.cocktail_id` is set to `NULL` (`ON DELETE SET NULL`) to preserve preparation history and enable undo functionality even after the original cocktail is deleted.

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