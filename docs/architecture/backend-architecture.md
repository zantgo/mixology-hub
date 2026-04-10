# Backend Architecture & Design Patterns

  

The MixologyHub backend is built with **NestJS**, a progressive Node.js framework that heavily enforces structure, dependency injection, and strict typing via TypeScript.

  

The application is designed as a **Modular Monolith**. It separates business domains into isolated modules while running in a single process, providing the development speed of a monolith with the structural readiness to be split into microservices if needed.

  

---

  

## 📂 Domain-Driven Structure

  

The codebase is organized by feature domains rather than technical roles (e.g., not grouping all controllers together). This ensures high cohesion and low coupling.

  

```text

src/

├── ai/ # LLM integration and recipe generation

├── cocktails/ # Recipe CRUD, Aggregation, and Preparation logic

├── favorites/ # User favorite mapping (Local + External IDs)

├── ingredients/ # Global ingredient catalog and base units

├── users/ # User profiles and Inventory management

├── external/ # 3rd-party API HTTP clients (TheCocktailDB, LLMs)

├── common/ # Shared DTOs (e.g., PaginationQueryDto)

├── utils/ # Pure business logic (e.g., UnitConverterService, MeasureParserService)

└── app.module.ts # Root module orchestrating imports

```

  

---

  

## 📐 Core Architectural Patterns

  

### 1. The Aggregator Pattern (Search Unification)

The frontend requires a seamless search experience, unaware of whether a cocktail comes from our local database or an external API.

  

We implement a `CocktailAggregatorService` that acts as an API Gateway/Aggregator:

1. Receives the search query.

2. Queries the local PostgreSQL database via TypeORM.

3. Queries `TheCocktailDbService` via Axios.

4. Uses an **Adapter/Mapper** function to transform the external, flat JSON structure (`strIngredient1`, `strMeasure1`) into our strict internal relational shape (`Cocktail`, `CocktailIngredient`).

5. Concatenates, paginates, and returns a unified response.

  

### 2. The Adapter Pattern (Provider-Agnostic AI)

To prevent vendor lock-in with AI providers (OpenAI, DeepSeek, Anthropic), the application relies on an interface (`IAiProvider`).

  

The concrete implementation injects environment variables (`AI_API_URL`, `AI_API_KEY`) to make standard REST calls.

- **The Prompt Engineering:** The backend constructs a strict system prompt demanding *only* a JSON output.

- **The Fallback:** The service implements a retry mechanism (up to 3 times) to handle cases where the LLM occasionally outputs markdown backticks instead of raw JSON, ensuring application stability.

  

### 3. Smart Inventory & Unit Conversion

To determine if a user can make a cocktail, the system cannot rely on simple string matching (e.g., "1 oz" vs "30 ml").

- We use a dedicated `UnitConverterService` containing mathematical conversion factors relative to a base unit (ml, grams).

- **Makeable Algorithm:** When querying `GET /user-inventory/makeable`, the database uses a complex SQL `HAVING` clause to filter cocktails where *all* required ingredients exist in the user's inventory. Then, in memory, the `UnitConverterService` mathematically verifies that the *quantities* are sufficient.

#### 📐 Human-Readable Measure Parsing

The `cocktail_ingredients` table stores both a human-readable `measure` string (e.g., "1 1/2 oz", "a splash") and separate `amount` (decimal) and `unit` (string) fields for mathematical operations.

**Parsing Strategy:**
1. **Fraction & Decimal Detection:** Regex patterns convert "1 1/2" → 1.5, "0.5" → 0.5
2. **Unit Extraction:** Separate numeric amount from unit string ("2 oz" → amount: 2, unit: "oz")
3. **Special Cases:** Handle "a pinch", "dash", "splash" as qualitative measures with null/0 amount
4. **Validation:** Ensure parsed values are valid for `UnitConverterService`

**Implementation Example:**
```typescript
export class MeasureParserService {
  parseMeasure(measure: string): { amount: number | null; unit: string } {
    // Handle special qualitative measures
    const qualitativeMeasures = ['pinch', 'dash', 'splash', 'to taste'];
    for (const qual of qualitativeMeasures) {
      if (measure.toLowerCase().includes(qual)) {
        return { amount: null, unit: qual };
      }
    }
    
    // Extract numeric part (supports fractions: "1 1/2", "3/4", "2.5")
    const match = measure.match(/(\d+(?:\s+\d+\/\d+|\/\d+)?(?:\.\d+)?)/);
    if (!match) {
      throw new Error(`Invalid measure format: ${measure}`);
    }
    
    const numericStr = match[1];
    const amount = this.parseFraction(numericStr);
    
    // Extract unit (everything after the number)
    const unit = measure.replace(numericStr, '').trim() || 'unit';
    
    return { amount, unit };
  }
  
  private parseFraction(str: string): number {
    // Handle mixed numbers: "1 1/2"
    const mixedMatch = str.match(/(\d+)\s+(\d+)\/(\d+)/);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1]);
      const numerator = parseInt(mixedMatch[2]);
      const denominator = parseInt(mixedMatch[3]);
      return whole + (numerator / denominator);
    }
    
    // Handle simple fractions: "3/4"
    const fractionMatch = str.match(/(\d+)\/(\d+)/);
    if (fractionMatch) {
      const numerator = parseInt(fractionMatch[1]);
      const denominator = parseInt(fractionMatch[2]);
      return numerator / denominator;
    }
    
    // Handle decimals: "2.5"
    return parseFloat(str);
  }
}

**Critical Edge Case: Recurring Decimals & Database Precision**
- Fractions like "1/3 oz" produce recurring decimals (0.333333...)
- Database uses `decimal(10,2)` - only 2 decimal places stored
- **Solution**: Round to 2 decimal places before database insertion
- **TDD Test Required**: Ensure "1/3 oz" → 0.33 (rounded), not 0.333333...
- **Business Impact**: Precision loss acceptable for cocktail measurements (±0.01 oz ≈ 0.3 ml)
```

**Why This Matters:**
- UI captures human-friendly input ("1 1/2 oz")
- Backend needs precise decimals (1.5) for mathematical operations
- `UnitConverterService` requires `amount` and `unit` separately
- Database stores both formats for display (`measure`) and calculation (`amount`, `unit`)

#### 🚀 Performance Optimization (Future Consideration)

For production-scale deployments with large ingredient catalogs, the current two-step approach (SQL filter + in-memory math) could become a bottleneck, potentially exceeding the 100ms response time requirement (UC 11.1) for users with highly restricted inventories. Two database-centric optimizations are available:

1. **PostgreSQL Materialized Views:** Pre-compute unit-converted inventory quantities in a materialized view that refreshes on inventory changes. This moves the math to the database layer.

2. **Custom PostgreSQL Functions:** Implement unit conversion logic as PostgreSQL stored functions, allowing the database to handle both filtering AND quantity validation in a single query.

**Example PostgreSQL function concept:**
```sql
CREATE OR REPLACE FUNCTION can_make_cocktail(
  user_id UUID, 
  cocktail_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  ingredient RECORD;
  user_quantity DECIMAL;
  required_quantity DECIMAL;
BEGIN
  FOR ingredient IN 
    SELECT ci.amount, ci.unit, i.base_unit
    FROM cocktail_ingredients ci
    JOIN ingredients i ON ci.ingredient_id = i.id
    WHERE ci.cocktail_id = $2
  LOOP
    -- Convert required amount to base unit
    required_quantity := convert_to_base_unit(ingredient.amount, ingredient.unit, ingredient.base_unit);
    
    -- Get user's inventory in base units
    SELECT ui.quantity INTO user_quantity
    FROM user_inventory ui
    WHERE ui.user_id = $1 
      AND ui.ingredient_id = ingredient.ingredient_id;
    
    IF user_quantity IS NULL OR user_quantity < required_quantity THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

  

---

  

## 🗄️ Data Integrity & Transactions

  

When dealing with user inventory, data integrity is paramount. We utilize **TypeORM Database Transactions** to ensure ACID compliance.

  

**Example: The `prepare()` Method**

When a user prepares a cocktail, their inventory must be depleted.

```typescript

return await this.cocktailRepository.manager.transaction(async (transactionalEntityManager) => {

// 1. Verify inventory holds sufficient quantities (Unit Converted)

// 2. Subtract required amounts from user stock

// 3. Save updated inventory rows

// If ANY step fails (e.g., concurrent request depletes stock first),

// the entire transaction rolls back, preventing negative inventory.

});

```

  

---

  

## ⚡ Caching Strategy (Redis)

  

External API calls are expensive and subject to rate-limiting. We utilize **Redis** via NestJS's `CacheManager`.

  

**Flow for External Data (`TheCocktailDbService`):**

1. Check Redis for key: `cocktail_search_{query}`.

2. **Cache Hit:** Return data immediately (0 network latency).

3. **Cache Miss:**

- Execute HTTP GET to external API.

- Store response in Redis with a TTL (Time-To-Live) of 6 hours.

- Return response.

  

---

  

## 🛡️ Validation & Security

  

- **Global Pipes:** All incoming requests pass through a global `ValidationPipe`.

- **DTOs:** Data Transfer Objects leverage `class-validator` to strictly type-check incoming JSON bodies. Requests with extra, unmapped fields are automatically stripped (`whitelist: true`) or rejected (`forbidNonWhitelisted: true`) to prevent mass-assignment vulnerabilities.

### 🚦 Rate Limiting (Production Consideration)

In a production environment, public endpoints—especially the AI generation endpoint (`POST /ai`)—will be protected by a `ThrottlerModule` (NestJS rate limiter). This prevents abuse, controls costs associated with third-party LLM APIs, and ensures fair usage across users. The roadmap (Phase 1) includes configuring per-user and global request limits.

### 👑 Role-Based Access Control (RBAC)

The system implements a comprehensive RBAC system with the following components:

#### 1. Database Schema
- **`users.role` column:** Stores user role (`'user'` or `'admin'`) with default value `'user'`
- **Admin-only tables:** Certain operations require admin privileges (e.g., global ingredient management)

#### 2. Authorization Guards
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;
    
    const request = context.switchToHttp().getRequest();
    const user = request.user; // JWT payload
    
    return requiredRoles.includes(user.role);
  }
}
```

#### 3. Role Decorators
```typescript
// Controller usage
@Controller('admin/ingredients')
@UseGuards(RolesGuard)
export class AdminIngredientsController {
  @Post('merge')
  @Roles('admin') // Only admins can access
  async mergeIngredients(@Body() dto: MergeIngredientsDto) {
    // Admin-only logic
  }
}
```

#### 4. Admin Privileges
- **Global ingredient promotion:** Convert user-created ingredients to global availability
- **Duplicate ingredient merging:** Merge duplicate ingredients across the system
- **System-wide data management:** Access to all user data for support purposes
- **Audit logging:** All admin actions are logged with timestamp and user ID

#### 5. User Isolation
- Standard users can only access and modify their own data (inventory, cocktails, favorites)
- Multi-tenant isolation via `user_id` foreign keys in all user-specific tables
- JWT tokens contain user ID and role for authorization decisions
